from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models, schemas
from ..database import get_db
from ..auth import require_role

router = APIRouter(prefix="/api/room-history", tags=["room-history"])


# ============================================================
# Room count lookup helpers
# ============================================================

def rooms_on_date(db, branch_id: int, on_date: date) -> int:
    """Return the effective room count for a branch on a specific date.
    Falls back to branch.rooms if no history exists."""
    row = (
        db.query(models.BranchRoomHistory)
        .filter(
            models.BranchRoomHistory.branch_id == branch_id,
            models.BranchRoomHistory.from_date <= on_date,
        )
        .order_by(models.BranchRoomHistory.from_date.desc())
        .first()
    )
    if row:
        return int(row.rooms)
    branch = db.query(models.Branch).get(branch_id)
    return int(branch.rooms) if branch else 0


def room_days_in_period(db, branch_id: int, start_date: date, end_date: date) -> int:
    """Sum of room counts day by day for the period (inclusive)."""
    if end_date < start_date:
        return 0
    total = 0
    # Fetch all changes overlapping the period
    changes = (
        db.query(models.BranchRoomHistory)
        .filter(
            models.BranchRoomHistory.branch_id == branch_id,
        )
        .order_by(models.BranchRoomHistory.from_date.asc())
        .all()
    )
    branch = db.query(models.Branch).get(branch_id)
    default_rooms = int(branch.rooms) if branch else 0

    # Determine rooms at start
    current_rooms = default_rooms
    for ch in changes:
        if ch.from_date <= start_date:
            current_rooms = int(ch.rooms)
        else:
            break

    # Walk through the period
    day = start_date
    idx = 0
    # Advance idx past changes already applied
    while idx < len(changes) and changes[idx].from_date <= start_date:
        idx += 1

    while day <= end_date:
        # Apply any change scheduled for this day
        while idx < len(changes) and changes[idx].from_date == day:
            current_rooms = int(changes[idx].rooms)
            idx += 1
        total += current_rooms
        day = day + timedelta(days=1)
    return total


# ============================================================
# CRUD endpoints
# ============================================================

@router.get("/")
def list_history(
    branch_id: int = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.BranchRoomHistory)
    if branch_id:
        q = q.filter_by(branch_id=branch_id)
    q = q.order_by(
        models.BranchRoomHistory.branch_id,
        models.BranchRoomHistory.from_date,
    )
    return [
        {
            "id": h.id,
            "branch_id": h.branch_id,
            "from_date": h.from_date.isoformat(),
            "rooms": h.rooms,
            "notes": h.notes,
        }
        for h in q.all()
    ]


@router.post("/", response_model=schemas.RoomHistoryOut)
def create_history(
    data: schemas.RoomHistoryIn,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin", "accounts")),
):
    h = models.BranchRoomHistory(**data.model_dump())
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.put("/{id}", response_model=schemas.RoomHistoryOut)
def update_history(
    id: int,
    data: schemas.RoomHistoryIn,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin", "accounts")),
):
    h = db.query(models.BranchRoomHistory).get(id)
    if not h:
        raise HTTPException(404, "Room history entry not found")
    h.branch_id = data.branch_id
    h.from_date = data.from_date
    h.rooms = data.rooms
    h.notes = data.notes
    db.commit()
    db.refresh(h)
    return h


@router.delete("/{id}")
def delete_history(
    id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role("admin")),
):
    h = db.query(models.BranchRoomHistory).get(id)
    if not h:
        raise HTTPException(404, "Room history entry not found")
    db.delete(h)
    db.commit()
    return {"ok": True}
