package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func testSite(t *testing.T) (string, *staticServer) {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("original"), 0644); err != nil {
		t.Fatal(err)
	}
	server, err := newStaticServer(dir)
	if err != nil {
		t.Fatal(err)
	}
	return dir, server
}

func TestStaticServerAllowsOnlyReadMethods(t *testing.T) {
	_, server := testSite(t)

	request := httptest.NewRequest(http.MethodPost, "/", nil)
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST status = %d, want %d", response.Code, http.StatusMethodNotAllowed)
	}
	if response.Header().Get("Allow") != "GET, HEAD" {
		t.Fatalf("Allow = %q", response.Header().Get("Allow"))
	}
}

func TestStaticServerServesRevalidatedHTMLWithSecurityHeaders(t *testing.T) {
	_, server := testSite(t)

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("GET status = %d, want %d", response.Code, http.StatusOK)
	}
	if response.Header().Get("Cache-Control") != htmlCache {
		t.Fatalf("Cache-Control = %q", response.Header().Get("Cache-Control"))
	}
	if response.Header().Get("Content-Security-Policy") == "" {
		t.Fatal("missing Content-Security-Policy")
	}
}

func TestStaticServerRejectsTraversalAndUnknownPaths(t *testing.T) {
	dir, server := testSite(t)
	if err := os.Mkdir(filepath.Join(dir, "assets"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "assets", ".env"), []byte("private"), 0644); err != nil {
		t.Fatal(err)
	}

	for _, requestPath := range []string{"/assets/../index.html", "/assets/.env", "/api/execute", "/missing"} {
		request := httptest.NewRequest(http.MethodGet, requestPath, nil)
		response := httptest.NewRecorder()
		server.ServeHTTP(response, request)
		if response.Code != http.StatusNotFound {
			t.Errorf("GET %s status = %d, want %d", requestPath, response.Code, http.StatusNotFound)
		}
	}
}

func TestStaticServerReadsUpdatedFilesWithoutRestart(t *testing.T) {
	dir, server := testSite(t)
	updated := filepath.Join(dir, "index.next")
	if err := os.WriteFile(updated, []byte("updated"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(updated, filepath.Join(dir, "index.html")); err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	server.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/", nil))
	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "updated" {
		t.Fatalf("updated response: status %d, body %q", response.Code, response.Body.String())
	}
}

func TestStaticServerFollowsSwitchedSiteSymlink(t *testing.T) {
	root := t.TempDir()
	for name, content := range map[string]string{"first": "first release", "second": "second release"} {
		dir := filepath.Join(root, name)
		if err := os.Mkdir(dir, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}
	site := filepath.Join(root, "site")
	if err := os.Symlink("first", site); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	server, err := newStaticServer(site)
	if err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	server.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/", nil))
	if response.Body.String() != "first release" {
		t.Fatalf("first response = %q", response.Body.String())
	}
	next := filepath.Join(root, "site.next")
	if err := os.Symlink("second", next); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(next, site); err != nil {
		t.Fatal(err)
	}
	response = httptest.NewRecorder()
	server.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/", nil))
	if response.Body.String() != "second release" {
		t.Fatalf("second response = %q", response.Body.String())
	}
}

func TestStaticServerRedirectsOldSyntaxURL(t *testing.T) {
	_, server := testSite(t)
	for _, route := range []string{"/syntax", "/syntax.html"} {
		response := httptest.NewRecorder()
		server.ServeHTTP(response, httptest.NewRequest(http.MethodGet, route, nil))
		if response.Code != http.StatusMovedPermanently || response.Header().Get("Location") != "/#syntax" {
			t.Errorf("GET %s: status %d, location %q", route, response.Code, response.Header().Get("Location"))
		}
	}
}

func TestStaticServerCachesOnlyHashedAssetsImmutably(t *testing.T) {
	_, server := testSite(t)
	if err := os.MkdirAll(filepath.Join(server.siteDir, "assets", "vendor"), 0755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"assets/index-CA6yWqsq.css", "assets/vendor/sql-wasm.js"} {
		if err := os.WriteFile(filepath.Join(server.siteDir, name), []byte("asset"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	for _, fixture := range []struct{ path, cache string }{
		{"/assets/index-CA6yWqsq.css", assetCache},
		{"/assets/vendor/sql-wasm.js", htmlCache},
	} {
		response := httptest.NewRecorder()
		server.ServeHTTP(response, httptest.NewRequest(http.MethodGet, fixture.path, nil))
		if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != fixture.cache {
			t.Errorf("GET %s: status %d, cache %q", fixture.path, response.Code, response.Header().Get("Cache-Control"))
		}
	}
}
