from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_role

router = APIRouter(prefix="/api/branches", tags=["branches"])

@router.get("/", response_model=list[schemas.BranchOut])
def list_branches(db: Session = Depends(get_db)):
    return db.query(models.Branch).order_by(models.Branch.id).all()

@router.post("/", response_model=schemas.BranchOut)
def create_branch(data: schemas.BranchIn, db: Session = Depends(get_db),
                  user=Depends(require_role("admin"))):
    b = models.Branch(**data.model_dump())
    db.add(b); db.commit(); db.refresh(b)
    return b

@router.put("/{id}", response_model=schemas.BranchOut)
def update_branch(id: int, data: schemas.BranchIn, db: Session = Depends(get_db),
                  user=Depends(require_role("admin"))):
    b = db.query(models.Branch).get(id)
    if not b: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items(): setattr(b, k, v)
    db.commit(); db.refresh(b)
    return b

@router.delete("/{id}")
def delete_branch(id: int, db: Session = Depends(get_db),
                  user=Depends(require_role("admin"))):
    b = db.query(models.Branch).get(id)
    if not b: raise HTTPException(404, "Not found")
    db.delete(b); db.commit()
    return {"ok": True}
