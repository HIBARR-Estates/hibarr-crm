#!/usr/bin/env python3
"""
Export a Zoho Cliq channel via the v2 Bulk Export API and convert it into a CSV
ready for a Frappe Helpdesk "HD Ticket" data import.

Pipeline (subcommand `run`):
    1. OAuth against the EU accounts server (grant token -> access + refresh token).
    2. Resolve the organization id (unless supplied).
    3. Resolve the target channel ("IT Support" by default) to its chat id.
    4. Trigger a bulk conversation export -> job id.
    5. Poll the job until it completes, then download the result.
    6. Group the messages into threads and write the HD Ticket CSV.

Steps 5-6 are also available on their own so you can re-run the conversion
without paying for another export:

    zoho_cliq_export_to_frappe.py convert --input chat.json --output tickets.csv

Data centre
-----------
Defaults to the EU DC: accounts.zoho.eu for OAuth, cliq.zoho.eu for the API.
Use --dc to switch (com / eu / in / au / jp / ca / sa).

Credentials
-----------
Never passed on the command line by default; read from the environment:
    ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_GRANT_TOKEN, ZOHO_REDIRECT_URI

A Zoho grant token is single-use and expires within minutes. The first run
exchanges it and caches the long-lived refresh token (mode 0600) in
~/.zoho_cliq_tokens.json; later runs refresh silently and ignore the grant
token. Delete the cache to start over with a fresh grant token.

Required OAuth scopes (comma separated in the authorize URL):
    ZohoCliq.Organisation.READ, ZohoCliq.Channels.READ, ZohoCliq.Messages.READ
Bulk export is an admin operation and may additionally need an export/admin
scope for your org - see ENDPOINTS below.
"""

from __future__ import annotations

import argparse
import csv
import html
import io
import json
import os
import re
import ssl
import stat
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

# --------------------------------------------------------------------------
# ENDPOINTS - VERIFY THESE AGAINST YOUR TENANT'S API DOCS BEFORE FIRST RUN
# --------------------------------------------------------------------------
# The Bulk Export section of the Cliq v2 API ("Maintenance > Bulk Export") is
# not publicly mirrored, and its exact paths have varied between tenants. Every
# path below is therefore a *candidate list*: the client tries each in order and
# keeps the first that does not answer 404/405. Pin one explicitly with the
# matching --*-path flag to skip probing entirely (recommended once you know it,
# so a POST is never sent to more than one URL).
#
# {org} is substituted with the organization id, {job} with the export job id.
ORG_PATHS: Tuple[str, ...] = (
    "organizations",
    "organization",
)
CHANNEL_PATHS: Tuple[str, ...] = (
    "channels",
    "organizations/{org}/channels",
)
EXPORT_START_PATHS: Tuple[str, ...] = (
    "organizations/{org}/exports/conversations",
    "exports/conversations",
    "export/conversations",
)
EXPORT_STATUS_PATHS: Tuple[str, ...] = (
    "organizations/{org}/exports/conversations/{job}",
    "exports/conversations/{job}",
    "export/conversations/{job}",
)

ACCOUNTS_HOSTS = {
    "com": "accounts.zoho.com",
    "eu": "accounts.zoho.eu",
    "in": "accounts.zoho.in",
    "au": "accounts.zoho.com.au",
    "jp": "accounts.zoho.jp",
    "ca": "accounts.zohocloud.ca",
    "sa": "accounts.zoho.sa",
}
API_HOSTS = {
    "com": "cliq.zoho.com",
    "eu": "cliq.zoho.eu",
    "in": "cliq.zoho.in",
    "au": "cliq.zoho.com.au",
    "jp": "cliq.zoho.jp",
    "ca": "cliq.zohocloud.ca",
    "sa": "cliq.zoho.sa",
}

DEFAULT_TOKEN_CACHE = os.path.expanduser("~/.zoho_cliq_tokens.json")
DEFAULT_CHANNEL = "IT Support"
USER_AGENT = "zoho-cliq-frappe-export/1.0"

# Terminal job states, lowercased for comparison.
DONE_STATES = {"completed", "complete", "success", "successful", "finished", "done", "ready"}
FAIL_STATES = {"failed", "failure", "error", "cancelled", "canceled", "aborted", "expired"}


class CliqError(RuntimeError):
    """Anything that should stop the run with a readable message."""


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", file=sys.stderr, flush=True)


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------

