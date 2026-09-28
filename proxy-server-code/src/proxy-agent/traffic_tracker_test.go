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
