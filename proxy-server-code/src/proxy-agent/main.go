package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
)

func main() {
	coreURL := flag.String("core-url", "http://localhost:3000", "CORE server URL")
	authToken := flag.String("auth-token", "", "Auth token for API")
	proxyPort := flag.Int("proxy-port", 10000, "Proxy listener port")
	apiPort := flag.Int("api-port", 808, "API server port")
	serverID := flag.String("server-id", "proxy-server-v2", "Server ID for traffic reports")
	debug := flag.Bool("debug", false, "Enable debug logging")
	debugLogin := flag.String("debug-login", "", "Test login for debugging (env: DEBUG_LOGIN)")
	debugPassword := flag.String("debug-password", "", "Test password for debugging (env: DEBUG_PASSWORD)")
	skipCoreRegister := flag.Bool("skip-core-register", false, "Do not request active-port sync from CORE at startup")
	flag.Parse()

	// Debug login: only when DEBUG_LOGIN_ENABLED=1 (allows runtime config via /etc/default)
	if os.Getenv("DEBUG_LOGIN_ENABLED") == "1" {
		if *debugLogin == "" {
			*debugLogin = strings.TrimSpace(os.Getenv("DEBUG_LOGIN"))
		}
		if *debugPassword == "" {
			*debugPassword = strings.TrimSpace(os.Getenv("DEBUG_PASSWORD"))
		}
		if *debugLogin == "" {
			*debugLogin = "debug"
		}
		if *debugPassword == "" {
			*debugPassword = "debug123"
		}
	} else {
		*debugLogin = ""
		*debugPassword = ""
	}

	if *debug {
		logrus.SetLevel(logrus.DebugLevel)
	}
	logrus.SetFormatter(&logrus.JSONFormatter{})

	config := &Config{
		CoreURL:   strings.TrimSuffix(strings.TrimSpace(*coreURL), "/"),
		AuthToken: strings.TrimSpace(*authToken),
		ProxyPort: *proxyPort,
		APIPort:   *apiPort,
		ServerID:  strings.TrimSpace(*serverID),
	}
	if config.AuthToken == "" {
		logrus.Fatal("auth-token is required")
	}

	auth := NewAuthRegistry()
	if *debugLogin != "" && *debugPassword != "" {
		cfg := &LoginConfig{
			Login:        *debugLogin,
			Password:     *debugPassword,
			Port:         config.ProxyPort,
			UserID:       "debug",
			UpstreamHost: strings.TrimSpace(os.Getenv("DEBUG_UPSTREAM_HOST")),
			UpstreamUser: strings.TrimSpace(os.Getenv("DEBUG_UPSTREAM_USER")),
			UpstreamPass: strings.TrimSpace(os.Getenv("DEBUG_UPSTREAM_PASSWORD")),
		}
		if p := strings.TrimSpace(os.Getenv("DEBUG_UPSTREAM_PORT")); p != "" {
			if port, err := strconv.Atoi(p); err == nil {
				cfg.UpstreamPort = port
			}
		}
		auth.AddOrUpdate(cfg)
		upstreamInfo := "direct"
		if cfg.UpstreamHost != "" && cfg.UpstreamPort > 0 {
			upstreamInfo = fmt.Sprintf("%s:%d", cfg.UpstreamHost, cfg.UpstreamPort)
		}
		logrus.Infof("Debug login enabled: %s (upstream: %s)", *debugLogin, upstreamInfo)
	}
	connMgr := NewConnectionManager()
	tracker := NewTrafficTracker(config, auth)
	proxyListener := NewProxyListener(config, auth, tracker, connMgr)
	apiServer := NewAPIServer(config, auth, connMgr, tracker)

	if err := proxyListener.Start(); err != nil {
		logrus.Fatalf("Proxy listener failed: %v", err)
	}

	go tracker.Run()
	defer tracker.Shutdown()

	go func() {
		if err := apiServer.Start(); err != nil && err != os.ErrClosed {
			logrus.Errorf("API server error: %v", err)
		}
	}()

	if !*skipCoreRegister {
		go func() {
			// The API listener must be ready before CORE sends the authoritative
			// active-port snapshot after a restart.
			time.Sleep(2 * time.Second)
			notifyCoreAfterStart(config)
		}()
	}

	logrus.Info("Proxy agent v2 started")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	logrus.Info("Shutting down...")
	proxyListener.Stop()
	tracker.sendBatch()
	apiServer.Stop()
	logrus.Info("Shutdown complete")
}
