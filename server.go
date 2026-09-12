package main

import (
	"bytes"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"strings"
	"time"
)

const (
	defaultAddress = ":8080"
	htmlCache      = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800"
	assetCache     = "public, max-age=31536000, immutable"
)

//go:embed all:github-static/dist
var siteFiles embed.FS

type staticServer struct {
	files map[string][]byte
}

func main() {
	server, err := newStaticServer()
	if err != nil {
		log.Fatalf("load embedded site: %v", err)
	}

	address := os.Getenv("LISTEN_ADDR")
	if address == "" {
		address = defaultAddress
	}

	httpServer := &http.Server{
		Addr:              address,
		Handler:           server,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    8 << 10,
	}

	log.Printf("serving static Cambridge DBML site on %s", address)
	log.Fatal(httpServer.ListenAndServe())
}

func newStaticServer() (*staticServer, error) {
	dist, err := fs.Sub(siteFiles, "github-static/dist")
	if err != nil {
		return nil, err
	}

	files := make(map[string][]byte)
	err = fs.WalkDir(dist, ".", func(name string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			return nil
		}
		if !entry.Type().IsRegular() {
			return fmt.Errorf("embedded site contains non-regular file %q", name)
		}
		content, err := fs.ReadFile(dist, name)
		if err != nil {
			return err
		}
		files["/"+path.Clean(name)] = content
		return nil
	})
	if err != nil {
		return nil, err
	}
	if _, ok := files["/index.html"]; !ok {
		return nil, fmt.Errorf("index.html is missing; run npm run build in github-static before compiling")
	}
	return &staticServer{files: files}, nil
}

func (server *staticServer) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	setSecurityHeaders(response.Header())

	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		response.Header().Set("Allow", "GET, HEAD")
		http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fileName, ok := requestedFile(request.URL.Path)
	if !ok {
		http.NotFound(response, request)
		return
	}
	content, ok := server.files[fileName]
	if !ok {
		http.NotFound(response, request)
		return
	}

	setCacheHeaders(response.Header(), fileName)
	response.Header().Set("Content-Type", contentType(fileName))
	http.ServeContent(response, request, fileName, time.Time{}, bytes.NewReader(content))
}

func requestedFile(requestPath string) (string, bool) {
	if requestPath == "/" || requestPath == "/index.html" {
		return "/index.html", true
	}
	if requestPath == "/syntax" || requestPath == "/syntax.html" {
		return "/syntax.html", true
	}
	if !strings.HasPrefix(requestPath, "/assets/") || strings.Contains(requestPath, "\\") {
		return "", false
	}

	cleaned := path.Clean(requestPath)
	if cleaned != requestPath || strings.Contains(cleaned, "..") {
		return "", false
	}
	return cleaned, true
}

func setSecurityHeaders(headers http.Header) {
	headers.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
	headers.Set("Cross-Origin-Opener-Policy", "same-origin")
	headers.Set("Cross-Origin-Resource-Policy", "same-origin")
	headers.Set("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()")
	headers.Set("Referrer-Policy", "no-referrer")
	headers.Set("X-Content-Type-Options", "nosniff")
	headers.Set("X-Frame-Options", "DENY")
}

func setCacheHeaders(headers http.Header, fileName string) {
	cacheControl := assetCache
	if strings.HasSuffix(fileName, ".html") {
		cacheControl = htmlCache
	}
	headers.Set("Cache-Control", cacheControl)
	headers.Set("CDN-Cache-Control", cacheControl)
	headers.Set("Cloudflare-CDN-Cache-Control", cacheControl)
}

func contentType(fileName string) string {
	if fileName == "/assets/vendor/sql-wasm.wasm" {
		return "application/wasm"
	}
	if contentType := mime.TypeByExtension(path.Ext(fileName)); contentType != "" {
		return contentType
	}
	return "application/octet-stream"
}
