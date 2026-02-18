from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.utils import strip_tags


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = strip_tags(v)
        v = v.strip()
        if not v:
            raise ValueError("Name must not be empty or whitespace-only")
        return v


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = strip_tags(v)
            v = v.strip()
            if not v:
                raise ValueError("Name must not be empty or whitespace-only")
        return v


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    owner_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrgMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    username: Optional[str] = None
    email: Optional[str] = None
    role: str
    joined_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}


class InviteMemberRequest(BaseModel):
    user_id: Optional[UUID] = None
    email: Optional[str] = Field(None, max_length=255)
    role: str = Field(default="member", pattern="^(admin|member|viewer)$")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v == "owner":
            raise ValueError("Cannot assign owner role through invitation")
        return v


class ChangeMemberRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(admin|member|viewer)$")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v == "owner":
            raise ValueError("Cannot assign owner role")
        return v


class SwitchOrganizationRequest(BaseModel):
    organization_id: Optional[UUID] = None
