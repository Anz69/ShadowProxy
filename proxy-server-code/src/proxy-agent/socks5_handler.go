package main

import (
	"bufio"
	"encoding/binary"
	"io"
	"net"
	"sync"

	"github.com/sirupsen/logrus"
)

// HandleSOCKS5 processes SOCKS5 connection with username/password auth
func HandleSOCKS5(conn net.Conn, br *bufio.Reader, auth *AuthRegistry, tracker *TrafficTracker, connMgr *ConnectionManager) {
	defer conn.Close()

	// 1. Client: VER(5) NMETHODS METHODS
	header := make([]byte, 2)
	if _, err := io.ReadFull(br, header); err != nil {
		return
	}
	if header[0] != 5 {
		return
	}
	nmethods := int(header[1])
	methods := make([]byte, nmethods)
	if _, err := io.ReadFull(br, methods); err != nil {
		return
	}
	hasUserPass := false
	for _, m := range methods {
		if m == 2 {
			hasUserPass = true
			break
		}
	}
	if !hasUserPass {
		conn.Write([]byte{5, 0xFF})
		return
	}

	// 2. Server: VER(5) METHOD 0x02
	if _, err := conn.Write([]byte{5, 2}); err != nil {
		return
	}

	// 3. Client: VER(1) ULEN UNAME PLEN PASSWD
	authVer := make([]byte, 1)
	if _, err := io.ReadFull(br, authVer); err != nil || authVer[0] != 1 {
		conn.Write([]byte{1, 1})
		return
	}
	ulen := make([]byte, 1)
	if _, err := io.ReadFull(br, ulen); err != nil {
		conn.Write([]byte{1, 1})
		return
	}
	uname := make([]byte, int(ulen[0]))
	if _, err := io.ReadFull(br, uname); err != nil {
		conn.Write([]byte{1, 1})
		return
	}
	plen := make([]byte, 1)
	if _, err := io.ReadFull(br, plen); err != nil {
		conn.Write([]byte{1, 1})
		return
	}
	passwd := make([]byte, int(plen[0]))
	if _, err := io.ReadFull(br, passwd); err != nil {
		conn.Write([]byte{1, 1})
		return
	}

	login := string(uname)
	password := string(passwd)
	cfg := auth.Validate(login, password)
	if cfg == nil {
		conn.Write([]byte{1, 1})
		return
	}

	// 4. Server: VER(1) STATUS 0
	if _, err := conn.Write([]byte{1, 0}); err != nil {
		return
	}

	// 5. Client: VER CMD RSV ATYP DST.ADDR DST.PORT
	req := make([]byte, 4)
	if _, err := io.ReadFull(br, req); err != nil {
		return
	}
	if req[1] != 1 {
		conn.Write([]byte{5, 7, 0, 1, 0, 0, 0, 0, 0, 0})
		return
	}
	var targetHost string
	var targetPort int
	atyp := req[3]
	switch atyp {
	case 1:
		ip := make([]byte, 4)
		if _, err := io.ReadFull(br, ip); err != nil {
			return
		}
		targetHost = net.IP(ip).String()
	case 3:
		alen := make([]byte, 1)
		if _, err := io.ReadFull(br, alen); err != nil {
			return
		}
		domain := make([]byte, alen[0])
		if _, err := io.ReadFull(br, domain); err != nil {
			return
		}
		targetHost = string(domain)
	case 4:
		ip := make([]byte, 16)
		if _, err := io.ReadFull(br, ip); err != nil {
			return
		}
		targetHost = net.IP(ip).String()
	default:
		conn.Write([]byte{5, 8, 0, 1, 0, 0, 0, 0, 0, 0})
		return
	}
	portB := make([]byte, 2)
	if _, err := io.ReadFull(br, portB); err != nil {
		return
	}
	targetPort = int(binary.BigEndian.Uint16(portB))

	upstreamConn, err := ConnectUpstream(cfg, targetHost, targetPort)
	if err != nil {
		logrus.Warnf("SOCKS5 upstream connect failed: %v", err)
		conn.Write([]byte{5, 4, 0, 1, 0, 0, 0, 0, 0, 0})
		return
	}
	defer upstreamConn.Close()

	// 6. Server: VER(5) REP(0) RSV ATYP BND.ADDR BND.PORT
	conn.Write([]byte{5, 0, 0, 1, 0, 0, 0, 0, 0, 0})

	connMgr.Add(login, conn)
	defer connMgr.Remove(login, conn)

	clientIn := &countingConn{conn, login, tracker, "in"}
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
