package main

import (
	"net"
	"sync"

	"github.com/sirupsen/logrus"
)

// ConnectionManager tracks active connections per login for immediate block
type ConnectionManager struct {
	conns map[string]map[net.Conn]struct{}
	mu    sync.RWMutex
}

// NewConnectionManager creates a new connection manager
func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		conns: make(map[string]map[net.Conn]struct{}),
	}
}

// Add registers a connection for a login
func (m *ConnectionManager) Add(login string, conn net.Conn) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.conns[login] == nil {
		m.conns[login] = make(map[net.Conn]struct{})
	}
	m.conns[login][conn] = struct{}{}
}

// Remove unregisters a connection
func (m *ConnectionManager) Remove(login string, conn net.Conn) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if set, ok := m.conns[login]; ok {
		delete(set, conn)
		if len(set) == 0 {
			delete(m.conns, login)
		}
	}
}

// CloseAll closes all connections for a login (used on block)
func (m *ConnectionManager) CloseAll(login string) int {
	m.mu.Lock()
	set := m.conns[login]
	if set == nil {
		m.mu.Unlock()
		return 0
	}
	conns := make([]net.Conn, 0, len(set))
	for c := range set {
		conns = append(conns, c)
	}
	delete(m.conns, login)
	m.mu.Unlock()

	for _, c := range conns {
		c.Close()
	}
	logrus.Infof("ConnectionManager: closed %d connections for login %s", len(conns), login)
	return len(conns)
}
