from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.utils import strip_tags


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    name_he: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(income|expense)$")
    icon: str = Field(default="circle", max_length=50)
    color: str = Field(default="#6B7280", max_length=7, pattern="^#[0-9a-fA-F]{6}$")
    parent_id: Optional[UUID] = None
    display_order: int = Field(default=0, ge=0, le=9999)

    @field_validator('name', 'name_he')
    @classmethod
    def validate_names(cls, v: str) -> str:
        v = strip_tags(v)
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty or whitespace-only")
        return v


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    name_he: Optional[str] = Field(None, min_length=1, max_length=100)
    type: Optional[str] = Field(None, pattern="^(income|expense)$")
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=7, pattern="^#[0-9a-fA-F]{6}$")
    parent_id: Optional[UUID] = None
    display_order: Optional[int] = Field(None, ge=0, le=9999)


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    name_he: str
    type: str
    icon: str
    color: str
    parent_id: Optional[UUID]
    is_archived: bool
    display_order: int

    model_config = {"from_attributes": True}


class CategoryListResponse(BaseModel):
    items: List[CategoryResponse]
    total: int
    page: int
    page_size: int
    pages: int


class CategoryReorder(BaseModel):
    ordered_ids: List[UUID] = Field(..., min_length=1, max_length=500)
