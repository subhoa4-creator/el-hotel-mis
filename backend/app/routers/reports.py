from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from .. import models

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _expense_by_head(db, branch_id, month=None, year=None):
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
    if month:
        q = q.filter(models.ExpenseEntry.month == month)
    if year:
        q = q.filter(models.ExpenseEntry.year == year)
    q = q.group_by(models.ExpenseHead.name)
    return {name: float(total) for name, total in q.all()}


def _expense_by_nature(db, branch_id, month=None, year=None):
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
    if month:
        q = q.filter(models.ExpenseEntry.month == month)
    if year:
        q = q.filter(models.ExpenseEntry.year == year)
    q = q.group_by(models.ExpenseLedger.nature)
    out = {"Fixed": 0.0, "Variable": 0.0}
    for nature, total in q.all():
        if nature in out:
            out[nature] = float(total)
    return out


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
    if month:
        q = q.filter(models.RevenueEntry.month == month)
    if year:
        q = q.filter(models.RevenueEntry.year == year)
    r = q.first()
    return {
        "room_revenue": float(r[0]),
        "fnb_revenue": float(r[1]),
        "other_income": float(r[2]),
        "discount": float(r[3]),
        "gst": float(r[4]),
        "rooms_available": int(r[5]),
        "rooms_occupied": int(r[6]),
        "pax_fnb": int(r[7]),
    }


def _food_cost(db, branch_id, month=None, year=None):
    q = db.query(
        func.coalesce(func.sum(models.FoodCost.staff_cost), 0),
        func.coalesce(func.sum(models.FoodCost.guest_cost), 0),
    ).filter(models.FoodCost.branch_id == branch_id)
    if month:
        q = q.filter(models.FoodCost.month == month)
    if year:
        q = q.filter(models.FoodCost.year == year)
    r = q.first()
    return {"staff": float(r[0]), "guest": float(r[1])}


def _plan_sale(db, branch_id, month=None, year=None):
    q = db.query(
        func.coalesce(func.sum(models.PlanSale.amount), 0)
    ).filter(models.PlanSale.branch_id == branch_id)
    if month:
        q = q.filter(models.PlanSale.month == month)
    if year:
        q = q.filter(models.PlanSale.year == year)
    return float(q.first()[0])


def _days_operational(branch, month=None, year=None):
    """Return days operational for the branch.
    - Head Office: always 0
    - Monthly: days in the selected month (if after start_date)
    - YTD: days from start_date to today
    """
    if branch.is_head_office:
        return 0
    if not branch.start_date:
        return 0

    today = date.today()

    if month and year:
        # Monthly: days in that specific month
        import calendar
        _, last_day = calendar.monthrange(year, month)
        month_start = date(year, month, 1)
        month_end = date(year, month, last_day)

        # Cap at branch start
        if month_end < branch.start_date:
            return 0
        if month_start < branch.start_date:
            month_start = branch.start_date
        return (month_end - month_start).days + 1
    else:
        # YTD: from start_date to today
        if today < branch.start_date:
            return 0
        return (today - branch.start_date).days + 1


def _safe_div(a, b):
    return (a / b) if b else 0


