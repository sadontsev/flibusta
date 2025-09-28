#!/usr/bin/env python3
import os
import sys
import tempfile
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


PORT = int(os.environ.get('CALIBRE_HTTP_PORT', '7090'))


class ConvertHandler(BaseHTTPRequestHandler):
    def _set_headers(self, code=200, content_type='application/json'):
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()

    def log_message(self, format: str, *args):
        # Less noisy logging
        sys.stderr.write("[calibre-svc] " + (format % args) + "\n")

    def do_GET(self):
        if self.path.startswith('/health'):
            self._set_headers(200, 'text/plain')
            self.wfile.write(b'OK')
            return
        self._set_headers(404, 'text/plain')
        self.wfile.write(b'Not Found')

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/convert':
            self._set_headers(404, 'text/plain')
            self.wfile.write(b'Not Found')
            return

        qs = parse_qs(parsed.query or '')
        source = (qs.get('from', ['bin'])[0] or 'bin').lower()
        target = (qs.get('to', ['epub'])[0] or 'epub').lower()

        # Read request body
        content_length = int(self.headers.get('Content-Length', '0'))
        if content_length <= 0:
            self._set_headers(400, 'application/json')
            self.wfile.write(b'{"error":"Missing request body"}')
            return

        with tempfile.TemporaryDirectory(prefix='calibre_') as tmpdir:
            in_path = os.path.join(tmpdir, f'input.{source}')
            out_path = os.path.join(tmpdir, f'output.{target}')
            # Write input
            with open(in_path, 'wb') as f:
                remaining = content_length
                while remaining > 0:
                    chunk = self.rfile.read(min(65536, remaining))
                    if not chunk:
                        break
                    f.write(chunk)
                    remaining -= len(chunk)

            # Run ebook-convert
            cmd = [os.environ.get('CALIBRE_EBOOK_CONVERT', 'ebook-convert'), in_path, out_path]
            try:
                proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=int(os.environ.get('CALIBRE_CONVERSION_TIMEOUT', '180')), check=False)
            except subprocess.TimeoutExpired:
                self._set_headers(504, 'application/json')
                self.wfile.write(b'{"error":"Conversion timeout"}')
                return
            except Exception as e:
                self._set_headers(500, 'application/json')
                self.wfile.write(('{"error":"Failed to start converter: %s"}' % str(e)).encode('utf-8'))
                return

            if proc.returncode != 0:
                self._set_headers(500, 'application/json')
                err = (proc.stderr or b'').decode('utf-8', errors='ignore')
                msg = err[:500].replace('\n', ' ')
                self.wfile.write(('{"error":"Converter failed: %s"}' % msg).encode('utf-8'))
                return

            if not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
                self._set_headers(500, 'application/json')
                self.wfile.write(b'{"error":"No output produced"}')
                return

            # Stream result
            self._set_headers(200, 'application/octet-stream')
            with open(out_path, 'rb') as f:
                while True:
                    buf = f.read(65536)
                    if not buf:
                        break
                    self.wfile.write(buf)


def run_server():
    server_address = ('0.0.0.0', PORT)
    httpd = HTTPServer(server_address, ConvertHandler)
    print(f"[calibre-svc] Listening on :{PORT}")
    httpd.serve_forever()


if __name__ == '__main__':
    run_server()
