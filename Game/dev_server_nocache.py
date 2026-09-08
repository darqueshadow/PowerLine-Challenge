#!/usr/bin/env python3
"""PowerLine Challenge - no-cache dev server.

Serves the arcade over http:// with caching DISABLED, so editing a JS/CSS/CSV
file and doing a NORMAL browser reload always loads the fresh copy - no more
stale "?v=..." builds that need a hard-refresh (Ctrl+Shift+R) to pick up.

Same port + serve-from-here behaviour as `python -m http.server 8000`; run it
from the arcade root (the "Start Dev Server (no-cache).bat" does that for you).
"""
import http.server
import socketserver

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Tell the browser never to reuse a cached copy - always revalidate.
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
        print('PowerLine Challenge dev server (no-cache) on http://localhost:%d' % PORT)
        print('Caching is OFF - a normal browser reload always loads fresh files.')
        print('Press Ctrl+C to stop.')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nStopped.')
