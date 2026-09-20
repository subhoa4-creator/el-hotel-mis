from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from ..database import get_db
from .. import models
from ..auth import hash_pw, require_role, get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


# ============================================================
# Schemas
# ============================================================

class UserCreateIn(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "viewer"
    branch_id: Optional[int] = None


class UserUpdateIn(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    branch_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: str
    branch_id: Optional[int]
    class Config:
        from_attributes = True


VALID_ROLES = {"admin", "accounts", "manager", "viewer"}


# ============================================================
# Endpoints
# ============================================================

@router.get("/", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    return db.query(models.User).order_by(models.User.id).all()


@router.post("/", response_model=UserOut)
def create_user(
    data: UserCreateIn,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    if data.role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {sorted(VALID_ROLES)}")
    if db.query(models.User).filter_by(email=data.email).first():
        raise HTTPException(400, "Email already registered")
    u = models.User(
        email=data.email,
        name=data.name,
        password_hash=hash_pw(data.password),
        role=data.role,
        branch_id=data.branch_id,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.put("/{id}", response_model=UserOut)
def update_user(
    id: int,
    data: UserUpdateIn,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    u = db.query(models.User).get(id)
    if not u:
        raise HTTPException(404, "User not found")

    if data.email is not None and data.email != u.email:
        if db.query(models.User).filter_by(email=data.email).first():
            raise HTTPException(400, "Email already registered")
        u.email = data.email

    if data.name is not None:
        u.name = data.name

    if data.password:
        u.password_hash = hash_pw(data.password)

    if data.role is not None:
        if data.role not in VALID_ROLES:
            raise HTTPException(400, "Invalid role")
        u.role = data.role

    if data.branch_id is not None or "branch_id" in data.model_fields_set:
        u.branch_id = data.branch_id

    db.commit()
    db.refresh(u)
    return u


@router.delete("/{id}")
def delete_user(
    id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    u = db.query(models.User).get(id)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == user.id:
        raise HTTPException(400, "You cannot delete your own account")
    db.delete(u)
    db.commit()
    return {"ok": True}


@router.get("/me")
def me(user=Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "branch_id": user.branch_id,
    }
