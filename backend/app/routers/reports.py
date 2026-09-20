import calendar
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from ..database import get_db
from .. import models
from .room_history import rooms_on_date, room_days_in_period

router = APIRouter(prefix="/api/reports", tags=["reports"])


# ============================================================
# FY helpers
# ============================================================

def fy_label(year: int) -> str:
    return f"{year}-{(year + 1) % 100:02d}"


def fy_end_date(year: int) -> date:
    return date(year + 1, 3, 31)


def days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _fy_conditions(model, fy_year):
    cond1 = and_(model.year == fy_year, model.month >= 4)
    cond2 = and_(model.year == fy_year + 1, model.month <= 3)
    return or_(cond1, cond2)


# ============================================================
# Data helpers
# ============================================================

def _expense_by_head(db, branch_id, month=None, year=None, fy_year=None):
    q = (
        db.query(
            models.ExpenseHead.name,
            func.coalesce(func.sum(models.ExpenseEntry.amount), 0),
        )
        .join(
            models.ExpenseLedger,
            models.ExpenseLedger.expense_head_id == models.ExpenseHead.id,
        )
        .join(
            models.ExpenseEntry,
            models.ExpenseEntry.ledger_id == models.ExpenseLedger.id,
        )
        .filter(models.ExpenseEntry.branch_id == branch_id)
    )
    if month and year:
        q = q.filter(
            models.ExpenseEntry.month == month,
            models.ExpenseEntry.year == year,
        )
    elif fy_year is not None:
        q = q.filter(_fy_conditions(models.ExpenseEntry, fy_year))
    q = q.group_by(models.ExpenseHead.name)
    return {name: float(total) for name, total in q.all()}


def _expense_by_nature(db, branch_id, month=None, year=None, fy_year=None):
    q = (
        db.query(
            models.ExpenseLedger.nature,
            func.coalesce(func.sum(models.ExpenseEntry.amount), 0),
        )
        .join(
            models.ExpenseEntry,
            models.ExpenseEntry.ledger_id == models.ExpenseLedger.id,
        )
        .filter(models.ExpenseEntry.branch_id == branch_id)
    )
    if month and year:
        q = q.filter(
            models.ExpenseEntry.month == month,
            models.ExpenseEntry.year == year,
        )
    elif fy_year is not None:
        q = q.filter(_fy_conditions(models.ExpenseEntry, fy_year))
    q = q.group_by(models.ExpenseLedger.nature)
    out = {"Fixed": 0.0, "Variable": 0.0}
    for nature, total in q.all():
        if nature in out:
            out[nature] = float(total)
    return out


def _revenue(db, branch_id, month=None, year=None, fy_year=None):
    q = db.query(
        func.coalesce(func.sum(models.RevenueEntry.room_revenue), 0),
        func.coalesce(func.sum(models.RevenueEntry.fnb_revenue), 0),
        func.coalesce(func.sum(models.RevenueEntry.other_income), 0),
        func.coalesce(func.sum(models.RevenueEntry.discount), 0),
        func.coalesce(func.sum(models.RevenueEntry.gst), 0),
        func.coalesce(func.sum(models.RevenueEntry.rooms_occupied), 0),
        func.coalesce(func.sum(models.RevenueEntry.pax_fnb), 0),
    ).filter(models.RevenueEntry.branch_id == branch_id)
    if month and year:
        q = q.filter(
            models.RevenueEntry.month == month,
            models.RevenueEntry.year == year,
        )
    elif fy_year is not None:
        q = q.filter(_fy_conditions(models.RevenueEntry, fy_year))
    r = q.first()
    return {
        "room_revenue": float(r[0]),
        "fnb_revenue": float(r[1]),
        "other_income": float(r[2]),
        "discount": float(r[3]),
        "gst": float(r[4]),
        "rooms_occupied": int(r[5]),
        "pax_fnb": int(r[6]),
    }


def _food_cost(db, branch_id, month=None, year=None, fy_year=None):
    q = db.query(
        func.coalesce(func.sum(models.FoodCost.staff_cost), 0),
        func.coalesce(func.sum(models.FoodCost.guest_cost), 0),
    ).filter(models.FoodCost.branch_id == branch_id)
    if month and year:
        q = q.filter(
            models.FoodCost.month == month,
            models.FoodCost.year == year,
        )
    elif fy_year is not None:
        q = q.filter(_fy_conditions(models.FoodCost, fy_year))
    r = q.first()
    return {"staff": float(r[0]), "guest": float(r[1])}


