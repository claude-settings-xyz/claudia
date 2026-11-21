package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"claudia/internal/claude"
)

func TestRequestChecks(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("HOME", t.TempDir())
	s, err := New(claude.Paths{ConfigDir: t.TempDir()}, "test")
	if err != nil {
		t.Fatal(err)
	}
	ui := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	handler := s.Handler("7377", ui)

	cases := []struct {
		name   string
		host   string
		path   string
		header bool
		want   int
	}{
		{"api with header", "127.0.0.1:7377", "/api/health", true, http.StatusOK},
		{"localhost name", "localhost:7377", "/api/health", true, http.StatusOK},
		{"api without header", "127.0.0.1:7377", "/api/health", false, http.StatusForbidden},
		{"rebinding host", "evil.example:7377", "/api/health", true, http.StatusForbidden},
		{"wrong port", "127.0.0.1:80", "/api/health", true, http.StatusForbidden},
		{"ui without header", "127.0.0.1:7377", "/", false, http.StatusOK},
	}
	for _, c := range cases {
		req := httptest.NewRequest(http.MethodGet, c.path, nil)
		req.Host = c.host
		if c.header {
			req.Header.Set(Header, "1")
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != c.want {
			t.Errorf("%s: got %d, want %d", c.name, rec.Code, c.want)
		}
	}
}

func TestSelectFolder(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("HOME", t.TempDir())
	s, err := New(claude.Paths{ConfigDir: t.TempDir()}, "test")
	if err != nil {
		t.Fatal(err)
	}
	handler := s.Handler("7377", http.NotFoundHandler())
	call := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/pick-folder", nil)
		req.Host = "127.0.0.1:7377"
		req.Header.Set(Header, "1")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}

	s.pickFolder = func(context.Context) (string, error) { return "/Users/me/code/app", nil }
	if rec := call(); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"path":"/Users/me/code/app"`) {
		t.Errorf("picked: %d %s", rec.Code, rec.Body)
	}

	s.pickFolder = func(context.Context) (string, error) { return "", errors.New("no display") }
	if rec := call(); rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "no display") {
		t.Errorf("failure should hide details: %d %s", rec.Code, rec.Body)
	}

	// A second request while a dialog is open is refused.
	opened, release := make(chan struct{}), make(chan struct{})
	s.pickFolder = func(context.Context) (string, error) { close(opened); <-release; return "", nil }
	go call()
	<-opened
	if rec := call(); rec.Code != http.StatusConflict {
		t.Errorf("second dialog: %d", rec.Code)
	}
	close(release)
}

func TestWithoutSession(t *testing.T) {
	env := withoutSession([]string{
		"PATH=/bin", "CLAUDECODE=1", "CLAUDE_CODE_SESSION_ID=x", "CLAUDE_CODE_ENTRYPOINT=cli",
		"CLAUDE_CONFIG_DIR=/c", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1",
	})
	want := "PATH=/bin CLAUDE_CONFIG_DIR=/c CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1"
	if got := strings.Join(env, " "); got != want {
		t.Errorf("got %q", got)
	}
}
