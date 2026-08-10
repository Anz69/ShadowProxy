package main

import (
	"bufio"
	"net"
	"strconv"

	"github.com/sirupsen/logrus"
)

// ProxyListener accepts connections on proxy port and dispatches to protocol detector
type ProxyListener struct {
	config   *Config
	auth     *AuthRegistry
	tracker  *TrafficTracker
	connMgr  *ConnectionManager
	listener net.Listener
}

// NewProxyListener creates a new proxy listener
func NewProxyListener(config *Config, auth *AuthRegistry, tracker *TrafficTracker, connMgr *ConnectionManager) *ProxyListener {
	return &ProxyListener{
		config:  config,
		auth:    auth,
		tracker: tracker,
		connMgr: connMgr,
	}
}

// Start begins listening on proxy port
func (p *ProxyListener) Start() error {
	addr := "0.0.0.0:" + strconv.Itoa(p.config.ProxyPort)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	p.listener = ln
	logrus.Infof("Proxy listening on %s", addr)

	go p.acceptLoop()
	return nil
}

// Stop closes the listener
func (p *ProxyListener) Stop() error {
	if p.listener != nil {
		return p.listener.Close()
	}
	return nil
}

func (p *ProxyListener) acceptLoop() {
	for {
		conn, err := p.listener.Accept()
		if err != nil {
			logrus.Debugf("Accept error: %v", err)
			return
		}
		br := bufio.NewReader(conn)
		go DetectAndDispatch(conn, br, p.auth, p.tracker, p.connMgr)
	}
}
