from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_role

router = APIRouter(prefix="/api/expense-entries", tags=["expense-entries"])

@router.get("/")
def list_entries(branch_id: int = Query(...), month: int = Query(...),
                 year: int = Query(...), db: Session = Depends(get_db)):
    q = (db.query(models.ExpenseEntry, models.ExpenseLedger, models.ExpenseHead)
         .join(models.ExpenseLedger, models.ExpenseEntry.ledger_id == models.ExpenseLedger.id)
         .join(models.ExpenseHead, models.ExpenseLedger.expense_head_id == models.ExpenseHead.id)
         .filter(models.ExpenseEntry.branch_id == branch_id,
                 models.ExpenseEntry.month == month,
                 models.ExpenseEntry.year == year))
    return [{
        "id": e.id, "ledger_id": l.id, "ledger_name": l.name,
        "expense_head": h.name, "nature": l.nature, "amount": float(e.amount)
    } for e, l, h in q.all()]

@router.post("/bulk")
def upsert_bulk(entries: list[schemas.ExpenseEntryIn], db: Session = Depends(get_db),
                user=Depends(require_role("admin", "accounts", "manager"))):
    for e in entries:
        existing = (db.query(models.ExpenseEntry)
                    .filter_by(branch_id=e.branch_id, ledger_id=e.ledger_id,
                               month=e.month, year=e.year).first())
        if existing:
            existing.amount = e.amount
            existing.entered_by = user.id
        else:
            db.add(models.ExpenseEntry(**e.model_dump(), entered_by=user.id))
    db.commit()
    return {"ok": True, "count": len(entries)}
