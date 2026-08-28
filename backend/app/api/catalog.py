"""The course catalogue for one programme, or for all of them."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from ..services.catalog import CatalogService
from .dependencies import get_catalog_service, require_user

router = APIRouter(tags=["catalog"])


@router.get("/catalog")
async def list_catalog(
    program_code: str | None = Query(None),
    user: dict[str, Any] = Depends(require_user),
    catalog: CatalogService = Depends(get_catalog_service),
):
    if program_code:
        return await catalog.for_programme(user["sub"], program_code)
    return await catalog.for_all_programmes(user["sub"])