def _plan_sale(db, branch_id, month=None, year=None, fy_year=None):
    q = db.query(
        func.coalesce(func.sum(models.PlanSale.amount), 0)
    ).filter(models.PlanSale.branch_id == branch_id)
    if month and year:
        q = q.filter(
            models.PlanSale.month == month,
            models.PlanSale.year == year,
        )
    elif fy_year is not None:
        q = q.filter(_fy_conditions(models.PlanSale, fy_year))
    return float(q.first()[0])


# ============================================================
# Days Operational & Room Inventory using history
# ============================================================

def _period_dates(month=None, year=None, fy_year=None):
    """Return (start_date, end_date) for the period, capped by today."""
    today = date.today()

    if month and year:
        last = days_in_month(year, month)
        start = date(year, month, 1)
        end = date(year, month, last)
        return start, end

    if fy_year is not None:
        start = date(fy_year, 4, 1)
        end = date(fy_year + 1, 3, 31)
        return start, end

    return None, None


def _days_operational(branch, month=None, year=None, fy_year=None):
    if branch.is_head_office:
        return 0
    if not branch.start_date:
        return 0

    today = date.today()
    start, end = _period_dates(month, year, fy_year)
    if not start:
        return 0

    # Cap end by today (YTD partial)
    if fy_year is not None:
        end = min(today, end)

    if end < branch.start_date:
        return 0
    if start < branch.start_date:
        start = branch.start_date
    if end < start:
        return 0
    return (end - start).days + 1


def _room_days_for_period(db, branch, month=None, year=None, fy_year=None):
    """Total room-nights for the period, using day-by-day room history."""
    if branch.is_head_office:
        return 0
    if not branch.start_date:
        return 0

    today = date.today()
    start, end = _period_dates(month, year, fy_year)
    if not start:
        return 0

    # Cap end by today for YTD
    if fy_year is not None:
        end = min(today, end)

    if end < branch.start_date:
        return 0
    if start < branch.start_date:
        start = branch.start_date
    if end < start:
        return 0

    return room_days_in_period(db, branch.id, start, end)


def _safe_div(a, b):
    return (a / b) if b else 0


# ============================================================
# Main P&L
# ============================================================

