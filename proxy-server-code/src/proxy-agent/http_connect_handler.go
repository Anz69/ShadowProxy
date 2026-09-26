package main

import (
	"bufio"
	"encoding/base64"
	"io"
	"net"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"github.com/sirupsen/logrus"
)

// HandleHTTPConnect processes HTTP CONNECT and GET/POST/HEAD (for Dolphin HTTP proxy check)
func HandleHTTPConnect(conn net.Conn, br *bufio.Reader, auth *AuthRegistry, tracker *TrafficTracker, connMgr *ConnectionManager) {
	defer conn.Close()

	req, rawReq, err := readHTTPRequest(br)
	if err != nil {
		logrus.Debugf("HTTP read failed: %v", err)
		conn.Write([]byte("HTTP/1.1 400 Bad Request\r\n\r\n"))
		return
	}

	login, password := req.login, req.password
	if login == "" || password == "" {
		conn.Write([]byte("HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm=\"proxy\"\r\n\r\n"))
		return
	}

	cfg := auth.Validate(login, password)
	if cfg == nil {
		conn.Write([]byte("HTTP/1.1 403 Forbidden\r\n\r\n"))
		return
	}

	// GET/POST/HEAD с http:// URL — Dolphin проверяет прокси так
	if req.method != "CONNECT" && (req.method == "GET" || req.method == "POST" || req.method == "HEAD") {
		if strings.HasPrefix(req.target, "http://") || strings.HasPrefix(req.target, "https://") {
			handleHTTPForward(conn, br, req, rawReq, cfg, auth, tracker, connMgr)
			return
		}
	}

	if req.method != "CONNECT" {
		conn.Write([]byte("HTTP/1.1 405 Method Not Allowed\r\n\r\n"))
		return
	}

	host, portStr, err := net.SplitHostPort(req.target)
	if err != nil {
		conn.Write([]byte("HTTP/1.1 400 Bad Request\r\n\r\n"))
		return
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		conn.Write([]byte("HTTP/1.1 400 Bad Request\r\n\r\n"))
		return
	}

	upstreamConn, err := ConnectUpstream(cfg, host, port)
	if err != nil {
		logrus.Warnf("HTTP CONNECT upstream failed: %v", err)
		conn.Write([]byte("HTTP/1.1 502 Bad Gateway\r\n\r\n"))
		return
	}
	defer upstreamConn.Close()

	tuneConn(conn) // TCP_NODELAY на клиентском сокете (ТЗ п.7.2)
	conn.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))

	connMgr.Add(login, conn)
	defer connMgr.Remove(login, conn)

	// Используем br для чтения — после заголовков в нём может быть TLS ClientHello (Chrome/Dolphin)
	clientIn := &countingReader{br, login, tracker, "in"}
	upstreamOut := &countingConn{upstreamConn, login, tracker, "out"}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		io.Copy(upstreamConn, clientIn)
	}()
	go func() {
		defer wg.Done()
		io.Copy(conn, upstreamOut)
	}()
	wg.Wait()
}

// handleHTTPForward проксирует GET/POST/HEAD через upstream (для Dolphin HTTP check)
func handleHTTPForward(conn net.Conn, _ *bufio.Reader, req *httpRequest, rawReq []byte, cfg *LoginConfig, _ *AuthRegistry, tracker *TrafficTracker, _ *ConnectionManager) {
	parsed, err := url.Parse(req.target)
	if err != nil {
		conn.Write([]byte("HTTP/1.1 400 Bad Request\r\n\r\n"))
		return
	}
	host := parsed.Hostname()
	portStr := parsed.Port()
	if portStr == "" {
		if parsed.Scheme == "https" {
			portStr = "443"
		} else {
			portStr = "80"
		}
	}
	port, _ := strconv.Atoi(portStr)

	upstreamConn, err := ConnectUpstream(cfg, host, port)
	if err != nil {
		logrus.Warnf("HTTP forward upstream failed: %v", err)
		conn.Write([]byte("HTTP/1.1 502 Bad Gateway\r\n\r\n"))
		return
	}
	defer upstreamConn.Close()

	if _, err := upstreamConn.Write(rawReq); err != nil {
		return
	}
	// Client request bytes are traffic in; the response below is traffic out.
	tracker.AddBytes(cfg.Login, "in", int64(len(rawReq)))

	// Пересылаем ответ клиенту и учитываем его полностью. Раньше HTTP-forward
	// учитывал только заголовки запроса, из-за чего часть трафика терялась.
	upstreamOut := &countingConn{upstreamConn, cfg.Login, tracker, "out"}
	io.Copy(conn, upstreamOut)
}

type httpRequest struct {
	method  string
	target  string
	login   string
	password string
}

func readHTTPRequest(br *bufio.Reader) (*httpRequest, []byte, error) {
	var raw strings.Builder
	line, err := br.ReadString('\n')
	if err != nil {
		return nil, nil, err
	}
	raw.WriteString(line)
	line = strings.TrimSpace(line)
	parts := strings.SplitN(line, " ", 3)
	if len(parts) < 3 {
		return nil, nil, io.EOF
	}

	req := &httpRequest{method: parts[0], target: parts[1]}

	for {
		line, err := br.ReadString('\n')
		if err != nil {
			return nil, nil, err
		}
		raw.WriteString(line)
		if line == "\r\n" || line == "\n" {
			break
		}
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(strings.ToLower(trimmed), "proxy-authorization:") {
			rest := strings.TrimSpace(trimmed[len("proxy-authorization:"):])
			if strings.HasPrefix(strings.ToLower(rest), "basic ") {
				encoded := strings.TrimSpace(rest[6:])
				decoded, err := base64.StdEncoding.DecodeString(encoded)
				if err == nil {
					userPass := strings.SplitN(string(decoded), ":", 2)
					if len(userPass) >= 2 {
						req.login = userPass[0]
						req.password = userPass[1]
					}
				}
			}
		}
		if strings.HasPrefix(strings.ToLower(trimmed), "authorization:") {
			if req.login == "" {
				rest := strings.TrimSpace(trimmed[len("authorization:"):])
				if strings.HasPrefix(strings.ToLower(rest), "basic ") {
					encoded := strings.TrimSpace(rest[6:])
					decoded, err := base64.StdEncoding.DecodeString(encoded)
					if err == nil {
						userPass := strings.SplitN(string(decoded), ":", 2)
						if len(userPass) >= 2 {
							req.login = userPass[0]
							req.password = userPass[1]
						}
					}
				}
			}
		}
	}

	return req, []byte(raw.String()), nil
}