def _pnl(db, branch, month=None, year=None):
    branch_id = branch.id

    rev = _revenue(db, branch_id, month, year)
    gross = rev["room_revenue"] + rev["fnb_revenue"] + rev["other_income"]
    discount = rev["discount"]
    net_revenue = gross - discount
    gst = rev["gst"]
    total_billing = net_revenue + gst

    exp = _expense_by_head(db, branch_id, month, year)
    nat = _expense_by_nature(db, branch_id, month, year)
    total_expenses = sum(exp.values())

    food = _food_cost(db, branch_id, month, year)
    staff_food = food["staff"]
    guest_food = food["guest"]
    plan_sale = _plan_sale(db, branch_id, month, year)

    rent_expense = exp.get("Rent Expense", 0)

    pure_room_sale = gross - rev["fnb_revenue"] - staff_food - guest_food
    pure_fnb_sale = rev["fnb_revenue"] + staff_food + guest_food

    fixed = nat["Fixed"]
    variable = nat["Variable"]

    fixed_excl_rent = fixed - rent_expense
    net_profit = net_revenue - total_expenses
    loss_excl_rent = net_profit + rent_expense

    days_op = _days_operational(branch, month, year)
    room_inventory = branch.rooms * days_op if days_op else 0

    occupancy_pct = _safe_div(rev["rooms_occupied"], rev["rooms_available"])
    arr = _safe_div(rev["room_revenue"], rev["rooms_occupied"])
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

        # Revenue
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

        # Expenses
        "expenses": exp,
        "total_expenses": total_expenses,
        "net_profit": net_profit,

        # Fixed / Variable
        "total_fixed_expenses": fixed,
        "total_variable_expenses": variable,
        "fixed_excluding_rent": fixed_excl_rent,
        "loss_excluding_rent": loss_excl_rent,
        "staff_food_costing": staff_food,
        "guest_food_costing": guest_food,
        "plan_sale": plan_sale,

        # Metrics
        "days_operational": days_op,
        "rooms_available": branch.rooms,
        "occupancy_pct": occupancy_pct,
        "arr": arr,
        "room_inventory": room_inventory,
        "pax_fnb": rev["pax_fnb"],
        "rooms_occupied": rev["rooms_occupied"],
        "fnb_per_room": fnb_per_room,
        "running_cost_per_room": running_cost,
        "fb_inventory": fb_inventory,

        # Variance / BEP
        "variance_fnb": variance_fnb,
        "variance_room": variance_room,
        "room_nights_shortage": shortage,
        "target_room_nights": target_room_nights,
        "target_room_nights_pct": target_room_pct,
        "fnb_contribution": fnb_contribution,
        "fb_revenue_pct": fb_revenue_pct,

        # Expense Ratios
        "fixed_pct": fixed_pct,
        "variable_pct": variable_pct,
        "employee_cost_pct": employee_cost_pct,
        "fnb_cost_pct": fnb_cost_pct,
        "hotel_opex_pct": hotel_opex_pct,
        "rent_pct": rent_pct,

        # Expense / Revenue Ratios
        "employee_to_revenue": employee_to_revenue,
        "hotel_opex_to_revenue": hotel_opex_to_revenue,
        "rent_to_revenue": rent_to_revenue,
        "fnb_cost_to_fnb_revenue": fnb_cost_to_fnb_revenue,
    }


def _aggregate_totals(branch_pnls):
    """Sum all numeric fields across branches."""
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

    # Ratios from totals
    totals["occupancy_pct"] = _safe_div(totals["rooms_occupied"], totals["rooms_available"])
    totals["arr"] = _safe_div(totals["room_revenue"], totals["rooms_occupied"])
    totals["fnb_per_room"] = _safe_div(totals["fnb_revenue"], totals["rooms_occupied"])
    totals["fb_inventory"] = _safe_div(totals["pure_fnb_sale"], totals["pure_room_sale"] + totals["pure_fnb_sale"])
    totals["target_room_nights_pct"] = _safe_div(totals["target_room_nights"], totals["room_inventory"])
    totals["fb_revenue_pct"] = _safe_div(totals["guest_food_costing"], totals["pure_fnb_sale"])

    totals["fixed_pct"] = _safe_div(totals["total_fixed_expenses"], totals["total_expenses"])
    totals["variable_pct"] = _safe_div(totals["total_variable_expenses"], totals["total_expenses"])

    # Aggregate expenses by head
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


@router.get("/monthly")
def monthly(
    month: int = Query(...),
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    out = [_pnl(db, b, month, year) for b in branches]
    totals = _aggregate_totals(out)
    return {"branches": out, "totals": totals}


@router.get("/ytd")
def ytd(year: int = Query(...), db: Session = Depends(get_db)):
    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    out = [_pnl(db, b, None, year) for b in branches]
    totals = _aggregate_totals(out)
    return {"branches": out, "totals": totals}


@router.get("/comparison")
def comparison(
    month_a: int = Query(...),
    year_a: int = Query(...),
    month_b: int = Query(...),
    year_b: int = Query(...),
    db: Session = Depends(get_db),
):
    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    a_list = [_pnl(db, b, month_a, year_a) for b in branches]
    b_list = [_pnl(db, b, month_b, year_b) for b in branches]
    a_totals = _aggregate_totals(a_list)
    b_totals = _aggregate_totals(b_list)
    return {
        "period_a": {"branches": a_list, "totals": a_totals},
        "period_b": {"branches": b_list, "totals": b_totals},
    }
