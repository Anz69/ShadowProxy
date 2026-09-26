package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

// APIServer serves HTTP API for backend commands
type APIServer struct {
	config   *Config
	auth     *AuthRegistry
	connMgr  *ConnectionManager
	tracker  *TrafficTracker
	server   *http.Server
}

// NewAPIServer creates a new API server
func NewAPIServer(config *Config, auth *AuthRegistry, connMgr *ConnectionManager, tracker *TrafficTracker) *APIServer {
	return &APIServer{
		config:  config,
		auth:    auth,
		connMgr: connMgr,
		tracker: tracker,
	}
}

// Start begins listening on API port
func (s *APIServer) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.requireAuth(s.healthHandler))
	mux.HandleFunc("/add-port", s.requireAuth(s.addPortHandler))
	mux.HandleFunc("/add-ports", s.requireAuth(s.addPortsHandler))
	mux.HandleFunc("/sync_active_ports", s.requireAuth(s.syncActivePortsHandler))
	mux.HandleFunc("/stop", s.requireAuth(s.stopHandler))
	mux.HandleFunc("/block-login", s.requireAuth(s.blockLoginHandler))
	mux.HandleFunc("/traffic-stats", s.requireAuth(s.trafficStatsHandler))
	mux.HandleFunc("/test-proxy", s.testProxyHandler)

	addr := fmt.Sprintf("0.0.0.0:%d", s.config.APIPort)
	s.server = &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	logrus.Infof("API server listening on %s", addr)
	return s.server.ListenAndServe()
}

// Stop shuts down the server
func (s *APIServer) Stop() error {
	if s.server != nil {
		return s.server.Close()
	}
	return nil
}

func (s *APIServer) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token != s.config.AuthToken {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func (s *APIServer) healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	configs := s.auth.All()
	activeLogins := make([]map[string]interface{}, 0, len(configs))
	for _, c := range configs {
		if c.Blocked {
			continue
		}
		activeLogins = append(activeLogins, map[string]interface{}{
			"login":   c.Login,
			"port":    c.Port,
			"user_id": c.UserID,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       "ok",
		"message":      "Agent is healthy",
		"active_logins": activeLogins,
		"count":        len(activeLogins),
	})
}

type addPortPayload struct {
	Port          int    `json:"port"`
	UserID        string `json:"user_id"`
	Login         string `json:"login"`
	Password      string `json:"password"`
	ProxyHost     string `json:"proxy_host,omitempty"`
	ProxyPort     int    `json:"proxy_port,omitempty"`
	ProxyUsername string `json:"proxy_username,omitempty"`
	ProxyPassword string `json:"proxy_password,omitempty"`
}

func (s *APIServer) addPortHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var p addPortPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if p.Login == "" || p.Password == "" {
		http.Error(w, "login and password required", http.StatusBadRequest)
		return
	}
	cfg := &LoginConfig{
		Login:        p.Login,
		Password:     p.Password,
		Port:         p.Port,
		UserID:       p.UserID,
		UpstreamHost: p.ProxyHost,
		UpstreamPort: p.ProxyPort,
		UpstreamUser: p.ProxyUsername,
		UpstreamPass: p.ProxyPassword,
	}
	s.auth.ActivatePort(cfg)
	logrus.Infof("Added login %s", p.Login)
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Port %d added successfully", p.Port)
}

type addPortsPayload struct {
	Ports []addPortPayload `json:"ports"`
}

// addPortsHandler adds multiple ports at once (batch operation)
func (s *APIServer) addPortsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var p addPortsPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if len(p.Ports) == 0 {
		http.Error(w, "ports array required", http.StatusBadRequest)
		return
	}

	added := 0
	for _, port := range p.Ports {
		if port.Login == "" || port.Password == "" {
			continue
		}
		cfg := &LoginConfig{
			Login:        port.Login,
			Password:     port.Password,
			Port:         port.Port,
			UserID:       port.UserID,
			UpstreamHost: port.ProxyHost,
			UpstreamPort: port.ProxyPort,
			UpstreamUser: port.ProxyUsername,
			UpstreamPass: port.ProxyPassword,
		}
		s.auth.ActivatePort(cfg)
		added++
	}

	logrus.Infof("Batch added %d logins", added)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"added":   added,
		"message": fmt.Sprintf("Added %d ports successfully", added),
	})
}

