package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func TestSendBatchRetriesSameIDAndKeepsNewBytesForNextBatch(t *testing.T) {
	var mu sync.Mutex
	var batchIDs []string
	var receivedBatches []TrafficBatch
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		var batch TrafficBatch
		if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
			t.Errorf("decode batch: %v", err)
		}
		mu.Lock()
		batchIDs = append(batchIDs, batch.BatchID)
		receivedBatches = append(receivedBatches, batch)
		requests++
		request := requests
		mu.Unlock()

		if request == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	auth := NewAuthRegistry()
	auth.AddOrUpdate(&LoginConfig{Login: "qa-login", Port: 10000})
	tracker := NewTrafficTracker(&Config{CoreURL: server.URL, AuthToken: "test-token", ServerID: "test-node"}, auth)
	tracker.AddBytes("qa-login", "in", 1000)

	tracker.sendBatch() // Simulate commit/ACK failure; must retain this exact request.
	tracker.AddBytes("qa-login", "in", 500)
	tracker.sendBatch() // Retry the same batch before creating another one.
	tracker.sendBatch() // Newly observed bytes become a distinct next batch.

	if len(batchIDs) != 3 {
		t.Fatalf("got %d requests, want 3", len(batchIDs))
	}
	if batchIDs[0] == "" || batchIDs[0] != batchIDs[1] {
		t.Fatalf("retry batch IDs differ or are empty: %q vs %q", batchIDs[0], batchIDs[1])
	}
	if batchIDs[2] == batchIDs[1] {
		t.Fatalf("new bytes reused acknowledged batch ID %q", batchIDs[2])
	}

	if len(receivedBatches[0].Logs) != 1 || len(receivedBatches[1].Logs) != 1 {
		t.Fatalf("retry payloads should each contain one login record: first=%+v retry=%+v", receivedBatches[0].Logs, receivedBatches[1].Logs)
	}
	if receivedBatches[0].Logs[0].InBytes != 1000 || receivedBatches[1].Logs[0].InBytes != 1000 {
		t.Fatalf("retry changed the original byte count: first=%d retry=%d", receivedBatches[0].Logs[0].InBytes, receivedBatches[1].Logs[0].InBytes)
	}
	if len(receivedBatches[2].Logs) != 1 || receivedBatches[2].Logs[0].InBytes != 500 {
		t.Fatalf("bytes observed during retry were not isolated in the next batch: %+v", receivedBatches[2].Logs)
	}

	inBytes, _, reportedIn, _, ok := tracker.Stats("qa-login")
	if !ok || inBytes != 1500 || reportedIn != 1500 {
		t.Fatalf("unexpected counters: live=%d reported=%d exists=%t", inBytes, reportedIn, ok)
	}
}

func TestCountingWrappersAccountBytesForwardedInBothDirections(t *testing.T) {
	tracker := NewTrafficTracker(&Config{CoreURL: "http://127.0.0.1"}, NewAuthRegistry())
	payload := "payload forwarded through the tunnel"
	clientSide, upstreamSide := net.Pipe()
	defer clientSide.Close()
	defer upstreamSide.Close()

	go func() {
		_, _ = upstreamSide.Write([]byte(payload))
		_ = upstreamSide.Close()
	}()

	var received bytes.Buffer
	outbound := &countingConn{conn: clientSide, login: "qa-login", tracker: tracker, direction: "out"}
	if _, err := io.Copy(&received, outbound); err != nil {
		t.Fatalf("copy outbound tunnel bytes: %v", err)
	}
	if received.String() != payload {
		t.Fatalf("received %q, want %q", received.String(), payload)
	}

	inbound := &countingReader{r: strings.NewReader(payload), login: "qa-login", tracker: tracker, direction: "in"}
	if _, err := io.Copy(io.Discard, inbound); err != nil {
		t.Fatalf("copy inbound tunnel bytes: %v", err)
	}

	inBytes, outBytes, _, _, ok := tracker.Stats("qa-login")
	if !ok || inBytes != int64(len(payload)) || outBytes != int64(len(payload)) {
		t.Fatalf("unexpected live counters: in=%d out=%d exists=%t", inBytes, outBytes, ok)
	}
}

