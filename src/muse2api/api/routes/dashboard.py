"""Admin dashboard: a single self-contained HTML page.

The page itself is public; it asks for the admin key in the browser and calls
``/admin/*`` with it, so serving the HTML reveals nothing.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse, FileResponse, Response

router = APIRouter(tags=["dashboard"])

_WEB_DIR = Path(__file__).resolve().parents[2] / "web"
_PAGE = _WEB_DIR / "dashboard.html"
_TEMPLATE = _WEB_DIR / "template.html"
_FAVICON = _WEB_DIR / "favicon.ico"
_LOGO_PNG = _WEB_DIR / "logo.png"
_LOGO_WEBP = _WEB_DIR / "logo.webp"


def _html() -> str:
    if not _TEMPLATE.exists():
        return _PAGE.read_text(encoding="utf-8")

    import re

    template = _TEMPLATE.read_text(encoding="utf-8")

    def _replace_include(match: re.Match) -> str:
        rel_path = match.group(1).strip()
        target = _WEB_DIR / rel_path
        if target.exists():
            return target.read_text(encoding="utf-8")
        return f"<!-- missing include: {rel_path} -->"

    composed = re.sub(r"<!--\s*INCLUDE:([^\s>]+)\s*-->", _replace_include, template)
    return composed


@router.get("/dashboard", response_class=HTMLResponse, include_in_schema=False)
async def dashboard() -> HTMLResponse:
    return HTMLResponse(
        _html(),
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
        },
    )


@router.get("/static/{file_path:path}", include_in_schema=False)
async def static_file(file_path: str) -> Response:
    p = (_WEB_DIR / file_path).resolve()
    if not str(p).startswith(str(_WEB_DIR.resolve())) or not p.is_file():
        return Response(status_code=404)
    return FileResponse(p, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


@router.get("/favicon.ico", include_in_schema=False)
async def favicon() -> Response:
    if _FAVICON.exists():
        return FileResponse(_FAVICON, media_type="image/x-icon")
    return Response(status_code=404)


@router.get("/logo.png", include_in_schema=False)
async def logo_png() -> Response:
    if _LOGO_PNG.exists():
        return FileResponse(_LOGO_PNG, media_type="image/png")
    return Response(status_code=404)


@router.get("/logo.webp", include_in_schema=False)
async def logo_webp() -> Response:
    if _LOGO_WEBP.exists():
        return FileResponse(_LOGO_WEBP, media_type="image/webp")
    return Response(status_code=404)
