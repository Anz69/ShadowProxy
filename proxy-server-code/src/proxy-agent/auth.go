package main

import (
	"sync"

	"github.com/sirupsen/logrus"
)

// LoginConfig holds configuration for a registered login
type LoginConfig struct {
	Login        string
	Password     string
	Port         int
	UserID       string
	UpstreamHost string
	UpstreamPort int
	UpstreamUser string
	UpstreamPass string
	Blocked      bool
	// Квота от CORE: сколько байт (in+out) ещё можно пропустить с момента активации.
	// LimitEnabled=false — лимит не передан (провайдерский учёт), не ограничиваем.
	LimitEnabled bool
	BytesLimit   int64
	// Счётчики трекера на момент установки лимита — отсчёт идёт от них.
	LimitBaseIn  int64
	LimitBaseOut int64
}

// AuthRegistry validates credentials against registered logins
type AuthRegistry struct {
	logins map[string]*LoginConfig
	mu     sync.RWMutex
}

// NewAuthRegistry creates a new auth registry
func NewAuthRegistry() *AuthRegistry {
	return &AuthRegistry{
		logins: make(map[string]*LoginConfig),
	}
}

// Validate returns LoginConfig if credentials are valid, nil otherwise
func (r *AuthRegistry) Validate(login, password string) *LoginConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cfg, ok := r.logins[login]
	if !ok {
		logrus.Warnf("Auth failed: login %q not in registry (have %d logins)", login, len(r.logins))
		return nil
	}
	if cfg.Blocked {
		logrus.Warnf("Auth failed: login %q is blocked", login)
		return nil
	}
	if cfg.Password != password {
		logrus.Warnf("Auth failed: login %q wrong password", login)
		return nil
	}
	return cfg
}

// AddOrUpdate adds or updates a login config
func (r *AuthRegistry) AddOrUpdate(cfg *LoginConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()

	existing := r.logins[cfg.Login]
	if existing != nil {
		cfg.Blocked = existing.Blocked
	}
	r.logins[cfg.Login] = cfg
	logrus.Debugf("Auth: added/updated login %s", cfg.Login)
}

// ActivatePort upserts login for proxy traffic from core /add-port.
// Always clears Blocked — повторная активация после неудачного health-check не должна оставлять логин «вечно заблокированным».
func (r *AuthRegistry) ActivatePort(cfg *LoginConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()
	cfg.Blocked = false
	r.logins[cfg.Login] = cfg
	logrus.Debugf("Auth: activated login %s (block cleared)", cfg.Login)
}

// SetBlocked marks a login as blocked
func (r *AuthRegistry) SetBlocked(login string, blocked bool) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	cfg, ok := r.logins[login]
	if !ok {
		return false
	}
	cfg.Blocked = blocked
	return true
}

// LimitReached reports whether the login has consumed its CORE-provided quota.
// Totals are the tracker's live counters for the login.
func (r *AuthRegistry) LimitReached(login string, totalIn, totalOut int64) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	cfg, ok := r.logins[login]
	if !ok || !cfg.LimitEnabled || cfg.Blocked {
		return false
	}
	used := (totalIn - cfg.LimitBaseIn) + (totalOut - cfg.LimitBaseOut)
	return used >= cfg.BytesLimit
}

// BlockOnce marks the login blocked and reports whether this call did it
// (false when unknown or already blocked), so the caller closes connections once.
func (r *AuthRegistry) BlockOnce(login string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	cfg, ok := r.logins[login]
	if !ok || cfg.Blocked {
		return false
	}
	cfg.Blocked = true
	return true
}

// Get returns config by login
func (r *AuthRegistry) Get(login string) *LoginConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.logins[login]
}

// ReplaceAll replaces entire registry (for sync_active_ports)
func (r *AuthRegistry) ReplaceAll(configs []*LoginConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.logins = make(map[string]*LoginConfig)
	for _, cfg := range configs {
		r.logins[cfg.Login] = cfg
	}
	logrus.Infof("Auth: replaced registry with %d logins", len(configs))
}

// All returns copy of all configs
func (r *AuthRegistry) All() []*LoginConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]*LoginConfig, 0, len(r.logins))
	for _, cfg := range r.logins {
		cp := *cfg
		result = append(result, &cp)
	}
	return result
}