class Response:
    def __init__(self, status: int, body: bytes, headers: Dict[str, str]):
        self.status = status
        self.body = body
        self.headers = headers

    def json(self) -> Any:
        if not self.body:
            return {}
        try:
            return json.loads(self.body.decode("utf-8", "replace"))
        except json.JSONDecodeError as exc:
            snippet = self.body[:200].decode("utf-8", "replace")
            raise CliqError(f"Expected JSON, got: {snippet!r}") from exc

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", "replace")


def request(
    method: str,
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
    form: Optional[Dict[str, Any]] = None,
    json_body: Optional[Dict[str, Any]] = None,
    timeout: int = 60,
    retries: int = 4,
) -> Response:
    """One HTTP call with retry on 429 / 5xx / transient network errors.

    Never raises on 4xx - the caller inspects .status, because probing for the
    right endpoint depends on seeing 404/405 without an exception.
    """
    if params:
        clean = {k: v for k, v in params.items() if v is not None}
        if clean:
            url = f"{url}{'&' if '?' in url else '?'}{urllib.parse.urlencode(clean)}"

    hdrs = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    hdrs.update(headers or {})

    data: Optional[bytes] = None
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    elif form is not None:
        data = urllib.parse.urlencode({k: v for k, v in form.items() if v is not None}).encode()
        hdrs["Content-Type"] = "application/x-www-form-urlencoded"

    ctx = ssl.create_default_context()
    last_error: Optional[str] = None

    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, headers=hdrs, method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                return Response(resp.status, resp.read(), dict(resp.headers))
        except urllib.error.HTTPError as exc:
            body = exc.read()
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries:
                wait = _retry_after(exc.headers, attempt)
                log(f"HTTP {exc.code} from {url} - retrying in {wait}s")
                time.sleep(wait)
                last_error = f"HTTP {exc.code}"
                continue
            return Response(exc.code, body, dict(exc.headers))
        except (urllib.error.URLError, TimeoutError, ssl.SSLError, OSError) as exc:
            if attempt < retries:
                wait = 2 ** attempt
                log(f"Network error ({exc}) - retrying in {wait}s")
                time.sleep(wait)
                last_error = str(exc)
                continue
            raise CliqError(f"Request to {url} failed: {exc}") from exc

    raise CliqError(f"Request to {url} failed after {retries} retries: {last_error}")


def _retry_after(headers: Any, attempt: int) -> int:
    try:
        return max(1, min(60, int(headers.get("Retry-After", ""))))
    except (TypeError, ValueError):
        return 2 ** attempt


# --------------------------------------------------------------------------
# OAuth
# --------------------------------------------------------------------------

