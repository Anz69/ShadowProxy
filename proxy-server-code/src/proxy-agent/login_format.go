package main

import (
	"regexp"
	"strings"
)

// ParsedLogin holds parsed components of login
// Format: package-{hash}-{provider_username} — provider_username от провайдера как есть
type ParsedLogin struct {
	PackageHash string // первые 8 символов sha256(packageId)
	Username    string // из user-* в provider part
	ProxyType   string
	Country     string
	SessionID   string
	FullLogin   string
}

// ParseLogin extracts package-{hash}- and optional user-, type-, geo-, sessid- from login
// Format: package-{hash}-{provider_username}
func ParseLogin(login string) *ParsedLogin {
	if login == "" {
		return nil
	}

	result := &ParsedLogin{FullLogin: login}

	// package-{8hex}-
	if strings.HasPrefix(login, "package-") {
		packageRe := regexp.MustCompile(`^package-([a-f0-9]{8})-`)
		if m := packageRe.FindStringSubmatch(login); len(m) >= 2 {
			result.PackageHash = m[1]
		}
	}

	userRe := regexp.MustCompile(`user-([^-]+)(?:-|$)`)
	if m := userRe.FindStringSubmatch(login); len(m) >= 2 {
		result.Username = m[1]
	}

	typeRe := regexp.MustCompile(`type-([^-]+)(?:-|$)`)
	if m := typeRe.FindStringSubmatch(login); len(m) >= 2 {
		result.ProxyType = m[1]
	}

	geoRe := regexp.MustCompile(`geo-([a-zA-Z]{2})(?:-|$)`)
	if m := geoRe.FindStringSubmatch(login); len(m) >= 2 {
		result.Country = strings.ToLower(m[1])
	}

	sessRe := regexp.MustCompile(`sessid-([^-]+)(?:-|$)`)
	if m := sessRe.FindStringSubmatch(login); len(m) >= 2 {
		result.SessionID = m[1]
	}

	return result
}
