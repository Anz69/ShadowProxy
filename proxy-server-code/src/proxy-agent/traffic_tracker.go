package main

import (
	"io"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/sirupsen/logrus"
)

// TrafficLog is sent to CORE
type TrafficLog struct {
	Timestamp time.Time `json:"timestamp"`
	User      string    `json:"user"`
	Port      int       `json:"port"`
	InBytes   int64     `json:"in_bytes"`
	OutBytes  int64     `json:"out_bytes"`
}

// TrafficBatch payload for CORE API
type TrafficBatch struct {
	ServerID  string       `json:"server_id"`
	Timestamp time.Time    `json:"timestamp"`
	Logs      []TrafficLog `json:"logs"`
	TotalIn   int64        `json:"total_in"`
	TotalOut  int64        `json:"total_out"`
}

type loginStats struct {
	bytesIn  int64
	bytesOut int64
}

// TrafficTracker counts bytes per login and sends to CORE
type TrafficTracker struct {
	config           *Config
	client           *resty.Client
	stats            map[string]*loginStats
	statsMu          sync.RWMutex
	lastReported     map[string]*loginStats
	lastReportedMu   sync.RWMutex
	auth             *AuthRegistry
	shutdown         chan struct{}
}

// NewTrafficTracker creates a new tracker
func NewTrafficTracker(config *Config, auth *AuthRegistry) *TrafficTracker {
	client := resty.New().
		SetBaseURL(config.CoreURL).
		SetHeader("Authorization", "Bearer "+config.AuthToken).
		SetHeader("Content-Type", "application/json").
		SetTimeout(10 * time.Second)

	return &TrafficTracker{
		config:       config,
		client:       client,
		auth:         auth,
		stats:        make(map[string]*loginStats),
		lastReported: make(map[string]*loginStats),
		shutdown:     make(chan struct{}),
	}
}

// AddBytes records bytes for a login (direction: "in" = client->server, "out" = server->client)
func (t *TrafficTracker) AddBytes(login, direction string, n int64) {
	if n <= 0 {
		return
	}
	t.statsMu.Lock()
	if t.stats[login] == nil {
		t.stats[login] = &loginStats{}
	}
	entry := t.stats[login]
	t.statsMu.Unlock()

	if direction == "in" {
		atomic.AddInt64(&entry.bytesIn, n)
	} else {
		atomic.AddInt64(&entry.bytesOut, n)
	}
}

// Stats returns live counters and the portion already acknowledged by CORE.
// The boolean is false when the login has never carried traffic.
func (t *TrafficTracker) Stats(login string) (inBytes, outBytes, reportedInBytes, reportedOutBytes int64, ok bool) {
	t.statsMu.RLock()
	entry := t.stats[login]
	if entry != nil {
		inBytes = atomic.LoadInt64(&entry.bytesIn)
		outBytes = atomic.LoadInt64(&entry.bytesOut)
		ok = true
	}
	t.statsMu.RUnlock()

	t.lastReportedMu.RLock()
	last := t.lastReported[login]
	if last != nil {
		reportedInBytes = last.bytesIn
		reportedOutBytes = last.bytesOut
	}
	t.lastReportedMu.RUnlock()

	return inBytes, outBytes, reportedInBytes, reportedOutBytes, ok
}

// getAndReset returns current stats and resets for next cycle (per-login delta)
func (t *TrafficTracker) getSnapshot() map[string]*loginStats {
	t.statsMu.Lock()
	defer t.statsMu.Unlock()

	snap := make(map[string]*loginStats)
	for k, v := range t.stats {
		snap[k] = &loginStats{
			bytesIn:  atomic.LoadInt64(&v.bytesIn),
			bytesOut: atomic.LoadInt64(&v.bytesOut),
		}
	}
	return snap
}

// Run starts the periodic send loop
func (t *TrafficTracker) Run() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-t.shutdown:
			return
		case <-ticker.C:
			t.sendBatch()
		}
	}
}

// Shutdown stops the tracker
func (t *TrafficTracker) Shutdown() {
	close(t.shutdown)
}

func (t *TrafficTracker) sendBatch() {
	snap := t.getSnapshot()
	if len(snap) == 0 {
		return
	}

	var logs []TrafficLog
	var totalIn, totalOut int64

	t.lastReportedMu.RLock()
	for login, s := range snap {
		last := t.lastReported[login]
		var inDelta, outDelta int64
		if last != nil {
			inDelta = s.bytesIn - last.bytesIn
			outDelta = s.bytesOut - last.bytesOut
		} else {
			inDelta = s.bytesIn
			outDelta = s.bytesOut
		}
		if inDelta > 0 || outDelta > 0 {
			port := 0
			if cfg := t.auth.Get(login); cfg != nil {
				port = cfg.Port
			}
			logs = append(logs, TrafficLog{
				Timestamp: time.Now(),
				User:      login,
				Port:      port,
				InBytes:   inDelta,
				OutBytes:  outDelta,
			})
			totalIn += inDelta
			totalOut += outDelta
		}
	}
	t.lastReportedMu.RUnlock()

	if len(logs) == 0 {
		return
	}

	batch := TrafficBatch{
		ServerID:  t.config.ServerID,
		Timestamp: time.Now(),
		Logs:      logs,
		TotalIn:   totalIn,
		TotalOut:  totalOut,
	}

	resp, err := t.client.R().SetBody(batch).Post("/api/proxy-node/traffic")
	if err != nil {
		logrus.Warnf("TrafficTracker: send failed: %v", err)
		return
	}
	if resp.StatusCode() != http.StatusOK {
		logrus.Warnf("TrafficTracker: CORE returned %d: %s", resp.StatusCode(), resp.String())
		return
	}

	t.lastReportedMu.Lock()
	for login, s := range snap {
		t.lastReported[login] = &loginStats{bytesIn: s.bytesIn, bytesOut: s.bytesOut}
	}
	t.lastReportedMu.Unlock()

	logrus.Infof("TrafficTracker: sent %d logs, in=%d out=%d", len(logs), totalIn, totalOut)
}

// countingConn wraps net.Conn to count bytes on Read (for tunnel traffic accounting)
type countingConn struct {
	conn     net.Conn
	login    string
	tracker  *TrafficTracker
	direction string
}

func (c *countingConn) Read(p []byte) (int, error) {
	n, err := c.conn.Read(p)
	if n > 0 {
		c.tracker.AddBytes(c.login, c.direction, int64(n))
	}
	return n, err
}

func (c *countingConn) Write(p []byte) (int, error) {
	return c.conn.Write(p)
}

func (c *countingConn) Close() error {
	return c.conn.Close()
}

// countingReader wraps io.Reader for tunnel traffic accounting (client->upstream via bufio)
type countingReader struct {
	r         io.Reader
	login     string
	tracker   *TrafficTracker
	direction string
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	if n > 0 {
		c.tracker.AddBytes(c.login, c.direction, int64(n))
	}
	return n, err
}

var _ io.Reader = (*countingConn)(nil)
var _ io.Reader = (*countingReader)(nil)
var _ io.Writer = (*countingConn)(nil)
