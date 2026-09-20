from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_role

router = APIRouter(prefix="/api/food-costs", tags=["food-costs"])


@router.get("/")
def list_food_costs(
    branch_id: int = Query(None),
    month: int = Query(None),
    year: int = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.FoodCost)
    if branch_id:
        q = q.filter_by(branch_id=branch_id)
    if month:
        q = q.filter_by(month=month)
    if year:
        q = q.filter_by(year=year)
    return [
        {
            "id": fc.id,
            "branch_id": fc.branch_id,
            "month": fc.month,
            "year": fc.year,
            "staff_cost": float(fc.staff_cost),
            "guest_cost": float(fc.guest_cost),
        }
        for fc in q.all()
    ]


@router.post("/bulk")
def upsert_food_costs(
    entries: list[schemas.FoodCostIn],
    db: Session = Depends(get_db),
    user=Depends(require_role("admin", "accounts", "manager")),
):
    for e in entries:
        existing = (
            db.query(models.FoodCost)
            .filter_by(
                branch_id=e.branch_id,
                month=e.month,
                year=e.year,
            )
            .first()
        )
        if existing:
            existing.staff_cost = e.staff_cost
            existing.guest_cost = e.guest_cost
            existing.entered_by = user.id
        else:
            db.add(models.FoodCost(**e.model_dump(), entered_by=user.id))
    db.commit()
    return {"ok": True, "count": len(entries)}
