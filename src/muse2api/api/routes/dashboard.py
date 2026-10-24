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
_FAVICON = _WEB_DIR / "favicon.ico"
_LOGO_PNG = _WEB_DIR / "logo.png"
_LOGO_WEBP = _WEB_DIR / "logo.webp"


def _html() -> str:
    return _PAGE.read_text(encoding="utf-8")


@router.get("/dashboard", response_class=HTMLResponse, include_in_schema=False)
async def dashboard() -> HTMLResponse:
    return HTMLResponse(_html(), headers={"Cache-Control": "no-cache",
                                          "X-Frame-Options": "DENY",
                                          "Referrer-Policy": "no-referrer"})


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
