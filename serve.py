#!/usr/bin/env python3
"""
Robust Static Server for React Frontend.
1. Catches and suppresses BrokenPipeError & ConnectionResetError when clients reload/disconnect mid-download.
2. Supports client-side SPA routing: any subroute (/bolt, /bolt/logs, /clean, etc.) serves index.html instead of 404.
3. Sends Cache-Control: no-cache headers on HTML so the browser always loads the latest bundle.
"""
import http.server
import socketserver
import os
import sys

def find_dist_dir():
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "dist")),
        os.getcwd(),
        os.path.join(os.getcwd(), "dist"),
        "/home/adi/Desktop/GUIRev2/frontend-react/dist",
    ]
    for path in candidates:
        if os.path.exists(os.path.join(path, "index.html")):
            return os.path.abspath(path)
    return os.path.abspath(os.path.dirname(__file__))

DIST_DIR = find_dist_dir()

class QuietSPAServer(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def end_headers(self):
        # Disable caching on HTML so browser always downloads latest JS
        if self.path == "/" or self.path.endswith(".html") or not "." in os.path.basename(self.path):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        file_path = self.translate_path(self.path)
        # If requested URL does not exist on disk, serve index.html (SPA routing)
        if not os.path.exists(file_path):
            self.path = "/index.html"
        try:
            return super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def copyfile(self, source, outputfile):
        """Silently catches client aborts / broken pipe during file downloads."""
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def finish(self):
        try:
            super().finish()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, format, *args):
        # Clean formatted request log
        msg = format % args
        # Filter out harmless 404s that got rerouted to index.html
        print(f"[HTTP] {msg}")

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        # Silently ignore broken pipes from abrupt browser reloads
        exc_type, exc_val, _ = sys.exc_info()
        if exc_type in (BrokenPipeError, ConnectionResetError):
            return
        super().handle_error(request, client_address)

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    with ReusableTCPServer(("", port), QuietSPAServer) as httpd:
        print(f"\n=======================================================")
        print(f"✓ GUI Server running on: http://localhost:{port}")
        print(f"  • Serving folder: {DIST_DIR}")
        print(f"  • SPA Routing: Enabled (no 404 on /bolt/logs or refresh)")
        print(f"  • BrokenPipe Protection: Enabled (silent client aborts)")
        print(f"  • Cache Control: no-cache on HTML")
        print(f"=======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    main()
