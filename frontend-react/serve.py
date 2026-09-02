#!/usr/bin/env python3
"""
SPA Static Server for React Frontend.
- Automatically serves /index.html for any subroute (/bolt, /logs, /calibrate, etc.) so refresh never gives 404.
- Sends Cache-Control: no-cache on HTML so browser always downloads the latest JS bundle.
"""
import http.server
import socketserver
import os
import sys

DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "dist"))

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def end_headers(self):
        # Disable caching on HTML/routes so changes take effect immediately
        if self.path == "/" or self.path.endswith(".html") or not "." in os.path.basename(self.path):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        file_path = self.translate_path(self.path)
        # If requested URL does not exist on disk, serve index.html (SPA client-side routing)
        if not os.path.exists(file_path):
            self.path = "/index.html"
        return super().do_GET()

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), SPAHandler) as httpd:
        print(f"\n✓ SPA Server running at http://localhost:{port}")
        print(f"  • Serving: {DIST_DIR}")
        print(f"  • Full SPA refresh support (no 404 on /bolt)")
        print(f"  • Cache busting enabled\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    main()
