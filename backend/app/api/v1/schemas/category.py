from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    name_he: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., pattern="^(income|expense)$")
    icon: str = Field(default="circle", max_length=50)
    color: str = Field(default="#6B7280", max_length=7)
    parent_id: UUID | None = None
    display_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    name_he: str | None = Field(None, min_length=1, max_length=100)
    type: str | None = Field(None, pattern="^(income|expense)$")
    icon: str | None = Field(None, max_length=50)
    color: str | None = Field(None, max_length=7)
    parent_id: UUID | None = None
    display_order: int | None = None


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    name_he: str
    type: str
    icon: str
    color: str
    parent_id: UUID | None
    is_archived: bool
    display_order: int

    model_config = {"from_attributes": True}


class CategoryReorder(BaseModel):
    ordered_ids: list[UUID]
