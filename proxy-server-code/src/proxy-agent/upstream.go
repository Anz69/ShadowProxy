package main

import (
	"bufio"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sirupsen/logrus"
)

// --- DNS-кэш апстрима (ТЗ п.7.2) -------------------------------------------
// Резолвим хост апстрима (eu-isp.flashproxy.io и т.п.) не на каждый коннект, а
// раз в TTL. Снижает задержку установки соединения. Раунд-робин по A-записям,
// чтобы не пинить весь трафик на один узел апстрима.
const dnsCacheTTL = 60 * time.Second

type dnsEntry struct {
	ips []string
	exp time.Time
	rr  uint32
}

var (
	dnsMu    sync.Mutex
	dnsCache = map[string]*dnsEntry{}
)

// resolveUpstreamHost возвращает IP для подключения. При ошибке/таймауте резолва
// отдаёт исходный хост (его дорезолвит net.Dial) — поведение не ломается.
func resolveUpstreamHost(host string) string {
	if net.ParseIP(host) != nil {
		return host // уже IP
	}
	now := time.Now()
	dnsMu.Lock()
	e, ok := dnsCache[host]
	if ok && now.Before(e.exp) && len(e.ips) > 0 {
		ip := e.ips[int(atomic.AddUint32(&e.rr, 1))%len(e.ips)]
		dnsMu.Unlock()
		return ip
	}
	dnsMu.Unlock()

	ips, err := net.LookupHost(host)
	if err != nil || len(ips) == 0 {
		return host // фолбэк — пусть Dial сам резолвит
	}
	dnsMu.Lock()
	dnsCache[host] = &dnsEntry{ips: ips, exp: now.Add(dnsCacheTTL)}
	dnsMu.Unlock()
	return ips[0]
}

// tuneConn выключает алгоритм Нейгла (TCP_NODELAY) — мелкие пакеты идут без
// задержки буферизации, что заметно снижает latency интерактивного трафика.
func tuneConn(c net.Conn) {
	if tcp, ok := c.(*net.TCPConn); ok {
		_ = tcp.SetNoDelay(true)
	}
}

// Ретраи upstream-коннекта. Резидентские пулы (особенно мелких стран) флаки: часть
// exit-узлов дохлые/медленные, один CONNECT легко попадает на такой и отваливается по
// таймауту. Апстрим ротирует IP на каждый CONNECT, поэтому свежая попытка = другой узел.
// Короткий таймаут на попытку + несколько попыток → цикл до живого IP, укладываемся в
// клиентский таймаут. Персистентный 403 (нет flow) исчерпает попытки и вернёт ошибку — норм.
const (
	upstreamMaxAttempts     = 4
	upstreamAttemptTimeout  = 9 * time.Second
	upstreamDirectDialTimeo = 30 * time.Second
)



// Протокол апстрима, который сработал последним, по ключу host:port. FlashProxy
// отдаёт и HTTP CONNECT, и SOCKS5 на одном порту, но HTTP периодически отвечает
// 407 или висит до таймаута. Запоминаем живой протокол, чтобы не платить 9 секунд
// таймаута на каждом новом соединении.
var (
	upstreamProtoMu sync.Mutex
	upstreamProto   = map[string]string{}
)

func upstreamProtoKey(host string, port int) string {
	return net.JoinHostPort(host, strconv.Itoa(port))
}

func preferredUpstreamProto(host string, port int) string {
	upstreamProtoMu.Lock()
	defer upstreamProtoMu.Unlock()
	return upstreamProto[upstreamProtoKey(host, port)]
}

func rememberUpstreamProto(host string, port int, proto string) {
	k := upstreamProtoKey(host, port)
	upstreamProtoMu.Lock()
	changed := upstreamProto[k] != proto
	upstreamProto[k] = proto
	upstreamProtoMu.Unlock()
	if changed {
		logrus.Infof("Upstream %s: рабочий протокол — %s", k, proto)
	}
}

