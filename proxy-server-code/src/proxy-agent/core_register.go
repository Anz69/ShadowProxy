package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

// notifyCoreAfterStart asks CORE to send the authoritative active-port
// snapshot. The registry is in memory, so a process restart must not leave
// previously issued proxies unusable until a manual admin sync.
func notifyCoreAfterStart(cfg *Config) {
	base := strings.TrimSuffix(cfg.CoreURL, "/")
	endpoint := base + "/api/proxy-node/register"

	body := []byte("{}")
	if ip := strings.TrimSpace(os.Getenv("AGENT_PUBLIC_IP")); ip != "" {
		encoded, err := json.Marshal(map[string]string{"ip": ip})
		if err == nil {
			body = encoded
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		logrus.Warnf("[REGISTER] cannot create CORE request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.AuthToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		logrus.Warnf("[REGISTER] CORE unavailable: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logrus.Warnf("[REGISTER] CORE returned %s", resp.Status)
		return
	}
	logrus.Info("[REGISTER] CORE accepted gateway registration; active ports sync requested")
}
