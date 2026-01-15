"""
mitmdump addon for real-time HAR capture to JSON Lines file.

This addon intercepts HTTP/HTTPS traffic and stores each request/response
pair in a JSONL file (one JSON object per line) for later querying.

Usage:
    mitmdump -s har_capture.py --set har_file=/path/to/traffic.jsonl
"""
import json
import time
import uuid
import threading
from datetime import datetime
from typing import Optional

from mitmproxy import http, ctx


class HarCapture:
    def __init__(self):
        self.har_file: Optional[str] = None
        self.file_handle = None
        self.lock = threading.Lock()

    def load(self, loader):
        loader.add_option(
            name="har_file",
            typespec=str,
            default="",
            help="Path to JSONL file for HAR storage"
        )

    def configure(self, updates):
        if "har_file" in updates and ctx.options.har_file:
            self.har_file = ctx.options.har_file
            self._open_file()
            ctx.log.info(f"HAR capture initialized with file: {self.har_file}")

    def _open_file(self):
        """Open the JSONL file for appending."""
        if self.file_handle:
            self.file_handle.close()
        self.file_handle = open(self.har_file, 'a', encoding='utf-8')

    def response(self, flow: http.HTTPFlow):
        """Called when a response is received."""
        if not self.file_handle:
            return

        try:
            entry = self._flow_to_har_entry(flow)
            self._write_entry(entry)
        except Exception as e:
            ctx.log.error(f"Error capturing flow: {e}")

    def _flow_to_har_entry(self, flow: http.HTTPFlow) -> dict:
        """Convert mitmproxy flow to HAR entry format."""
        entry_id = f"entry-{uuid.uuid4().hex[:12]}"
        timestamp = datetime.utcnow().isoformat() + 'Z'
        timestamp_ms = int(time.time() * 1000)

        # Parse request headers
        request_headers = [
            {"name": k, "value": v}
            for k, v in flow.request.headers.items()
        ]

        # Parse response headers
        response_headers = [
            {"name": k, "value": v}
            for k, v in flow.response.headers.items()
        ] if flow.response else []

        # Parse query string
        query_string = []
        if flow.request.query:
            query_string = [
                {"name": k, "value": v}
                for k, v in flow.request.query.items()
            ]

        # Calculate timings
        timings = self._calculate_timings(flow)

        # Get content type
        content_type = ""
        if flow.response:
            content_type = flow.response.headers.get("content-type", "")

        # Parse URL for host and path
        request_url = flow.request.pretty_url
        request_host = flow.request.host
        request_path = flow.request.path

        # Get request body (decode if text, base64 if binary)
        request_body = None
        request_body_size = 0
        if flow.request.content:
            request_body_size = len(flow.request.content)
            try:
                request_body = flow.request.content.decode('utf-8')
            except:
                # Binary data - store as base64
                import base64
                request_body = base64.b64encode(flow.request.content).decode('ascii')

        # Get response body
        response_body = None
        response_body_size = 0
        if flow.response and flow.response.content:
            response_body_size = len(flow.response.content)
            try:
                response_body = flow.response.content.decode('utf-8')
            except:
                import base64
                response_body = base64.b64encode(flow.response.content).decode('ascii')

        # Build entry
        entry = {
            "id": entry_id,
            "timestamp": timestamp,
            "timestampMs": timestamp_ms,
            "request": {
                "method": flow.request.method,
                "url": request_url,
                "host": request_host,
                "path": request_path,
                "httpVersion": f"HTTP/{flow.request.http_version}",
                "headers": request_headers,
                "queryString": query_string,
                "bodySize": request_body_size,
                "body": request_body,
            },
            "response": {
                "status": flow.response.status_code if flow.response else 0,
                "statusText": flow.response.reason if flow.response else "",
                "httpVersion": f"HTTP/{flow.response.http_version}" if flow.response else "",
                "headers": response_headers,
                "contentType": content_type,
                "bodySize": response_body_size,
                "body": response_body,
            },
            "timings": timings,
            "serverIPAddress": flow.server_conn.ip_address[0] if flow.server_conn and flow.server_conn.ip_address else "",
        }

        return entry

    def _calculate_timings(self, flow: http.HTTPFlow) -> dict:
        """Calculate timing information from flow timestamps."""
        timings = {
            "blocked": 0,
            "dns": 0,
            "connect": 0,
            "ssl": 0,
            "send": 0,
            "wait": 0,
            "receive": 0,
        }

        if flow.server_conn and flow.server_conn.timestamp_start and flow.server_conn.timestamp_end:
            if flow.server_conn.timestamp_tcp_setup:
                timings["connect"] = int((flow.server_conn.timestamp_tcp_setup - flow.server_conn.timestamp_start) * 1000)

            if flow.server_conn.timestamp_tls_setup and flow.server_conn.timestamp_tcp_setup:
                timings["ssl"] = int((flow.server_conn.timestamp_tls_setup - flow.server_conn.timestamp_tcp_setup) * 1000)

        if flow.request.timestamp_start and flow.request.timestamp_end:
            timings["send"] = int((flow.request.timestamp_end - flow.request.timestamp_start) * 1000)

        if flow.request.timestamp_end and flow.response and flow.response.timestamp_start:
            timings["wait"] = int((flow.response.timestamp_start - flow.request.timestamp_end) * 1000)

        if flow.response and flow.response.timestamp_start and flow.response.timestamp_end:
            timings["receive"] = int((flow.response.timestamp_end - flow.response.timestamp_start) * 1000)

        return timings

    def _write_entry(self, entry: dict):
        """Write entry to JSONL file."""
        with self.lock:
            line = json.dumps(entry, ensure_ascii=False)
            self.file_handle.write(line + '\n')
            self.file_handle.flush()
            ctx.log.debug(f"Captured: {entry['request']['method']} {entry['request']['url'][:80]}")

    def done(self):
        """Called when mitmproxy is shutting down."""
        if self.file_handle:
            self.file_handle.close()
            ctx.log.info("HAR capture file closed")


addons = [HarCapture()]
