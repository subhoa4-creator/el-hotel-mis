from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from .. import models

router = APIRouter(prefix="/api/reports", tags=["reports"])

def _expense_by_head(db, branch_id, month=None, year=None):
    q = (db.query(models.ExpenseHead.name,
                  func.coalesce(func.sum(models.ExpenseEntry.amount), 0))
         .join(models.ExpenseLedger, models.ExpenseLedger.expense_head_id == models.ExpenseHead.id)
         .join(models.ExpenseEntry, models.ExpenseEntry.ledger_id == models.ExpenseLedger.id)
         .filter(models.ExpenseEntry.branch_id == branch_id))
    if month: q = q.filter(models.ExpenseEntry.month == month)
    if year: q = q.filter(models.ExpenseEntry.year == year)
    q = q.group_by(models.ExpenseHead.name)
    return {name: float(total) for name, total in q.all()}

def _revenue(db, branch_id, month=None, year=None):
    q = db.query(
        func.coalesce(func.sum(models.RevenueEntry.room_revenue), 0),
        func.coalesce(func.sum(models.RevenueEntry.fnb_revenue), 0),
        func.coalesce(func.sum(models.RevenueEntry.other_income), 0),
        func.coalesce(func.sum(models.RevenueEntry.discount), 0),
        func.coalesce(func.sum(models.RevenueEntry.gst), 0),
        func.coalesce(func.sum(models.RevenueEntry.rooms_available), 0),
        func.coalesce(func.sum(models.RevenueEntry.rooms_occupied), 0),
        func.coalesce(func.sum(models.RevenueEntry.pax_fnb), 0),
    ).filter(models.RevenueEntry.branch_id == branch_id)
    if month: q = q.filter(models.RevenueEntry.month == month)
    if year: q = q.filter(models.RevenueEntry.year == year)
    r = q.first()
    return {
        "room_revenue": float(r[0]), "fnb_revenue": float(r[1]),
        "other_income": float(r[2]), "discount": float(r[3]),
        "gst": float(r[4]), "rooms_available": int(r[5]),
        "rooms_occupied": int(r[6]), "pax_fnb": int(r[7]),
    }

def _pnl(db, branch_id, month=None, year=None):
    rev = _revenue(db, branch_id, month, year)
    gross = rev["room_revenue"] + rev["fnb_revenue"] + rev["other_income"]
    net = gross - rev["discount"]
    exp = _expense_by_head(db, branch_id, month, year)
    total_exp = sum(exp.values())
    return {
        "revenue": rev, "gross_revenue": gross, "net_revenue": net,
        "total_billing": net + rev["gst"], "expenses": exp,
        "total_expenses": total_exp, "net_profit": net - total_exp,
        "occupancy_pct": (rev["rooms_occupied"] / rev["rooms_available"] * 100)
                          if rev["rooms_available"] else 0,
        "arr": (rev["room_revenue"] / rev["rooms_occupied"])
               if rev["rooms_occupied"] else 0,
    }

@router.get("/monthly")
def monthly(branch_id: int = Query(...), month: int = Query(...),
            year: int = Query(...), db: Session = Depends(get_db)):
    return _pnl(db, branch_id, month, year)

@router.get("/ytd")
def ytd(year: int = Query(...), db: Session = Depends(get_db)):
    branches = db.query(models.Branch).all()
    out = []
    totals = {"gross_revenue": 0, "total_expenses": 0, "net_profit": 0}
    for b in branches:
        pnl = _pnl(db, b.id, month=None, year=year)
        pnl["branch"] = b.name
        pnl["branch_id"] = b.id
        out.append(pnl)
        totals["gross_revenue"] += pnl["gross_revenue"]
        totals["total_expenses"] += pnl["total_expenses"]
        totals["net_profit"] += pnl["net_profit"]
    return {"branches": out, "totals": totals}

@router.get("/comparison")
def comparison(branch_id: int = Query(...),
               month_a: int = Query(...), year_a: int = Query(...),
               month_b: int = Query(...), year_b: int = Query(...),
               db: Session = Depends(get_db)):
    a = _pnl(db, branch_id, month_a, year_a)
    b = _pnl(db, branch_id, month_b, year_b)
    def pct(x, y): return ((y - x) / x * 100) if x else 0
    return {
        "period_a": a, "period_b": b,
        "variance": {
            "gross_revenue": pct(a["gross_revenue"], b["gross_revenue"]),
            "total_expenses": pct(a["total_expenses"], b["total_expenses"]),
            "net_profit": pct(a["net_profit"], b["net_profit"]),
        }
    }
