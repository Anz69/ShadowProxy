package main

import (
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"strconv"
	"time"
)

// FlashProxy (Residential Lite, ISP EU, ISP USA) отдаёт SOCKS5 на тех же портах,
// что и HTTP (6969/9696, 30/31). HTTP CONNECT у апстрима периодически отвечает
// 407 Proxy Authentication Required или просто висит до таймаута, хотя SOCKS5 с
// теми же кредами устанавливает туннель. Из-за этого гейтвей отдавал клиентам
// 502 при живом аккаунте провайдера.
//
// Поэтому агент умеет ходить обоими протоколами: пробует HTTP CONNECT, а если он
// не поднял туннель — тот же host:port через SOCKS5. Ничего в БД менять не нужно.

// dialUpstreamSocks5 — одна попытка: TCP + SOCKS5-хендшейк (user/pass) + CONNECT.
func dialUpstreamSocks5(cfg *LoginConfig, targetHost string, targetPort int) (net.Conn, error) {
	ipAddr := net.JoinHostPort(resolveUpstreamHost(cfg.UpstreamHost), strconv.Itoa(cfg.UpstreamPort))
	conn, err := net.DialTimeout("tcp", ipAddr, upstreamAttemptTimeout)
	if err != nil {
		// Кэш DNS мог отдать недоступный IP — пусть стандартный резолвер переберёт все.
		hostAddr := net.JoinHostPort(cfg.UpstreamHost, strconv.Itoa(cfg.UpstreamPort))
		if hostAddr != ipAddr {
			conn, err = net.DialTimeout("tcp", hostAddr, upstreamAttemptTimeout)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("socks5 dial: %w", err)
	}
	tuneConn(conn)

	_ = conn.SetDeadline(time.Now().Add(upstreamAttemptTimeout))
	if err := socks5Handshake(conn, cfg.UpstreamUser, cfg.UpstreamPass, targetHost, targetPort); err != nil {
		conn.Close()
		return nil, fmt.Errorf("socks5: %w", err)
	}
	// Туннель поднят — снимаем дедлайн, дальше соединение живёт без ограничения.
	_ = conn.SetDeadline(time.Time{})
	return conn, nil
}

// socks5Handshake выполняет приветствие, аутентификацию (если переданы креды)
// и запрос CONNECT к targetHost:targetPort.
func socks5Handshake(conn net.Conn, user, pass, host string, port int) error {
	methods := []byte{0x00}
	if user != "" || pass != "" {
		methods = []byte{0x00, 0x02} // no-auth + username/password
	}
	greeting := append([]byte{0x05, byte(len(methods))}, methods...)
	if _, err := conn.Write(greeting); err != nil {
		return fmt.Errorf("greeting write: %w", err)
	}

	sel := make([]byte, 2)
	if _, err := io.ReadFull(conn, sel); err != nil {
		return fmt.Errorf("greeting read: %w", err)
	}
	if sel[0] != 0x05 {
		return fmt.Errorf("unexpected version %d", sel[0])
	}
	switch sel[1] {
	case 0x00:
		// без аутентификации
	case 0x02:
		if err := socks5UserPass(conn, user, pass); err != nil {
			return err
		}
	case 0xFF:
		return fmt.Errorf("upstream rejected auth methods")
	default:
		return fmt.Errorf("unsupported auth method %d", sel[1])
	}

	// CONNECT: VER CMD RSV ATYP ADDR PORT
	hostBytes := []byte(host)
	req := []byte{0x05, 0x01, 0x00, 0x03, byte(len(hostBytes))}
	req = append(req, hostBytes...)
	portBytes := make([]byte, 2)
	binary.BigEndian.PutUint16(portBytes, uint16(port))
	req = append(req, portBytes...)
	if _, err := conn.Write(req); err != nil {
		return fmt.Errorf("connect write: %w", err)
	}

	head := make([]byte, 4)
	if _, err := io.ReadFull(conn, head); err != nil {
		return fmt.Errorf("connect read: %w", err)
	}
	if head[0] != 0x05 {
		return fmt.Errorf("unexpected reply version %d", head[0])
	}
	if head[1] != 0x00 {
		return fmt.Errorf("CONNECT rejected, code %d", head[1])
	}

	// Дочитываем BND.ADDR + BND.PORT, иначе их байты попадут в туннель.
	var addrLen int
	switch head[3] {
	case 0x01:
		addrLen = 4
	case 0x04:
		addrLen = 16
	case 0x03:
		l := make([]byte, 1)
		if _, err := io.ReadFull(conn, l); err != nil {
			return fmt.Errorf("bound address read: %w", err)
		}
		addrLen = int(l[0])
	default:
		return fmt.Errorf("unexpected address type %d", head[3])
	}
	if _, err := io.ReadFull(conn, make([]byte, addrLen+2)); err != nil {
		return fmt.Errorf("bound address drain: %w", err)
	}
	return nil
}

// socks5UserPass — подметод 0x02 (RFC 1929).
func socks5UserPass(conn net.Conn, user, pass string) error {
	u := []byte(user)
	p := []byte(pass)
	if len(u) > 255 || len(p) > 255 {
		return fmt.Errorf("credentials too long")
	}
	req := []byte{0x01, byte(len(u))}
	req = append(req, u...)
	req = append(req, byte(len(p)))
	req = append(req, p...)
	if _, err := conn.Write(req); err != nil {
		return fmt.Errorf("auth write: %w", err)
	}
	res := make([]byte, 2)
	if _, err := io.ReadFull(conn, res); err != nil {
		return fmt.Errorf("auth read: %w", err)
	}
	if res[1] != 0x00 {
		return fmt.Errorf("auth failed, status %d", res[1])
	}
	return nil
}
