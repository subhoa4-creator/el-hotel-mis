from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_role

router = APIRouter(prefix="/api/plan-sales", tags=["plan-sales"])


@router.get("/")
def list_plan_sales(
    branch_id: int = Query(None),
    month: int = Query(None),
    year: int = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.PlanSale)
    if branch_id:
        q = q.filter_by(branch_id=branch_id)
    if month:
        q = q.filter_by(month=month)
    if year:
        q = q.filter_by(year=year)
    return [
        {
            "id": ps.id,
            "branch_id": ps.branch_id,
            "month": ps.month,
            "year": ps.year,
            "amount": float(ps.amount),
        }
        for ps in q.all()
    ]


@router.post("/bulk")
def upsert_plan_sales(
    entries: list[schemas.PlanSaleIn],
    db: Session = Depends(get_db),
    user=Depends(require_role("admin", "accounts", "manager")),
):
    for e in entries:
        existing = (
            db.query(models.PlanSale)
            .filter_by(
                branch_id=e.branch_id,
                month=e.month,
                year=e.year,
            )
            .first()
        )
        if existing:
            existing.amount = e.amount
            existing.entered_by = user.id
        else:
            db.add(models.PlanSale(**e.model_dump(), entered_by=user.id))
    db.commit()
    return {"ok": True, "count": len(entries)}
