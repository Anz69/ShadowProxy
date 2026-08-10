package main

// Config holds agent configuration
type Config struct {
	CoreURL    string
	AuthToken  string
	ProxyPort  int
	APIPort    int
	ServerID   string
}