// ConnectUpstream поднимает туннель до target через апстрим-провайдера.
// If UpstreamHost is empty, connects directly to target (debug/direct mode).
//
// Протокол апстрима не задан в БД: FlashProxy держит на одном и том же порту и
// HTTP CONNECT, и SOCKS5, причём HTTP периодически отвечает 407 или висит до
// таймаута, пока SOCKS5 с теми же кредами работает. Сначала пробуем протокол,
// который уже сработал для этого апстрима, затем второй; при неудаче обоих —
// ещё круг. Живой протокол подхватывается сам, без изменения данных прокси.
func ConnectUpstream(cfg *LoginConfig, targetHost string, targetPort int) (net.Conn, error) {
	// Direct mode: no upstream proxy, connect straight to target (без ретраев/CONNECT).
	if cfg.UpstreamHost == "" || cfg.UpstreamPort == 0 {
		addr := net.JoinHostPort(targetHost, strconv.Itoa(targetPort))
		conn, err := net.DialTimeout("tcp", addr, upstreamDirectDialTimeo)
		if err != nil {
			return nil, fmt.Errorf("upstream dial: %w", err)
		}
		tuneConn(conn)
		return conn, nil
	}

	// Протокол ещё не известен: HTTP CONNECT у мёртвого апстрима висит до таймаута,
	// поэтому при первом коннекте запускаем оба протокола параллельно и берём тот,
	// что поднял туннель первым. Иначе первый клиент после старта агента ждал бы
	// полный таймаут HTTP, прежде чем уйти на SOCKS5.
	known := preferredUpstreamProto(cfg.UpstreamHost, cfg.UpstreamPort)
	if known == "" {
		if conn, proto, err := raceUpstreamProtocols(cfg, targetHost, targetPort); err == nil {
			rememberUpstreamProto(cfg.UpstreamHost, cfg.UpstreamPort, proto)
			return conn, nil
		}
	}

	order := []string{"http", "socks5"}
	if preferredUpstreamProto(cfg.UpstreamHost, cfg.UpstreamPort) == "socks5" {
		order = []string{"socks5", "http"}
	}

	var lastErr error
	attempt := 0
	for round := 0; round < 2 && attempt < upstreamMaxAttempts; round++ {
		for _, proto := range order {
			if attempt >= upstreamMaxAttempts {
				break
			}
			attempt++
			var (
				conn net.Conn
				err  error
			)
			if proto == "socks5" {
				conn, err = dialUpstreamSocks5(cfg, targetHost, targetPort)
			} else {
				conn, err = dialUpstreamOnce(cfg, targetHost, targetPort)
			}
			if err == nil {
				rememberUpstreamProto(cfg.UpstreamHost, cfg.UpstreamPort, proto)
				return conn, nil
			}
			lastErr = err
		}
	}
	return nil, lastErr
}

// raceUpstreamProtocols поднимает HTTP CONNECT и SOCKS5 одновременно и возвращает
// первое успешное соединение; проигравший (и все ошибки) закрываются.
func raceUpstreamProtocols(cfg *LoginConfig, targetHost string, targetPort int) (net.Conn, string, error) {
	type result struct {
		conn  net.Conn
		proto string
		err   error
	}
	results := make(chan result, 2)
	dialers := []struct {
		proto string
		dial  func(*LoginConfig, string, int) (net.Conn, error)
	}{
		{"http", dialUpstreamOnce},
		{"socks5", dialUpstreamSocks5},
	}
	for _, d := range dialers {
		go func(proto string, dial func(*LoginConfig, string, int) (net.Conn, error)) {
			conn, err := dial(cfg, targetHost, targetPort)
			results <- result{conn: conn, proto: proto, err: err}
		}(d.proto, d.dial)
	}

	var lastErr error
	for i := 0; i < len(dialers); i++ {
		r := <-results
		if r.err == nil {
			// Второй результат дочитаем в фоне и закроем его сокет, чтобы не течь.
			go func(remaining int) {
				for j := 0; j < remaining; j++ {
					if extra := <-results; extra.conn != nil {
						extra.conn.Close()
					}
				}
			}(len(dialers) - i - 1)
			return r.conn, r.proto, nil
		}
		lastErr = r.err
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("оба протокола апстрима недоступны")
	}
	return nil, "", lastErr
}

