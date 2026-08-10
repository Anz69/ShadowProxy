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

// ConnectUpstream connects to provider HTTP proxy and establishes CONNECT tunnel to target.
// If UpstreamHost is empty, connects directly to target (debug/direct mode).
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

	var lastErr error
	for attempt := 0; attempt < upstreamMaxAttempts; attempt++ {
		conn, err := dialUpstreamOnce(cfg, targetHost, targetPort)
		if err == nil {
			return conn, nil
		}
		lastErr = err
	}
	return nil, lastErr
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