class TokenManager:
    """Grant-token exchange plus refresh, with an on-disk token cache.

    Zoho returns OAuth errors as HTTP 200 with an {"error": ...} body, so the
    status code alone is never enough to tell success from failure here.
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        dc: str,
        grant_token: Optional[str] = None,
        redirect_uri: Optional[str] = None,
        cache_path: str = DEFAULT_TOKEN_CACHE,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.grant_token = grant_token
        self.redirect_uri = redirect_uri
        self.cache_path = cache_path
        self.token_url = f"https://{ACCOUNTS_HOSTS[dc]}/oauth/v2/token"
        self._access_token: Optional[str] = None
        self._expires_at: float = 0.0
        self._refresh_token: Optional[str] = None
        self._load_cache()

    # -- cache ----------------------------------------------------------
    def _load_cache(self) -> None:
        try:
            with open(self.cache_path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError):
            return
        # A cache written for different credentials must not be reused.
        if data.get("client_id") != self.client_id:
            return
        self._refresh_token = data.get("refresh_token")
        self._access_token = data.get("access_token")
        self._expires_at = float(data.get("expires_at", 0))

    def _save_cache(self) -> None:
        payload = {
            "client_id": self.client_id,
            "refresh_token": self._refresh_token,
            "access_token": self._access_token,
            "expires_at": self._expires_at,
        }
        try:
            with open(self.cache_path, "w", encoding="utf-8") as fh:
                json.dump(payload, fh)
            os.chmod(self.cache_path, stat.S_IRUSR | stat.S_IWUSR)
        except OSError as exc:
            log(f"Warning: could not write token cache {self.cache_path}: {exc}")

    # -- token ----------------------------------------------------------
    def access_token(self) -> str:
        if self._access_token and time.time() < self._expires_at - 60:
            return self._access_token
        if self._refresh_token:
            return self._refresh()
        if self.grant_token:
            return self._exchange_grant_token()
        raise CliqError(
            "No refresh token cached and no grant token supplied. Set "
            "ZOHO_GRANT_TOKEN to a freshly generated grant token (they expire "
            "in minutes) and run again."
        )

    def _exchange_grant_token(self) -> str:
        log("Exchanging grant token for access + refresh token")
        payload = self._post({
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": self.grant_token,
            "redirect_uri": self.redirect_uri,
        })
        self._refresh_token = payload.get("refresh_token")
        if not self._refresh_token:
            log(
                "Warning: no refresh_token returned. Generate the grant token "
                "with access_type=offline, or this script will need a new "
                "grant token on every run."
            )
        self._store(payload)
        return self._access_token  # type: ignore[return-value]

    def _refresh(self) -> str:
        log("Refreshing access token")
        try:
            payload = self._post({
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": self._refresh_token,
            })
        except CliqError:
            # A revoked/expired refresh token is recoverable if the caller
            # still handed us a grant token this run.
            if self.grant_token:
                log("Refresh failed - falling back to the supplied grant token")
                self._refresh_token = None
                return self._exchange_grant_token()
            raise
        self._store(payload)
        return self._access_token  # type: ignore[return-value]

    def _post(self, form: Dict[str, Any]) -> Dict[str, Any]:
        resp = request("POST", self.token_url, form=form)
        payload = resp.json()
        if resp.status >= 400 or "error" in payload:
            err = payload.get("error", f"HTTP {resp.status}")
            raise CliqError(f"OAuth failed ({err}). {_oauth_hint(err)}")
        return payload

    def _store(self, payload: Dict[str, Any]) -> None:
        self._access_token = payload.get("access_token")
        if not self._access_token:
            raise CliqError(f"OAuth response contained no access_token: {payload}")
        self._expires_at = time.time() + float(payload.get("expires_in", 3600))
        if payload.get("refresh_token"):
            self._refresh_token = payload["refresh_token"]
        self._save_cache()

    def auth_header(self) -> Dict[str, str]:
        return {"Authorization": f"Zoho-oauthtoken {self.access_token()}"}


def _oauth_hint(err: str) -> str:
    hints = {
        "invalid_code": "The grant token is single-use and short-lived - generate a new one.",
        "invalid_client": "Check the client id/secret, and that the app was created in the EU console (api-console.zoho.eu).",
        "invalid_client_secret": "Client secret does not match the client id.",
        "redirect_uri_mismatch": "--redirect-uri must exactly match the one registered for the app.",
        "invalid_grant": "Grant/refresh token is expired or revoked - delete the token cache and start again.",
    }
    return hints.get(err, "Check that the app is registered in the same data centre as your account.")


# --------------------------------------------------------------------------
# Cliq API client
# --------------------------------------------------------------------------

class CliqClient:
    def __init__(self, tokens: TokenManager, dc: str, pinned: Optional[Dict[str, str]] = None):
        self.tokens = tokens
        self.base = f"https://{API_HOSTS[dc]}/api/v2"
        self.pinned = pinned or {}
        self._resolved: Dict[str, str] = {}

    def _url(self, path: str, org: str = "", job: str = "") -> str:
        return f"{self.base}/{path.format(org=org, job=job).lstrip('/')}"

    def call(self, method: str, path: str, *, org: str = "", job: str = "", **kw) -> Response:
        return request(
            method,
            self._url(path, org, job),
            headers=self.tokens.auth_header(),
            **kw,
        )

    def probe(
        self,
        kind: str,
        candidates: Sequence[str],
        method: str = "GET",
        *,
        org: str = "",
        job: str = "",
        **kw,
    ) -> Response:
        """Try candidate paths in order, keeping the first that isn't 404/405.

        Once a path resolves for a given kind it is remembered, so a POST is
        only ever sent to one URL per run.
        """
        if kind in self.pinned:
            candidates = [self.pinned[kind]]
        elif kind in self._resolved:
            candidates = [self._resolved[kind]]

        attempts: List[str] = []
        for path in candidates:
            resp = self.call(method, path, org=org, job=job, **kw)
            if resp.status in (404, 405):
                attempts.append(f"{path} -> {resp.status}")
                continue
            if resp.status == 401:
                raise CliqError(
                    "401 Unauthorized. The token is valid but lacks the scope for "
                    f"{kind!r}, or the account is not a Cliq admin (bulk export is "
                    "admin-only)."
                )
            if resp.status >= 400:
                raise CliqError(f"{kind}: HTTP {resp.status} from {path} - {resp.text[:300]}")
            self._resolved[kind] = path
            return resp

        raise CliqError(
            f"No working endpoint for {kind!r}. Tried: {', '.join(attempts)}. "
            f"Pin the correct path from your Cliq v2 API docs with --{kind.replace('_', '-')}-path."
        )

    # -- org ------------------------------------------------------------
    def org_id(self) -> str:
        log("Resolving organization id")
        payload = self.probe("org", ORG_PATHS).json()
        org = _first_value(payload, ("organization_id", "org_id", "zoid", "id"))
        if not org:
            raise CliqError(f"Could not find an org id in the response: {json.dumps(payload)[:400]}")
        log(f"Organization id: {org}")
        return str(org)

    # -- channels -------------------------------------------------------
    def find_channel(self, name: str, org: str) -> Dict[str, Any]:
        log(f"Looking up channel {name!r}")
        channels = self._all_channels(org)
        if not channels:
            raise CliqError("The channels endpoint returned nothing - is the account a member of any channel?")

        wanted = name.strip().casefold()
        exact = [c for c in channels if str(c.get("name", "")).strip().casefold() == wanted]
        if not exact:
            exact = [c for c in channels if wanted in str(c.get("name", "")).strip().casefold()]
        if not exact:
            available = ", ".join(sorted(str(c.get("name")) for c in channels if c.get("name"))[:40])
            raise CliqError(f"No channel matching {name!r}. Visible channels: {available}")
        if len(exact) > 1:
            names = ", ".join(str(c.get("name")) for c in exact)
            raise CliqError(f"{name!r} is ambiguous ({names}) - pass --chat-id to pick one.")

        channel = exact[0]
        log(f"Matched channel {channel.get('name')!r} (chat id {_chat_id(channel)})")
        return channel

    def _all_channels(self, org: str) -> List[Dict[str, Any]]:
        """Page through the channel list; Cliq caps a page at 100."""
        out: List[Dict[str, Any]] = []
        start, limit = 1, 100
        while True:
            resp = self.probe("channel", CHANNEL_PATHS, org=org,
                              params={"limit": limit, "fromindex": start})
            batch = _as_list(resp.json())
            out.extend(batch)
            if len(batch) < limit or len(out) > 5000:
                break
            start += limit
        return out

    # -- export ---------------------------------------------------------
    def start_export(self, chat_id: str, org: str, frm: Optional[int], to: Optional[int]) -> str:
        log(f"Triggering bulk export for chat {chat_id}")
        body: Dict[str, Any] = {"chat_ids": [chat_id], "export_type": "conversations"}
        if frm is not None:
            body["from_time"] = frm
        if to is not None:
            body["to_time"] = to

        payload = self.probe("export_start", EXPORT_START_PATHS, "POST", org=org, json_body=body).json()
        job = _first_value(payload, ("job_id", "jobid", "export_id", "id", "request_id"))
        if not job:
            raise CliqError(f"Export started but no job id was returned: {json.dumps(payload)[:400]}")
        log(f"Export job id: {job}")
        return str(job)

    def wait_for_export(self, job: str, org: str, interval: int, timeout: int) -> Dict[str, Any]:
        log(f"Polling job {job} (every {interval}s, giving up after {timeout}s)")
        deadline = time.time() + timeout
        delay = interval
        while time.time() < deadline:
            payload = self.probe("export_status", EXPORT_STATUS_PATHS, org=org, job=job).json()
            state = str(_first_value(payload, ("status", "state", "job_status")) or "").casefold()

            if state in DONE_STATES:
                log(f"Job {job} finished: {state}")
                return payload
            if state in FAIL_STATES:
                reason = _first_value(payload, ("message", "error", "reason")) or state
                raise CliqError(f"Export job {job} failed: {reason}")

            log(f"  status={state or 'unknown'} - waiting {delay}s")
            time.sleep(delay)
            delay = min(delay * 2, 60)  # back off, but keep checking at least once a minute

        raise CliqError(
            f"Export job {job} did not finish within {timeout}s. It may still complete - "
            f"re-check it with: --resume-job {job}"
        )

    def download(self, payload: Dict[str, Any], dest: str) -> str:
        url = _first_value(payload, ("download_url", "downloadurl", "file_url", "url", "download_link"))
        if not url:
            raise CliqError(f"Completed job carried no download URL: {json.dumps(payload)[:400]}")

        log(f"Downloading export to {dest}")
        resp = request("GET", str(url), headers=self.tokens.auth_header(), timeout=300)
        if resp.status >= 400:
            raise CliqError(f"Download failed: HTTP {resp.status} - {resp.text[:300]}")

        body = resp.body
        # Exports are commonly zipped even when the field is called *_json.
        if body[:4] == b"PK\x03\x04":
            log("Response is a zip archive - extracting JSON members")
            body = _merge_zip_json(body)

        with open(dest, "wb") as fh:
            fh.write(body)
        log(f"Wrote {len(body):,} bytes to {dest}")
        return dest


def _merge_zip_json(blob: bytes) -> bytes:
    """Concatenate every JSON member of a zip into one JSON array."""
    merged: List[Any] = []
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        names = [n for n in zf.namelist() if n.lower().endswith(".json")]
        if not names:
            raise CliqError(f"Zip contained no .json files (members: {zf.namelist()[:10]})")
        for name in names:
            try:
                merged.extend(_as_list(json.loads(zf.read(name).decode("utf-8", "replace"))))
            except json.JSONDecodeError as exc:
                log(f"Warning: skipping unparsable member {name}: {exc}")
    return json.dumps(merged).encode("utf-8")


# --------------------------------------------------------------------------
# Shape-tolerant helpers - export payloads differ between tenants/versions
# --------------------------------------------------------------------------

def _first_value(payload: Any, keys: Sequence[str], _depth: int = 0) -> Optional[Any]:
    """Depth-first search for the first of `keys` holding a non-empty scalar."""
    if _depth > 6:
        return None
    if isinstance(payload, dict):
        for key in keys:
            val = payload.get(key)
            if val not in (None, "", [], {}):
                return val
        for val in payload.values():
            if isinstance(val, (dict, list)):
                found = _first_value(val, keys, _depth + 1)
                if found is not None:
                    return found
    elif isinstance(payload, list):
        for item in payload[:50]:
            found = _first_value(item, keys, _depth + 1)
            if found is not None:
                return found
    return None


def _as_list(payload: Any) -> List[Dict[str, Any]]:
    """Pull the list of records out of whatever wrapper the API used."""
    if isinstance(payload, list):
        return [p for p in payload if isinstance(p, dict)]
    if isinstance(payload, dict):
        for key in ("data", "messages", "chats", "channels", "conversations",
                    "organizations", "list", "records", "result"):
            val = payload.get(key)
            if isinstance(val, list):
                return [p for p in val if isinstance(p, dict)]
            if isinstance(val, dict):
                nested = _as_list(val)
                if nested:
                    return nested
        # A single bare record.
        if any(k in payload for k in ("id", "chat_id", "name", "text")):
            return [payload]
    return []


def _chat_id(channel: Dict[str, Any]) -> Optional[str]:
    val = _first_value(channel, ("chat_id", "chatid", "id", "channel_id", "unique_name"))
    return str(val) if val is not None else None


# --------------------------------------------------------------------------
# Message normalisation and threading
# --------------------------------------------------------------------------

MSG_TIME_KEYS = ("time", "timestamp", "sent_time", "created_time", "msg_time", "message_time")
MSG_TEXT_KEYS = ("text", "message", "content", "msg", "comment", "body")
MSG_ID_KEYS = ("id", "message_id", "msg_id", "msguid", "time")
THREAD_KEYS = ("thread_id", "threadid", "parent_msg_id", "parent_id", "reply_to", "thread")
SENDER_KEYS = ("sender", "user", "from", "author", "posted_by", "creator")
NAME_KEYS = ("display_name", "name", "dname", "first_name", "sender_name", "user_name")
EMAIL_KEYS = ("email", "email_id", "emailid", "zuid_email", "mail")


class Message:
    __slots__ = ("id", "ts", "text", "sender_name", "sender_email", "thread_key", "raw")

    def __init__(self, raw: Dict[str, Any]):
        self.raw = raw
        self.id = str(_first_value(raw, MSG_ID_KEYS) or "")
        self.ts = _parse_ts(_first_value(raw, MSG_TIME_KEYS))
        self.text = _extract_text(raw)
        self.sender_name, self.sender_email = _extract_sender(raw)
        thread = _first_value(raw, THREAD_KEYS)
        self.thread_key = str(thread) if thread not in (None, "", 0, "0") else ""

    @property
    def when(self) -> Optional[datetime]:
        if self.ts is None:
            return None
        return datetime.fromtimestamp(self.ts, tz=timezone.utc)


def _parse_ts(val: Any) -> Optional[float]:
    """Normalise Cliq timestamps (usually epoch millis) to epoch seconds."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        num = float(val)
        return num / 1000.0 if num > 1e11 else num
    text = str(val).strip()
    if not text:
        return None
    if text.isdigit():
        num = float(text)
        return num / 1000.0 if num > 1e11 else num
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(text, fmt)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.timestamp()
        except ValueError:
            continue
    return None


