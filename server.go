package main

import (
	"fmt"
	"log"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	defaultAddress = ":8080"
	htmlCache      = "no-cache, max-age=0, must-revalidate"
	assetCache     = "public, max-age=31536000, immutable"
)

var hashedAsset = regexp.MustCompile(`-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$`)

type staticServer struct {
	siteDir string
}

func main() {
	siteDir := os.Getenv("SITE_DIR")
	if siteDir == "" {
		executable, err := os.Executable()
		if err != nil {
			log.Fatalf("locate executable: %v", err)
		}
		siteDir = filepath.Dir(executable)
	}
	server, err := newStaticServer(siteDir)
	if err != nil {
		log.Fatalf("open site directory: %v", err)
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

	log.Printf("serving static Cambridge DBML site from %s on %s", siteDir, address)
	log.Fatal(httpServer.ListenAndServe())
}

func newStaticServer(siteDir string) (*staticServer, error) {
	siteDir, err := filepath.Abs(siteDir)
	if err != nil {
		return nil, err
	}
	index, err := os.Stat(filepath.Join(siteDir, "index.html"))
	if err != nil {
		return nil, fmt.Errorf("index.html: %w", err)
	}
	if !index.Mode().IsRegular() {
		return nil, fmt.Errorf("index.html is not a regular file")
	}
	return &staticServer{siteDir: siteDir}, nil
}

func (server *staticServer) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	setSecurityHeaders(response.Header())

	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		response.Header().Set("Allow", "GET, HEAD")
		http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if request.URL.Path == "/syntax" || request.URL.Path == "/syntax.html" {
		http.Redirect(response, request, "/#syntax", http.StatusMovedPermanently)
		return
	}

	fileName, ok := requestedFile(request.URL.Path)
	if !ok {
		http.NotFound(response, request)
		return
	}
	file, err := os.Open(filepath.Join(server.siteDir, filepath.FromSlash(strings.TrimPrefix(fileName, "/"))))
	if err != nil {
		http.NotFound(response, request)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(response, request)
		return
	}

	setCacheHeaders(response.Header(), fileName)
	response.Header().Set("Content-Type", contentType(fileName))
	http.ServeContent(response, request, fileName, info.ModTime(), file)
}

func requestedFile(requestPath string) (string, bool) {
	if requestPath == "/" || requestPath == "/index.html" {
		return "/index.html", true
	}
	if !strings.HasPrefix(requestPath, "/assets/") || strings.Contains(requestPath, "\\") {
		return "", false
	}

	cleaned := path.Clean(requestPath)
	if cleaned != requestPath || strings.Contains(cleaned, "..") {
		return "", false
	}
	for _, segment := range strings.Split(strings.TrimPrefix(cleaned, "/assets/"), "/") {
		if strings.HasPrefix(segment, ".") {
			return "", false
		}
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
	cacheControl := htmlCache
	if hashedAsset.MatchString(fileName) {
		cacheControl = assetCache
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