func TestQuotaBlocksLoginOnTheReadThatExceedsIt(t *testing.T) {
	auth := NewAuthRegistry()
	tracker := NewTrafficTracker(&Config{CoreURL: "http://127.0.0.1:1", AuthToken: "t", ServerID: "s"}, auth)
	blocked := make([]string, 0)
	tracker.SetLimitHandler(func(login string) {
		if auth.BlockOnce(login) {
			blocked = append(blocked, login)
		}
	})

	// 100 bytes already flowed before activation: the quota must count from now.
	tracker.AddBytes("quota-login", "out", 100)
	cfg := &LoginConfig{Login: "quota-login", Password: "p", LimitEnabled: true, BytesLimit: 50}
	cfg.LimitBaseIn, cfg.LimitBaseOut = tracker.Totals("quota-login")
	auth.ActivatePort(cfg)

	tracker.AddBytes("quota-login", "in", 20)
	tracker.AddBytes("quota-login", "out", 29)
	if len(blocked) != 0 || auth.Get("quota-login").Blocked {
		t.Fatalf("login blocked before quota was reached")
	}
	tracker.AddBytes("quota-login", "out", 1)
	if len(blocked) != 1 || !auth.Get("quota-login").Blocked {
		t.Fatalf("login not blocked at quota: blocked=%v", blocked)
	}
	tracker.AddBytes("quota-login", "out", 500)
	if len(blocked) != 1 {
		t.Fatalf("block handler fired more than once: %v", blocked)
	}

	// Logins without a quota are never blocked by the tracker.
	auth.ActivatePort(&LoginConfig{Login: "free-login", Password: "p"})
	tracker.AddBytes("free-login", "out", 1<<30)
	if auth.Get("free-login").Blocked {
		t.Fatalf("unlimited login must not be blocked")
	}
}

// A quota-limited login must be blocked mid-stream, not after the whole response
// has been relayed: the copy path has to report bytes chunk by chunk.
func TestWriteToCountsInChunksSoQuotaCutsMidStream(t *testing.T) {
	auth := NewAuthRegistry()
	tracker := NewTrafficTracker(&Config{CoreURL: "http://127.0.0.1:1", AuthToken: "t", ServerID: "s"}, auth)
	upstream, upstreamPeer := net.Pipe()
	client, clientPeer := net.Pipe()
	defer upstream.Close()
	defer upstreamPeer.Close()
	defer client.Close()
	defer clientPeer.Close()

	tracker.SetLimitHandler(func(login string) {
		if auth.BlockOnce(login) {
			client.Close() // what ConnectionManager.CloseAll does
		}
	})
	auth.ActivatePort(&LoginConfig{Login: "stream", Password: "p", LimitEnabled: true, BytesLimit: 100 * 1024})

	go func() {
		chunk := bytes.Repeat([]byte("x"), 32*1024)
		for i := 0; i < 32; i++ { // 1 MB
			if _, err := upstreamPeer.Write(chunk); err != nil {
				return
			}
		}
		upstreamPeer.Close()
	}()
	received := make(chan int64, 1)
	go func() {
		n, _ := io.Copy(io.Discard, clientPeer)
		received <- n
	}()

	counting := &countingConn{conn: upstream, login: "stream", tracker: tracker, direction: "out"}
	_, _ = counting.WriteTo(client)
	clientPeer.Close()
	got := <-received
	if !auth.Get("stream").Blocked {
		t.Fatalf("login was not blocked")
	}
	if got >= 512*1024 {
		t.Fatalf("client still received %d bytes; the stream was not cut near the 100 KB quota", got)
	}
}

// Thousands of active logins must not produce one oversized batch: the snapshot is
// split into chunks, each acknowledged on its own, and a failed chunk is retried
// with the same id while already acknowledged chunks are not resent.
func TestSendBatchSplitsLargeSnapshotIntoChunks(t *testing.T) {
	var mu sync.Mutex
	var batches []TrafficBatch
	failSecond := true
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		var batch TrafficBatch
		if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
			t.Errorf("decode batch: %v", err)
		}
		mu.Lock()
		batches = append(batches, batch)
		n := len(batches)
		mu.Unlock()
		if n == 2 && failSecond {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	auth := NewAuthRegistry()
	tracker := NewTrafficTracker(&Config{CoreURL: server.URL, AuthToken: "t", ServerID: "s"}, auth)
	total := maxLogsPerBatch*2 + 50
	for i := 0; i < total; i++ {
		tracker.AddBytes("login-"+strconvItoa(i), "out", 10)
	}

	tracker.sendBatch() // chunk 1 ok, chunk 2 fails
	failSecond = false
	tracker.sendBatch() // retries chunk 2 (same id), then chunk 3

	mu.Lock()
	defer mu.Unlock()
	if len(batches) != 4 {
		t.Fatalf("expected 4 POSTs (1 ok, 1 failed, retry, last), got %d", len(batches))
	}
	if batches[1].BatchID != batches[2].BatchID {
		t.Fatalf("failed chunk must be retried with the same id")
	}
	seen := map[string]bool{}
	for i, b := range []TrafficBatch{batches[0], batches[2], batches[3]} {
		if len(b.Logs) > maxLogsPerBatch {
			t.Fatalf("chunk %d has %d logs, limit %d", i, len(b.Logs), maxLogsPerBatch)
		}
		for _, l := range b.Logs {
			if seen[l.User] {
				t.Fatalf("login %s reported twice", l.User)
			}
			seen[l.User] = true
		}
	}
	if len(seen) != total {
		t.Fatalf("expected %d logins reported once, got %d", total, len(seen))
	}
}

func strconvItoa(i int) string {
	if i == 0 {
		return "0"
	}
	var b []byte
	for i > 0 {
		b = append([]byte{byte('0' + i%10)}, b...)
		i /= 10
	}
	return string(b)
}
