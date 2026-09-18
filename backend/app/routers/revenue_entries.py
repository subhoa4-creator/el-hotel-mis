from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_role

router = APIRouter(prefix="/api/revenue-entries", tags=["revenue-entries"])

@router.get("/")
def list_revenue(branch_id: int = Query(None), month: int = Query(None),
                 year: int = Query(None), db: Session = Depends(get_db)):
    q = db.query(models.RevenueEntry)
    if branch_id: q = q.filter_by(branch_id=branch_id)
    if month: q = q.filter_by(month=month)
    if year: q = q.filter_by(year=year)
    return [{
        "id": r.id, "branch_id": r.branch_id, "month": r.month, "year": r.year,
        "room_revenue": float(r.room_revenue), "fnb_revenue": float(r.fnb_revenue),
        "other_income": float(r.other_income), "discount": float(r.discount),
        "gst": float(r.gst), "rooms_available": r.rooms_available,
        "rooms_occupied": r.rooms_occupied, "pax_fnb": r.pax_fnb
    } for r in q.all()]

@router.post("/bulk")
def upsert_bulk(entries: list[schemas.RevenueEntryIn], db: Session = Depends(get_db),
                user=Depends(require_role("admin", "accounts", "manager"))):
    for e in entries:
        existing = (db.query(models.RevenueEntry)
                    .filter_by(branch_id=e.branch_id, month=e.month, year=e.year).first())
        if existing:
            for k, v in e.model_dump().items(): setattr(existing, k, v)
            existing.entered_by = user.id
        else:
            db.add(models.RevenueEntry(**e.model_dump(), entered_by=user.id))
    db.commit()
    return {"ok": True, "count": len(entries)}
