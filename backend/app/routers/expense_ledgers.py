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
def create_ledger(
    data: schemas.ExpenseLedgerIn,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin", "accounts")),
):
    l = models.ExpenseLedger(**data.model_dump())
    db.add(l)
    db.commit()
    db.refresh(l)
    return l


@router.put("/{id}", response_model=schemas.ExpenseLedgerOut)
def update_ledger(
    id: int,
    data: schemas.ExpenseLedgerIn,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin", "accounts")),
):
    l = db.query(models.ExpenseLedger).get(id)
    if not l:
        raise HTTPException(404, "Ledger not found")
    l.name = data.name
    l.expense_head_id = data.expense_head_id
    l.nature = data.nature
    db.commit()
    db.refresh(l)
    return l


@router.patch("/{id}/nature")
def update_ledger_nature(
    id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin", "accounts")),
):
    """Quick endpoint to change only the nature (Fixed / Variable)."""
    nature = payload.get("nature")
    if nature not in ("Fixed", "Variable"):
        raise HTTPException(400, "nature must be 'Fixed' or 'Variable'")
    l = db.query(models.ExpenseLedger).get(id)
    if not l:
        raise HTTPException(404, "Ledger not found")
    l.nature = nature
    db.commit()
    db.refresh(l)
    return {"ok": True, "id": l.id, "nature": l.nature}


@router.delete("/{id}")
def delete_ledger(
    id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    l = db.query(models.ExpenseLedger).get(id)
    if not l:
        raise HTTPException(404, "Ledger not found")
    db.delete(l)
    db.commit()
    return {"ok": True}