def _extract_text(raw: Dict[str, Any]) -> str:
    """Cliq message bodies nest differently per message type; try hard, then flatten."""
    content = raw.get("content")
    if isinstance(content, dict):
        for key in ("text", "comment", "message"):
            if isinstance(content.get(key), str) and content[key].strip():
                return content[key].strip()
    for key in MSG_TEXT_KEYS:
        val = raw.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    val = _first_value(raw, MSG_TEXT_KEYS)
    if isinstance(val, str) and val.strip():
        return val.strip()
    # Attachment-/card-only messages have no text at all.
    if raw.get("file") or raw.get("attachments"):
        return "[attachment]"
    return ""


def _extract_sender(raw: Dict[str, Any]) -> Tuple[str, str]:
    node: Any = None
    for key in SENDER_KEYS:
        if isinstance(raw.get(key), dict):
            node = raw[key]
            break
        if isinstance(raw.get(key), str) and raw[key].strip():
            node = {"name": raw[key]}
            break
    if node is None:
        node = raw

    name = _first_value(node, NAME_KEYS) or _first_value(raw, NAME_KEYS) or ""
    email = _first_value(node, EMAIL_KEYS) or _first_value(raw, EMAIL_KEYS) or ""
    email = str(email).strip()
    if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        email = ""
    return str(name).strip(), email


