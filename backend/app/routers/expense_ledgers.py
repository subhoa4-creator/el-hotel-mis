from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_role

router = APIRouter(prefix="/api/expense-ledgers", tags=["expense-ledgers"])


@router.get("/")
def list_ledgers(db: Session = Depends(get_db)):
    """Return ledgers with their expense head nested, so the frontend
    can group them under the correct header."""
    q = (db.query(models.ExpenseLedger, models.ExpenseHead)
         .join(models.ExpenseHead,
               models.ExpenseLedger.expense_head_id == models.ExpenseHead.id,
               isouter=True)
         .order_by(models.ExpenseHead.name, models.ExpenseLedger.name))
    return [
        {
            "id": l.id,
            "name": l.name,
            "nature": l.nature,
            "expense_head_id": l.expense_head_id,
            "expense_head": {
                "id": h.id,
                "name": h.name,
            } if h else None,
        }
        for l, h in q.all()
    ]


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
