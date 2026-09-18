from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_role

router = APIRouter(prefix="/api/expense-ledgers", tags=["expense-ledgers"])

@router.get("/", response_model=list[schemas.ExpenseLedgerOut])
def list_ledgers(db: Session = Depends(get_db)):
    return db.query(models.ExpenseLedger).order_by(models.ExpenseLedger.name).all()

@router.post("/", response_model=schemas.ExpenseLedgerOut)
def create_ledger(data: schemas.ExpenseLedgerIn, db: Session = Depends(get_db),
                  user=Depends(require_role("admin", "accounts"))):
    l = models.ExpenseLedger(**data.model_dump())
    db.add(l); db.commit(); db.refresh(l)
    return l

@router.delete("/{id}")
def delete_ledger(id: int, db: Session = Depends(get_db),
                  user=Depends(require_role("admin"))):
    l = db.query(models.ExpenseLedger).get(id)
    if not l: raise HTTPException(404, "Not found")
    db.delete(l); db.commit()
    return {"ok": True}