def load_messages(path: str) -> List[Message]:
    """Read a Cliq export: one JSON document, or one JSON object per line.

    Both start with '{', so the format is decided by parsing rather than by
    sniffing the first byte.
    """
    with open(path, "r", encoding="utf-8-sig") as fh:
        blob = fh.read()

    if not blob.strip():
        raise CliqError(f"{path} is empty")

    try:
        records = _as_list(json.loads(blob))
    except json.JSONDecodeError:
        records = []
        bad = 0
        for line in blob.splitlines():
            line = line.strip().rstrip(",")
            if not line:
                continue
            try:
                records.extend(_as_list(json.loads(line)))
            except json.JSONDecodeError:
                bad += 1
        if not records:
            raise CliqError(
                f"{path} is neither valid JSON nor JSON Lines "
                f"({bad} unparsable line(s))."
            ) from None
        if bad:
            log(f"Warning: skipped {bad} unparsable line(s) in {path}")

    messages = [Message(r) for r in records]
    messages = [m for m in messages if m.text]
    messages.sort(key=lambda m: (m.ts if m.ts is not None else 0.0))
    return messages


def group_threads(messages: Iterable[Message], gap_minutes: int) -> List[List[Message]]:
    """Group messages into conversation threads -> one HD Ticket each.

    Cliq threads are only explicit when someone used a reply-thread. Everything
    else is a flat channel stream, so it is sessionised: a gap longer than
    --thread-gap-minutes between consecutive messages starts a new ticket.
    Set --thread-gap-minutes 0 to put the whole channel into a single ticket.
    """
    explicit: Dict[str, List[Message]] = {}
    flat: List[Message] = []
    for msg in messages:
        if msg.thread_key:
            explicit.setdefault(msg.thread_key, []).append(msg)
        else:
            flat.append(msg)

    threads: List[List[Message]] = [sorted(v, key=lambda m: m.ts or 0) for v in explicit.values()]

    if flat:
        if gap_minutes <= 0:
            threads.append(flat)
        else:
            gap = gap_minutes * 60
            current: List[Message] = []
            for msg in flat:
                if current and msg.ts is not None and current[-1].ts is not None \
                        and (msg.ts - current[-1].ts) > gap:
                    threads.append(current)
                    current = []
                current.append(msg)
            if current:
                threads.append(current)

    threads = [t for t in threads if t]
    threads.sort(key=lambda t: t[0].ts or 0)
    return threads


