#!/usr/bin/env python3
"""
Bootstrap the `Docspeare Docs` Drive folder for dogfooding.

Creates:
    Docspeare Docs/
    ├── Help/        Help      (Google Doc, imported from content/docspeare-docs/help.md)
    ├── Privacy/     Privacy   (Google Doc, imported from content/docspeare-docs/privacy.md)
    └── Terms/       Terms     (Google Doc, imported from content/docspeare-docs/terms.md)

Idempotent: finds existing folders/docs by name instead of creating duplicates.

Reuses the OAuth token from the `google-docs` skill (which holds full Drive scope).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
DOCS_SKILL_SCRIPTS = REPO_ROOT / ".claude" / "skills" / "google-docs" / "scripts"
sys.path.insert(0, str(DOCS_SKILL_SCRIPTS))

from auth import get_valid_access_token  # type: ignore  # noqa: E402

DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"
FOLDER_MIME = "application/vnd.google-apps.folder"
DOC_MIME = "application/vnd.google-apps.document"
MARKDOWN_MIME = "text/markdown"

CONTENT_DIR = REPO_ROOT / "content" / "docspeare-docs"
PAGES = [
    ("Help", "help.md"),
    ("Privacy", "privacy.md"),
    ("Terms", "terms.md"),
]
ROOT_FOLDER_NAME = "Docspeare Docs"


def _token() -> str:
    tok = get_valid_access_token()
    if not tok:
        print("❌ No valid Google access token. Run:")
        print("   cd .claude/skills/google-docs && python scripts/auth.py login")
        sys.exit(1)
    return tok


def _headers(content_type: str = "application/json") -> dict:
    return {
        "Authorization": f"Bearer {_token()}",
        "Content-Type": content_type,
    }


def _drive_request(
    method: str, path: str, *, params: Optional[dict] = None, data: Optional[dict] = None
) -> dict:
    url = f"{DRIVE_API_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=_headers(), method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace") if e.fp else str(e)
        raise RuntimeError(f"Drive {method} {path} failed ({e.code}): {detail}") from None


def find_child(name: str, parent_id: str, mime: Optional[str] = None) -> Optional[dict]:
    """Return the first non-trashed child of `parent_id` with the given name."""
    safe_name = name.replace("'", "\\'")
    q_parts = [
        f"name = '{safe_name}'",
        f"'{parent_id}' in parents",
        "trashed = false",
    ]
    if mime:
        q_parts.append(f"mimeType = '{mime}'")
    result = _drive_request(
        "GET",
        "/files",
        params={
            "q": " and ".join(q_parts),
            "fields": "files(id, name, mimeType, parents, webViewLink)",
            "spaces": "drive",
            "pageSize": 10,
        },
    )
    files = result.get("files", [])
    return files[0] if files else None


def ensure_folder(name: str, parent_id: str = "root") -> dict:
    existing = find_child(name, parent_id, mime=FOLDER_MIME)
    if existing:
        print(f"   • Folder exists: {name} ({existing['id']})")
        return existing
    created = _drive_request(
        "POST",
        "/files",
        params={"fields": "id, name, webViewLink"},
        data={
            "name": name,
            "mimeType": FOLDER_MIME,
            "parents": [parent_id],
        },
    )
    print(f"   + Created folder: {name} ({created['id']})")
    return created


def upload_markdown_as_doc(*, title: str, markdown_path: Path, parent_id: str) -> dict:
    """Upload a .md file into `parent_id`, converted to a Google Doc.

    If a Google Doc with the same title already exists in that folder, we
    update its contents in place rather than creating a duplicate.
    """
    md_bytes = markdown_path.read_bytes()
    existing = find_child(title, parent_id, mime=DOC_MIME)

    boundary = "----docspeare-bootstrap"
    if existing:
        # Replace contents of existing doc — multipart update.
        metadata = {"name": title, "mimeType": DOC_MIME}
        url = (
            f"{DRIVE_UPLOAD_BASE}/files/{existing['id']}"
            "?uploadType=multipart&fields=id,name,webViewLink"
        )
        verb = "PATCH"
        log_prefix = "   ↻ Updated doc"
    else:
        metadata = {
            "name": title,
            "mimeType": DOC_MIME,
            "parents": [parent_id],
        }
        url = (
            f"{DRIVE_UPLOAD_BASE}/files"
            "?uploadType=multipart&fields=id,name,webViewLink"
        )
        verb = "POST"
        log_prefix = "   + Created doc"

    body = (
        f"--{boundary}\r\n"
        "Content-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{json.dumps(metadata)}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {MARKDOWN_MIME}\r\n\r\n"
    ).encode("utf-8") + md_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {_token()}",
            "Content-Type": f"multipart/related; boundary={boundary}",
        },
        method=verb,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace") if e.fp else str(e)
        raise RuntimeError(f"Upload failed ({e.code}): {detail}") from None

    print(f"{log_prefix}: {title} ({result.get('id')})")
    return result


def main() -> int:
    print("Bootstrapping Drive hierarchy for Docspeare dogfooding…\n")

    # 1. Workspace-root folder
    print(f"1. Ensuring root folder: {ROOT_FOLDER_NAME}")
    root = ensure_folder(ROOT_FOLDER_NAME, parent_id="root")

    # 2 & 3. Project subfolders + their single-page docs
    results: list[tuple[str, dict, dict]] = []
    for idx, (title, md_filename) in enumerate(PAGES, start=2):
        print(f"\n{idx}. {title}")
        md_path = CONTENT_DIR / md_filename
        if not md_path.exists():
            print(f"   ⚠ Missing draft: {md_path} — skipping.")
            continue
        folder = ensure_folder(title, parent_id=root["id"])
        doc = upload_markdown_as_doc(
            title=title, markdown_path=md_path, parent_id=folder["id"]
        )
        results.append((title, folder, doc))

    # Summary
    print("\n" + "═" * 60)
    print("✅ Drive setup complete\n")
    print(f"Workspace root folder ID (paste this when you connect Drive):")
    print(f"    {root['id']}")
    print(f"    {root.get('webViewLink', '')}\n")

    if results:
        print("Pages created:")
        for title, folder, doc in results:
            print(f"  • {title}")
            print(f"      folder: {folder['id']}")
            print(f"      doc:    {doc.get('webViewLink', doc['id'])}")

    print("\nNext steps (on your side):")
    print("  1. Sign up on the app with this Google account.")
    print("  2. Create org named 'Docspeare' with slug 'docspeare'.")
    print(f"  3. Connect Drive using the folder ID above.")
    print("  4. Sync → Approve → Publish each of Help / Privacy / Terms.")
    print("  5. In Settings → Docs Site set custom_docs_domain = docspeare.com.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