// dialUpstreamOnce — одна попытка: dial + CONNECT-хендшейк с дедлайном. При успехе
// дедлайн снимается (не влияет на туннель). При любой ошибке сокет закрывается.
func dialUpstreamOnce(cfg *LoginConfig, targetHost string, targetPort int) (net.Conn, error) {
	ipAddr := net.JoinHostPort(resolveUpstreamHost(cfg.UpstreamHost), strconv.Itoa(cfg.UpstreamPort))
	conn, err := net.DialTimeout("tcp", ipAddr, upstreamAttemptTimeout)
	if err != nil {
		// Кэш мог отдать недоступный IP (напр. AAAA без IPv6-связности).
		// Фолбэк: дать стандартному резолверу перебрать все адреса (dual-stack).
		hostAddr := net.JoinHostPort(cfg.UpstreamHost, strconv.Itoa(cfg.UpstreamPort))
		if hostAddr != ipAddr {
			conn, err = net.DialTimeout("tcp", hostAddr, upstreamAttemptTimeout)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("upstream dial: %w", err)
	}
	tuneConn(conn) // TCP_NODELAY на апстрим-сокете

	// Дедлайн на весь CONNECT-хендшейк — чтобы зависший узел не держал попытку.
	_ = conn.SetDeadline(time.Now().Add(upstreamAttemptTimeout))

	target := net.JoinHostPort(targetHost, strconv.Itoa(targetPort))
	req := "CONNECT " + target + " HTTP/1.1\r\n"
	req += "Host: " + target + "\r\n"
	if cfg.UpstreamUser != "" || cfg.UpstreamPass != "" {
		auth := base64.StdEncoding.EncodeToString([]byte(cfg.UpstreamUser + ":" + cfg.UpstreamPass))
		req += "Proxy-Authorization: Basic " + auth + "\r\n"
	}
	req += "\r\n"

	if _, err := conn.Write([]byte(req)); err != nil {
		conn.Close()
		return nil, fmt.Errorf("upstream write: %w", err)
	}

	br := bufio.NewReader(conn)
	statusLine, err := br.ReadString('\n')
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("upstream read status: %w", err)
	}
	if !strings.HasPrefix(statusLine, "HTTP/") {
		conn.Close()
		return nil, fmt.Errorf("upstream invalid response: %s", strings.TrimSpace(statusLine))
	}
	parts := strings.SplitN(strings.TrimSpace(statusLine), " ", 3)
	if len(parts) < 2 {
		conn.Close()
		return nil, fmt.Errorf("upstream malformed status: %s", statusLine)
	}
	code, _ := strconv.Atoi(parts[1])
	if code < 200 || code >= 300 {
		conn.Close()
		return nil, fmt.Errorf("upstream CONNECT failed: %s", strings.TrimSpace(statusLine))
	}

	for {
		line, err := br.ReadString('\n')
		if err != nil || line == "\r\n" || line == "\n" {
			break
		}
	}

	// Хендшейк прошёл — снимаем дедлайн, дальше туннель живёт без ограничения по времени.
	_ = conn.SetDeadline(time.Time{})
	return &bufferedConn{conn, br}, nil
}

// bufferedConn wraps conn that had bytes read into bufio.Reader
type bufferedConn struct {
	net.Conn
	br *bufio.Reader
}

func (b *bufferedConn) Read(p []byte) (int, error) {
	return b.br.Read(p)
}

func (b *bufferedConn) WriteTo(w io.Writer) (int64, error) {
	return b.br.WriteTo(w)
}
