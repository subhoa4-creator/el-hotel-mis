from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_role

router = APIRouter(prefix="/api/expense-heads", tags=["expense-heads"])

@router.get("/", response_model=list[schemas.ExpenseHeadOut])
def list_heads(db: Session = Depends(get_db)):
    return db.query(models.ExpenseHead).order_by(models.ExpenseHead.id).all()

@router.post("/", response_model=schemas.ExpenseHeadOut)
def create_head(data: schemas.ExpenseHeadIn, db: Session = Depends(get_db),
                user=Depends(require_role("admin"))):
    h = models.ExpenseHead(**data.model_dump())
    db.add(h); db.commit(); db.refresh(h)
    return h
