package main

import (
	"bufio"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"time"

)

// ConnectUpstream connects to provider HTTP proxy and establishes CONNECT tunnel to target.
// If UpstreamHost is empty, connects directly to target (debug/direct mode).
func ConnectUpstream(cfg *LoginConfig, targetHost string, targetPort int) (net.Conn, error) {
	var conn net.Conn
	var err error
	if cfg.UpstreamHost == "" || cfg.UpstreamPort == 0 {
		// Direct mode: no upstream proxy, connect straight to target
		addr := net.JoinHostPort(targetHost, strconv.Itoa(targetPort))
		conn, err = net.DialTimeout("tcp", addr, 30*time.Second)
	} else {
		addr := fmt.Sprintf("%s:%d", cfg.UpstreamHost, cfg.UpstreamPort)
		conn, err = net.DialTimeout("tcp", addr, 30*time.Second)
	}
	if err != nil {
		return nil, fmt.Errorf("upstream dial: %w", err)
	}

	// Direct mode: already connected to target, no CONNECT handshake
	if cfg.UpstreamHost == "" || cfg.UpstreamPort == 0 {
		return conn, nil
	}

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
