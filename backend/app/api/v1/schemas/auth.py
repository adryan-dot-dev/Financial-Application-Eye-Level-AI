from __future__ import annotations

import re
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Username must not be empty or whitespace-only")
        if not re.match(r"^[a-zA-Z0-9_.-]+$", v):
            raise ValueError(
                "Username may only contain letters, digits, underscores, dots, and hyphens"
            )
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if v.strip() != v or not v.strip():
            raise ValueError("Password must not be only whitespace")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserLogin(BaseModel):
    username: str = Field(..., min_length=1, max_length=200)
    password: str = Field(..., min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if v.strip() != v or not v.strip():
            raise ValueError("Password must not be only whitespace")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_admin: bool
    is_super_admin: bool = False
    is_active: bool

    model_config = {"from_attributes": True}


class AdminPasswordReset(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if v.strip() != v or not v.strip():
            raise ValueError("Password must not be only whitespace")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Username must not be empty or whitespace-only")
            if not re.match(r"^[a-zA-Z0-9_.-]+$", v):
                raise ValueError(
                    "Username may only contain letters, digits, underscores, dots, and hyphens"
                )
        return v

    @field_validator("full_name")
    @classmethod
    def sanitize_full_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                return None
            # Strip HTML tags to prevent stored XSS
            v = re.sub(r"<[^>]+>", "", v)
        return v


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    page_size: int
    pages: int


class UserAdminCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    is_admin: bool = False

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Username must not be empty or whitespace-only")
        if not re.match(r"^[a-zA-Z0-9_.-]+$", v):
            raise ValueError(
                "Username may only contain letters, digits, underscores, dots, and hyphens"
            )
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserAdminUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
