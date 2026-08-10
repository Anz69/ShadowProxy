package main

import (
	"bufio"
	"net"
)

// DetectAndDispatch reads first byte to determine protocol, then calls appropriate handler
func DetectAndDispatch(conn net.Conn, buf *bufio.Reader, auth *AuthRegistry, tracker *TrafficTracker, connMgr *ConnectionManager) {
	firstByte, err := buf.Peek(1)
	if err != nil {
		conn.Close()
		return
	}
	if firstByte[0] == 0x05 {
		HandleSOCKS5(conn, buf, auth, tracker, connMgr)
	} else {
		HandleHTTPConnect(conn, buf, auth, tracker, connMgr)
	}
}
