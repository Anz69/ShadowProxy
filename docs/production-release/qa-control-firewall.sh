#!/bin/sh
set -eu
# The dev agent is local to the backend. Only localhost and the inspected
# Docker backend network may reach its management listener. SSH untouched.
iptables -N SHADOWPROXY_CONTROL 2>/dev/null || true
iptables -F SHADOWPROXY_CONTROL
iptables -A SHADOWPROXY_CONTROL -i lo -j ACCEPT
iptables -A SHADOWPROXY_CONTROL -s 172.20.0.0/16 -j ACCEPT
iptables -A SHADOWPROXY_CONTROL -j DROP
iptables -C INPUT -p tcp --dport 808 -j SHADOWPROXY_CONTROL 2>/dev/null ||
    iptables -I INPUT 1 -p tcp --dport 808 -j SHADOWPROXY_CONTROL
ip6tables -N SHADOWPROXY_CONTROL 2>/dev/null || true
ip6tables -F SHADOWPROXY_CONTROL
ip6tables -A SHADOWPROXY_CONTROL -i lo -j ACCEPT
ip6tables -A SHADOWPROXY_CONTROL -j DROP
ip6tables -C INPUT -p tcp --dport 808 -j SHADOWPROXY_CONTROL 2>/dev/null ||
    ip6tables -I INPUT 1 -p tcp --dport 808 -j SHADOWPROXY_CONTROL