def _pnl(db, branch, month=None, year=None, fy_year=None):
    branch_id = branch.id

    rev = _revenue(db, branch_id, month, year, fy_year)
    gross = rev["room_revenue"] + rev["fnb_revenue"] + rev["other_income"]
    discount = rev["discount"]
    net_revenue = gross - discount
    gst = rev["gst"]
    total_billing = net_revenue + gst

    exp = _expense_by_head(db, branch_id, month, year, fy_year)
    nat = _expense_by_nature(db, branch_id, month, year, fy_year)
    total_expenses = sum(exp.values())

    food = _food_cost(db, branch_id, month, year, fy_year)
    staff_food = food["staff"]
    guest_food = food["guest"]
    plan_sale = _plan_sale(db, branch_id, month, year, fy_year)

    rent_expense = exp.get("Rent Expense", 0)

    pure_room_sale = rev["room_revenue"] - plan_sale
    pure_fnb_sale = rev["fnb_revenue"] + plan_sale

    fixed = nat["Fixed"]
    variable = nat["Variable"]

    fixed_excl_rent = fixed - rent_expense
    net_profit = net_revenue - total_expenses
    loss_excl_rent = net_profit + rent_expense

    days_op = _days_operational(branch, month, year, fy_year)
    # Room Inventory = sum of daily rooms over the period
    room_inventory = _room_days_for_period(db, branch, month, year, fy_year)
    rooms_available = room_inventory  # same thing

    occupancy_pct = _safe_div(rev["rooms_occupied"], rooms_available)
    arr = _safe_div(pure_room_sale, rev["rooms_occupied"])
    fnb_per_room = _safe_div(rev["fnb_revenue"], rev["rooms_occupied"])
    running_cost = float(branch.running_cost_per_room or 0)
    fb_inventory = _safe_div(pure_fnb_sale, pure_room_sale + pure_fnb_sale)

    variance_fnb = pure_fnb_sale - variable
    variance_room = pure_room_sale - fixed
    shortage = -_safe_div(variance_room, arr)
    target_room_nights = rev["rooms_occupied"] + shortage
    target_room_pct = _safe_div(target_room_nights, room_inventory)
    fnb_contribution = shortage * fnb_per_room
    fb_revenue_pct = _safe_div(guest_food, pure_fnb_sale)

    fixed_pct = _safe_div(fixed, total_expenses)
    variable_pct = _safe_div(variable, total_expenses)
    employee_cost = exp.get("Employee Expenses", 0)
    fnb_cost = exp.get("Food and Beverage Expense", 0)
    hotel_opex = exp.get("Hotel / Restaurant Operating Expenses", 0)

    employee_cost_pct = _safe_div(employee_cost, total_expenses)
    fnb_cost_pct = _safe_div(fnb_cost, total_expenses)
    hotel_opex_pct = _safe_div(hotel_opex, total_expenses)
    rent_pct = _safe_div(rent_expense, total_expenses)

    employee_to_revenue = _safe_div(employee_cost, gross)
    hotel_opex_to_revenue = _safe_div(hotel_opex, gross)
    rent_to_revenue = _safe_div(rent_expense, gross)
    fnb_cost_to_fnb_revenue = _safe_div(fnb_cost, rev["fnb_revenue"])

    return {
        "branch_id": branch.id,
        "branch": branch.name,
        "is_head_office": branch.is_head_office,

        "room_revenue": rev["room_revenue"],
        "fnb_revenue": rev["fnb_revenue"],
        "other_income": rev["other_income"],
        "gross_revenue": gross,
        "discount": discount,
        "net_revenue": net_revenue,
        "gst": gst,
        "total_billing": total_billing,
        "pure_room_sale": pure_room_sale,
        "pure_fnb_sale": pure_fnb_sale,

        "expenses": exp,
        "total_expenses": total_expenses,
        "net_profit": net_profit,

        "total_fixed_expenses": fixed,
        "total_variable_expenses": variable,
        "fixed_excluding_rent": fixed_excl_rent,
        "loss_excluding_rent": loss_excl_rent,
        "staff_food_costing": staff_food,
        "guest_food_costing": guest_food,
        "plan_sale": plan_sale,

        "days_operational": days_op,
        "rooms_available": rooms_available,
        "occupancy_pct": occupancy_pct,
        "arr": arr,
        "room_inventory": room_inventory,
        "pax_fnb": rev["pax_fnb"],
        "rooms_occupied": rev["rooms_occupied"],
        "fnb_per_room": fnb_per_room,
        "running_cost_per_room": running_cost,
        "fb_inventory": fb_inventory,

        "variance_fnb": variance_fnb,
        "variance_room": variance_room,
        "room_nights_shortage": shortage,
        "target_room_nights": target_room_nights,
        "target_room_nights_pct": target_room_pct,
        "fnb_contribution": fnb_contribution,
        "fb_revenue_pct": fb_revenue_pct,

        "fixed_pct": fixed_pct,
        "variable_pct": variable_pct,
        "employee_cost_pct": employee_cost_pct,
        "fnb_cost_pct": fnb_cost_pct,
        "hotel_opex_pct": hotel_opex_pct,
        "rent_pct": rent_pct,

        "employee_to_revenue": employee_to_revenue,
        "hotel_opex_to_revenue": hotel_opex_to_revenue,
        "rent_to_revenue": rent_to_revenue,
        "fnb_cost_to_fnb_revenue": fnb_cost_to_fnb_revenue,
    }