# --------------------------------------------------------------------------
# Frappe Helpdesk HD Ticket CSV
# --------------------------------------------------------------------------

CORE_COLUMNS = ["Subject", "Description", "Raised By", "Status"]
DATE_COLUMNS = ["Opening Date", "Opening Time"]


def make_subject(thread: List[Message], limit: int = 140) -> str:
    """First message of the thread, collapsed to a single line."""
    first = thread[0].text
    subject = re.sub(r"\s+", " ", first).strip()
    subject = re.sub(r"^[>*_`#-]+\s*", "", subject)
    if not subject:
        subject = "(no subject)"
    if len(subject) > limit:
        subject = subject[: limit - 1].rstrip() + "…"
    return subject


def make_description(thread: List[Message], fmt: str) -> str:
    """The whole thread, rendered for Frappe's description field."""
    lines = []
    for msg in thread:
        stamp = msg.when.strftime("%Y-%m-%d %H:%M UTC") if msg.when else "unknown time"
        who = msg.sender_name or msg.sender_email or "Unknown"
        if fmt == "text":
            lines.append(f"[{stamp}] {who}: {msg.text}")
        else:
            body = html.escape(msg.text).replace("\n", "<br>")
            lines.append(
                f"<p><strong>{html.escape(who)}</strong> "
                f"<em>({html.escape(stamp)})</em><br>{body}</p>"
            )
    return ("\n" if fmt == "text" else "\n").join(lines)


