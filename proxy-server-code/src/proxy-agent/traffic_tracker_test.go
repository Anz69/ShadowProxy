package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

func TestSendBatchRetriesSameIDAndKeepsNewBytesForNextBatch(t *testing.T) {
	var mu sync.Mutex
	var batchIDs []string
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		var batch TrafficBatch
		if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
			t.Errorf("decode batch: %v", err)
		}
		mu.Lock()
		batchIDs = append(batchIDs, batch.BatchID)
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

	inBytes, _, reportedIn, _, ok := tracker.Stats("qa-login")
	if !ok || inBytes != 1500 || reportedIn != 1500 {
		t.Fatalf("unexpected counters: live=%d reported=%d exists=%t", inBytes, reportedIn, ok)
	}
}