def _aggregate_totals(branch_pnls):
    if not branch_pnls:
        return {}
    keys = [
        "room_revenue", "fnb_revenue", "other_income", "gross_revenue",
        "discount", "net_revenue", "gst", "total_billing",
        "pure_room_sale", "pure_fnb_sale",
        "total_expenses", "net_profit",
        "total_fixed_expenses", "total_variable_expenses",
        "fixed_excluding_rent", "loss_excluding_rent",
        "staff_food_costing", "guest_food_costing", "plan_sale",
        "days_operational", "rooms_available", "room_inventory",
        "pax_fnb", "rooms_occupied",
        "variance_fnb", "variance_room",
        "room_nights_shortage", "target_room_nights", "fnb_contribution",
    ]
    totals = {}
    for k in keys:
        totals[k] = sum(float(b.get(k, 0) or 0) for b in branch_pnls)

    totals["occupancy_pct"] = _safe_div(totals["rooms_occupied"], totals["rooms_available"])
    totals["arr"] = _safe_div(totals["pure_room_sale"], totals["rooms_occupied"])
    totals["fnb_per_room"] = _safe_div(totals["fnb_revenue"], totals["rooms_occupied"])
    totals["fb_inventory"] = _safe_div(
        totals["pure_fnb_sale"],
        totals["pure_room_sale"] + totals["pure_fnb_sale"],
    )
    totals["target_room_nights_pct"] = _safe_div(
        totals["target_room_nights"], totals["room_inventory"]
    )
    totals["fb_revenue_pct"] = _safe_div(
        totals["guest_food_costing"], totals["pure_fnb_sale"]
    )

    totals["fixed_pct"] = _safe_div(totals["total_fixed_expenses"], totals["total_expenses"])
    totals["variable_pct"] = _safe_div(totals["total_variable_expenses"], totals["total_expenses"])

    heads = {}
    for b in branch_pnls:
        for h, v in (b.get("expenses") or {}).items():
            heads[h] = heads.get(h, 0) + float(v or 0)
    totals["expenses"] = heads

    emp = heads.get("Employee Expenses", 0)
    fnb_cost = heads.get("Food and Beverage Expense", 0)
    hotel_opex = heads.get("Hotel / Restaurant Operating Expenses", 0)
    rent = heads.get("Rent Expense", 0)

    totals["employee_cost_pct"] = _safe_div(emp, totals["total_expenses"])
    totals["fnb_cost_pct"] = _safe_div(fnb_cost, totals["total_expenses"])
    totals["hotel_opex_pct"] = _safe_div(hotel_opex, totals["total_expenses"])
    totals["rent_pct"] = _safe_div(rent, totals["total_expenses"])

    totals["employee_to_revenue"] = _safe_div(emp, totals["gross_revenue"])
    totals["hotel_opex_to_revenue"] = _safe_div(hotel_opex, totals["gross_revenue"])
    totals["rent_to_revenue"] = _safe_div(rent, totals["gross_revenue"])
    totals["fnb_cost_to_fnb_revenue"] = _safe_div(fnb_cost, totals["fnb_revenue"])

    totals["running_cost_per_room"] = 0
    return totals


# ============================================================
# Endpoints
# ============================================================