type syncPayload struct {
	ActivePorts []struct {
		Port          int    `json:"port"`
		UserID        string `json:"user_id"`
		Login         string `json:"login"`
		Password      string `json:"password"`
		ProxyHost     string `json:"proxy_host,omitempty"`
		ProxyPort     int    `json:"proxy_port,omitempty"`
		ProxyUsername string `json:"proxy_username,omitempty"`
		ProxyPassword string `json:"proxy_password,omitempty"`
	} `json:"activePorts"`
	Timestamp int64 `json:"timestamp"`
}

func (s *APIServer) syncActivePortsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var p syncPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	configs := make([]*LoginConfig, 0, len(p.ActivePorts))
	for _, item := range p.ActivePorts {
		if item.Login == "" {
			continue
		}
		configs = append(configs, &LoginConfig{
			Login:        item.Login,
			Password:     item.Password,
			Port:         item.Port,
			UserID:       item.UserID,
			UpstreamHost: item.ProxyHost,
			UpstreamPort: item.ProxyPort,
			UpstreamUser: item.ProxyUsername,
			UpstreamPass: item.ProxyPassword,
		})
	}
	s.auth.ReplaceAll(configs)
	logrus.Infof("Sync: replaced with %d logins", len(configs))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"message":   fmt.Sprintf("Synchronized %d logins", len(configs)),
		"timestamp": p.Timestamp,
	})
}

type stopPayload struct {
	Port int `json:"port"`
}

func (s *APIServer) stopHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var p stopPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	logrus.Infof("Stop port %d (v2: no-op, use block-login for blocking)", p.Port)
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Port %d stop acknowledged", p.Port)
}

type blockLoginPayload struct {
	Login string `json:"login"`
}

func (s *APIServer) blockLoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var p blockLoginPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	if p.Login == "" {
		http.Error(w, "login required", http.StatusBadRequest)
		return
	}
	ok := s.auth.SetBlocked(p.Login, true)
	if !ok {
		http.Error(w, "login not found", http.StatusNotFound)
		return
	}
	closed := s.connMgr.CloseAll(p.Login)
	logrus.Infof("Blocked login %s, closed %d connections", p.Login, closed)
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Login %s blocked, %d connections closed", p.Login, closed)
}

// trafficStatsHandler returns live and already reported byte counters for one login.
// It is intentionally authenticated and exposes no credentials or upstream details.
func (s *APIServer) trafficStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	login := strings.TrimSpace(r.URL.Query().Get("login"))
	if login == "" {
		http.Error(w, "login required", http.StatusBadRequest)
		return
	}
	if s.tracker == nil {
		http.Error(w, "traffic tracker unavailable", http.StatusServiceUnavailable)
		return
	}
	inBytes, outBytes, reportedInBytes, reportedOutBytes, ok := s.tracker.Stats(login)
	if !ok {
		inBytes, outBytes, reportedInBytes, reportedOutBytes = 0, 0, 0, 0
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"login":                login,
		"in_bytes":             inBytes,
		"out_bytes":            outBytes,
		"reported_in_bytes":    reportedInBytes,
		"reported_out_bytes":   reportedOutBytes,
	})
}

// testProxyHandler checks if login:password works via HTTP CONNECT
// GET /test-proxy?login=xxx&password=yyy  or  POST JSON {"login":"xxx","password":"yyy"}
func (s *APIServer) testProxyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var login, password string
	if r.Method == http.MethodPost {
		var p struct {
			Login    string `json:"login"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			json.NewEncoder(w).Encode(map[string]interface{}{"ok": false, "error": "invalid JSON"})
			return
		}
		login, password = p.Login, p.Password
	} else {
		login = r.URL.Query().Get("login")
		password = r.URL.Query().Get("password")
	}
	if login == "" || password == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{"ok": false, "error": "login and password required"})
		return
	}

	proxyURL := &url.URL{
		Scheme: "http",
		Host:   fmt.Sprintf("127.0.0.1:%d", s.config.ProxyPort),
		User:   url.UserPassword(login, password),
	}

	client := &http.Client{
		Transport: &http.Transport{Proxy: http.ProxyURL(proxyURL)},
		Timeout:   15 * time.Second,
	}
	resp, err := client.Get("https://httpbin.org/ip")
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"ok": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		json.NewEncoder(w).Encode(map[string]interface{}{"ok": false, "error": fmt.Sprintf("http %d", resp.StatusCode)})
		return
	}

	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)
	json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "origin": body["origin"], "message": "proxy works"})
}