def make_raised_by(thread: List[Message], fallback: str, domain: str) -> str:
    """Frappe's raised_by is an email field, so a bare display name won't import."""
    originator = thread[0]
    if originator.sender_email:
        return originator.sender_email
    # Any later email from the same person is still the right person.
    for msg in thread:
        if msg.sender_email and msg.sender_name == originator.sender_name:
            return msg.sender_email
    if domain and originator.sender_name:
        slug = re.sub(r"[^a-z0-9]+", ".", originator.sender_name.casefold()).strip(".")
        if slug:
            return f"{slug}@{domain.lstrip('@')}"
    return fallback


def write_csv(
    threads: List[List[Message]],
    dest: str,
    *,
    status: str,
    fallback_email: str,
    email_domain: str,
    description_format: str,
    with_dates: bool,
) -> Tuple[int, int]:
    columns = list(CORE_COLUMNS) + (DATE_COLUMNS if with_dates else [])
    missing_email = 0

    # utf-8-sig: Frappe's importer and Excel both read the BOM correctly.
    with open(dest, "w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for thread in threads:
            raised_by = make_raised_by(thread, fallback_email, email_domain)
            if raised_by == fallback_email:
                missing_email += 1
            row = {
                "Subject": make_subject(thread),
                "Description": make_description(thread, description_format),
                "Raised By": raised_by,
                "Status": status,
            }
            if with_dates:
                when = thread[0].when
                row["Opening Date"] = when.strftime("%Y-%m-%d") if when else ""
                row["Opening Time"] = when.strftime("%H:%M:%S") if when else ""
            writer.writerow(row)

    return len(threads), missing_email


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def _epoch_millis(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    try:
        dt = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise SystemExit(f"--from/--to must be YYYY-MM-DD, got {value!r}")
    return int(dt.timestamp() * 1000)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command")

    def add_convert_args(p: argparse.ArgumentParser) -> None:
        p.add_argument("--status", default="Closed", help="HD Ticket status (default: Closed)")
        p.add_argument("--thread-gap-minutes", type=int, default=60,
                       help="Minutes of silence that start a new ticket in a flat channel "
                            "(default: 60; 0 = one ticket for the whole channel)")
        p.add_argument("--description-format", choices=("html", "text"), default="html",
                       help="Frappe's description is a rich-text field (default: html)")
        p.add_argument("--fallback-email", default="unknown@example.com",
                       help="Used when a sender has no email in the export")
        p.add_argument("--email-domain", default="",
                       help="Synthesise raised_by as first.last@DOMAIN when the export has no email")
        p.add_argument("--with-dates", action="store_true",
                       help="Also emit Opening Date / Opening Time columns")

    run = sub.add_parser("run", help="Full pipeline: authenticate, export, download, convert")
    run.add_argument("--dc", default="eu", choices=sorted(API_HOSTS), help="Zoho data centre (default: eu)")
    run.add_argument("--channel", default=DEFAULT_CHANNEL, help=f"Channel name (default: {DEFAULT_CHANNEL!r})")
    run.add_argument("--chat-id", help="Skip channel lookup and export this chat id directly")
    run.add_argument("--org-id", help="Skip organization lookup")
    run.add_argument("--from", dest="from_date", help="Export messages from this date (YYYY-MM-DD)")
    run.add_argument("--to", dest="to_date", help="Export messages up to this date (YYYY-MM-DD)")
    run.add_argument("--raw-output", default="cliq_export.json", help="Where to save the downloaded JSON")
    run.add_argument("--output", "-o", default="hd_tickets.csv", help="Where to write the CSV")
    run.add_argument("--poll-interval", type=int, default=10, help="Seconds between status checks")
    run.add_argument("--poll-timeout", type=int, default=1800, help="Give up after this many seconds")
    run.add_argument("--resume-job", help="Skip triggering and poll/download this existing job id")
    run.add_argument("--token-cache", default=DEFAULT_TOKEN_CACHE)
    run.add_argument("--redirect-uri", default=os.environ.get("ZOHO_REDIRECT_URI"))
    run.add_argument("--client-id", default=os.environ.get("ZOHO_CLIENT_ID"))
    run.add_argument("--client-secret", default=os.environ.get("ZOHO_CLIENT_SECRET"))
    run.add_argument("--grant-token", default=os.environ.get("ZOHO_GRANT_TOKEN"))
    for kind in ("org", "channel", "export-start", "export-status"):
        run.add_argument(f"--{kind}-path", help=f"Pin the {kind} endpoint path instead of probing")
    add_convert_args(run)

    conv = sub.add_parser("convert", help="Convert an already-downloaded export JSON to CSV")
    conv.add_argument("--input", "-i", required=True, help="Downloaded Cliq export JSON")
    conv.add_argument("--output", "-o", default="hd_tickets.csv")
    add_convert_args(conv)

    return parser


def do_convert(args: argparse.Namespace, src: str, dest: str) -> None:
    messages = load_messages(src)
    if not messages:
        raise CliqError(f"No messages with text found in {src}")
    log(f"Loaded {len(messages):,} messages")

    threads = group_threads(messages, args.thread_gap_minutes)
    log(f"Grouped into {len(threads):,} threads")

    count, missing = write_csv(
        threads,
        dest,
        status=args.status,
        fallback_email=args.fallback_email,
        email_domain=args.email_domain,
        description_format=args.description_format,
        with_dates=args.with_dates,
    )
    log(f"Wrote {count:,} HD Ticket rows to {dest}")
    if missing:
        log(f"Warning: {missing:,} rows fell back to {args.fallback_email!r} because the "
            f"export carried no sender email. Frappe requires a valid email in 'Raised By' - "
            f"pass --email-domain to synthesise one.")


def do_run(args: argparse.Namespace) -> None:
    for name, val in (("--client-id", args.client_id), ("--client-secret", args.client_secret)):
        if not val:
            raise CliqError(f"{name} is required (or set the matching ZOHO_* environment variable)")

    tokens = TokenManager(
        client_id=args.client_id,
        client_secret=args.client_secret,
        dc=args.dc,
        grant_token=args.grant_token,
        redirect_uri=args.redirect_uri,
        cache_path=args.token_cache,
    )
    pinned = {
        kind: getattr(args, f"{kind.replace('-', '_')}_path")
        for kind in ("org", "channel", "export-start", "export-status")
        if getattr(args, f"{kind.replace('-', '_')}_path")
    }
    pinned = {k.replace("-", "_"): v for k, v in pinned.items()}
    client = CliqClient(tokens, args.dc, pinned)

    org = args.org_id or client.org_id()

    if args.resume_job:
        job = args.resume_job
        log(f"Resuming existing job {job}")
    else:
        chat_id = args.chat_id
        if not chat_id:
            chat_id = _chat_id(client.find_channel(args.channel, org))
        if not chat_id:
            raise CliqError("Could not determine a chat id for the channel - pass --chat-id.")
        job = client.start_export(chat_id, org, _epoch_millis(args.from_date), _epoch_millis(args.to_date))

    status = client.wait_for_export(job, org, args.poll_interval, args.poll_timeout)
    raw = client.download(status, args.raw_output)
    do_convert(args, raw, args.output)


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.command:
        parser.print_help()
        return 2
    try:
        if args.command == "run":
            do_run(args)
        else:
            do_convert(args, args.input, args.output)
    except CliqError as exc:
        log(f"ERROR: {exc}")
        return 1
    except KeyboardInterrupt:
        log("Interrupted")
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