@router.get("/monthly")
def monthly(
    month: int = Query(...),
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    out = [_pnl(db, b, month=month, year=year) for b in branches]
    return {"branches": out, "totals": _aggregate_totals(out)}


@router.get("/ytd")
def ytd(year: int = Query(...), db: Session = Depends(get_db)):
    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    out = [_pnl(db, b, fy_year=year) for b in branches]
    return {
        "fy_year": year,
        "fy_label": fy_label(year),
        "branches": out,
        "totals": _aggregate_totals(out),
    }


@router.get("/all-fy")
def all_fy(
    start_year: int = Query(None),
    db: Session = Depends(get_db),
):
    today = date.today()
    current_fy = today.year if today.month >= 4 else today.year - 1

    min_exp = db.query(func.min(models.ExpenseEntry.year)).scalar()
    min_rev = db.query(func.min(models.RevenueEntry.year)).scalar()
    candidates = [y for y in [min_exp, min_rev] if y]
    if candidates:
        for y in list(candidates):
            first_row = (
                db.query(models.ExpenseEntry.month)
                .filter(models.ExpenseEntry.year == y)
                .order_by(models.ExpenseEntry.month)
                .first()
            )
            if first_row and first_row[0] <= 3:
                candidates.append(y - 1)
        min_year = min(candidates)
    else:
        min_year = current_fy

    if start_year is not None:
        min_year = start_year

    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    fy_results = []
    for fy in range(min_year, current_fy + 1):
        branch_pnls = [_pnl(db, b, fy_year=fy) for b in branches]
        fy_results.append({
            "fy_year": fy,
            "fy_label": fy_label(fy),
            "is_current": fy == current_fy,
            "branches": branch_pnls,
            "totals": _aggregate_totals(branch_pnls),
        })
    return {"fy_list": fy_results}


@router.get("/grand-total")
def grand_total(db: Session = Depends(get_db)):
    """Sum of every FY since data begins — one single set of totals."""
    today = date.today()
    current_fy = today.year if today.month >= 4 else today.year - 1

    min_exp = db.query(func.min(models.ExpenseEntry.year)).scalar()
    min_rev = db.query(func.min(models.RevenueEntry.year)).scalar()
    candidates = [y for y in [min_exp, min_rev] if y]
    if candidates:
        min_year = min(candidates)
    else:
        min_year = current_fy

    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    # We compute each FY separately and then sum
    all_branches_data = {b.id: [] for b in branches}
    for fy in range(min_year, current_fy + 1):
        for b in branches:
            all_branches_data[b.id].append(_pnl(db, b, fy_year=fy))

    # Now sum across FYs per branch
    def sum_across_fys(list_of_pnls):
        if not list_of_pnls:
            return {}
        keys = [
            "room_revenue", "fnb_revenue", "other_income", "gross_revenue",
            "discount", "net_revenue", "gst", "total_billing",
            "pure_room_sale", "pure_fnb_sale",
            "total_expenses", "net_profit",
            "total_fixed_expenses", "total_variable_expenses",
            "fixed_excluding_rent", "loss_excluding_rent",
            "staff_food_costing", "guest_food_costing", "plan_sale",
            "days_operational", "rooms_available", "room_inventory",
            "pax_fnb", "rooms_occupied",
            "variance_fnb", "variance_room",
            "room_nights_shortage", "target_room_nights", "fnb_contribution",
        ]
        agg = {k: 0 for k in keys}
        for p in list_of_pnls:
            for k in keys:
                agg[k] += float(p.get(k, 0) or 0)
        # Expenses heads
        heads = {}
        for p in list_of_pnls:
            for h, v in (p.get("expenses") or {}).items():
                heads[h] = heads.get(h, 0) + float(v or 0)
        agg["expenses"] = heads
        # Recompute ratios
        agg["occupancy_pct"] = _safe_div(agg["rooms_occupied"], agg["rooms_available"])
        agg["arr"] = _safe_div(agg["pure_room_sale"], agg["rooms_occupied"])
        agg["fnb_per_room"] = _safe_div(agg["fnb_revenue"], agg["rooms_occupied"])
        agg["fb_inventory"] = _safe_div(
            agg["pure_fnb_sale"], agg["pure_room_sale"] + agg["pure_fnb_sale"]
        )
        agg["fixed_pct"] = _safe_div(agg["total_fixed_expenses"], agg["total_expenses"])
        agg["variable_pct"] = _safe_div(agg["total_variable_expenses"], agg["total_expenses"])
        emp = heads.get("Employee Expenses", 0)
        fnb_cost = heads.get("Food and Beverage Expense", 0)
        hotel_opex = heads.get("Hotel / Restaurant Operating Expenses", 0)
        rent = heads.get("Rent Expense", 0)
        agg["employee_cost_pct"] = _safe_div(emp, agg["total_expenses"])
        agg["fnb_cost_pct"] = _safe_div(fnb_cost, agg["total_expenses"])
        agg["hotel_opex_pct"] = _safe_div(hotel_opex, agg["total_expenses"])
        agg["rent_pct"] = _safe_div(rent, agg["total_expenses"])
        agg["employee_to_revenue"] = _safe_div(emp, agg["gross_revenue"])
        agg["hotel_opex_to_revenue"] = _safe_div(hotel_opex, agg["gross_revenue"])
        agg["rent_to_revenue"] = _safe_div(rent, agg["gross_revenue"])
        agg["fnb_cost_to_fnb_revenue"] = _safe_div(fnb_cost, agg["fnb_revenue"])
        agg["running_cost_per_room"] = 0
        return agg

    branch_results = []
    for b in branches:
        pnls = all_branches_data[b.id]
        if pnls:
            agg = sum_across_fys(pnls)
            agg["branch_id"] = b.id
            agg["branch"] = b.name
            agg["is_head_office"] = b.is_head_office
            branch_results.append(agg)

    return {
        "branches": branch_results,
        "totals": _aggregate_totals(branch_results),
    }


@router.get("/cumulative")
def cumulative(db: Session = Depends(get_db)):
    """Per FY column = running total up to and including that FY."""
    today = date.today()
    current_fy = today.year if today.month >= 4 else today.year - 1

    min_exp = db.query(func.min(models.ExpenseEntry.year)).scalar()
    min_rev = db.query(func.min(models.RevenueEntry.year)).scalar()
    candidates = [y for y in [min_exp, min_rev] if y]
    if candidates:
        min_year = min(candidates)
    else:
        min_year = current_fy

    branches = db.query(models.Branch).order_by(models.Branch.id).all()

    # Get per-FY per-branch data
    fy_data = {}
    for fy in range(min_year, current_fy + 1):
        fy_data[fy] = {b.id: _pnl(db, b, fy_year=fy) for b in branches}

    # Build cumulative per FY
    cum_list = []
    running = {b.id: None for b in branches}

    for fy in range(min_year, current_fy + 1):
        for b in branches:
            p = fy_data[fy][b.id]
            if running[b.id] is None:
                running[b.id] = p
            else:
                # Sum previous + current
                prev = running[b.id]
                merged = dict(prev)
                numeric_keys = [
                    "room_revenue", "fnb_revenue", "other_income", "gross_revenue",
                    "discount", "net_revenue", "gst", "total_billing",
                    "pure_room_sale", "pure_fnb_sale",
                    "total_expenses", "net_profit",
                    "total_fixed_expenses", "total_variable_expenses",
                    "fixed_excluding_rent", "loss_excluding_rent",
                    "staff_food_costing", "guest_food_costing", "plan_sale",
                    "days_operational", "rooms_available", "room_inventory",
                    "pax_fnb", "rooms_occupied",
                    "variance_fnb", "variance_room",
                    "room_nights_shortage", "target_room_nights", "fnb_contribution",
                ]
                for k in numeric_keys:
                    merged[k] = float(prev.get(k, 0) or 0) + float(p.get(k, 0) or 0)
                # Expenses heads
                heads = {}
                for h, v in (prev.get("expenses") or {}).items():
                    heads[h] = heads.get(h, 0) + float(v or 0)
                for h, v in (p.get("expenses") or {}).items():
                    heads[h] = heads.get(h, 0) + float(v or 0)
                merged["expenses"] = heads

                # Recompute ratios
                merged["occupancy_pct"] = _safe_div(merged["rooms_occupied"], merged["rooms_available"])
                merged["arr"] = _safe_div(merged["pure_room_sale"], merged["rooms_occupied"])
                merged["fnb_per_room"] = _safe_div(merged["fnb_revenue"], merged["rooms_occupied"])
                merged["fb_inventory"] = _safe_div(
                    merged["pure_fnb_sale"],
                    merged["pure_room_sale"] + merged["pure_fnb_sale"],
                )
                merged["fixed_pct"] = _safe_div(merged["total_fixed_expenses"], merged["total_expenses"])
                merged["variable_pct"] = _safe_div(merged["total_variable_expenses"], merged["total_expenses"])
                emp = heads.get("Employee Expenses", 0)
                fnb_cost = heads.get("Food and Beverage Expense", 0)
                hotel_opex = heads.get("Hotel / Restaurant Operating Expenses", 0)
                rent = heads.get("Rent Expense", 0)
                merged["employee_cost_pct"] = _safe_div(emp, merged["total_expenses"])
                merged["fnb_cost_pct"] = _safe_div(fnb_cost, merged["total_expenses"])
                merged["hotel_opex_pct"] = _safe_div(hotel_opex, merged["total_expenses"])
                merged["rent_pct"] = _safe_div(rent, merged["total_expenses"])
                merged["employee_to_revenue"] = _safe_div(emp, merged["gross_revenue"])
                merged["hotel_opex_to_revenue"] = _safe_div(hotel_opex, merged["gross_revenue"])
                merged["rent_to_revenue"] = _safe_div(rent, merged["gross_revenue"])
                merged["fnb_cost_to_fnb_revenue"] = _safe_div(fnb_cost, merged["fnb_revenue"])
                merged["running_cost_per_room"] = 0
                running[b.id] = merged

        branch_snapshot = []
        for b in branches:
            snap = dict(running[b.id])
            snap["branch_id"] = b.id
            snap["branch"] = b.name
            snap["is_head_office"] = b.is_head_office
            branch_snapshot.append(snap)

        cum_list.append({
            "fy_year": fy,
            "fy_label": fy_label(fy),
            "is_current": fy == current_fy,
            "branches": branch_snapshot,
            "totals": _aggregate_totals(branch_snapshot),
        })

    return {"fy_list": cum_list}


@router.get("/comparison")
def comparison(
    month_a: int = Query(...),
    year_a: int = Query(...),
    month_b: int = Query(...),
    year_b: int = Query(...),
    db: Session = Depends(get_db),
):
    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    a_list = [_pnl(db, b, month=month_a, year=year_a) for b in branches]
    b_list = [_pnl(db, b, month=month_b, year=year_b) for b in branches]
    return {
        "period_a": {"branches": a_list, "totals": _aggregate_totals(a_list)},
        "period_b": {"branches": b_list, "totals": _aggregate_totals(b_list)},
    }
