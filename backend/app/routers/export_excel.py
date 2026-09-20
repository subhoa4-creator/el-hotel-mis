from io import BytesIO
from datetime import date
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from ..database import get_db
from .. import models
from .reports import (
    _pnl, _aggregate_totals, fy_label, _safe_div,
)

router = APIRouter(prefix="/api/export/excel", tags=["export-excel"])


# ============================================================
# Styling helpers
# ============================================================

HEADER_FILL = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=11)
SECTION_FILL = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
SECTION_FONT = Font(color="FFFFFF", bold=True, size=11)
TOTAL_FILL = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
BOLD = Font(bold=True)
CENTER = Alignment(horizontal="center", vertical="center")
RIGHT = Alignment(horizontal="right")
THIN = Side(border_style="thin", color="E2E8F0")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def _num(v, is_money=True):
    if v is None or v == "":
        return None
    try:
        n = float(v)
        if is_money:
            return round(n, 2)
        return n
    except (ValueError, TypeError):
        return None


def _pct(v):
    if v is None:
        return None
    try:
        return round(float(v), 4)
    except (ValueError, TypeError):
        return None


# ============================================================
# Row definitions
# ============================================================

EXPENSE_HEADS = [
    "Employee Expenses",
    "Finance Expense",
    "Food and Beverage Expense",
    "Hotel / Restaurant Operating Expenses",
    "Marketing & Sales Expenses",
    "Miscellaneous Expenses",
    "Rent Expense",
    "Repair & Maintance Expenses",
    "Traveling & Conveyance Expneses",
]


def _rows():
    """Return list of (label, key_path, fmt) tuples.
    fmt: 'money' | 'pct' | 'int'
    key_path: str or callable(data)
    """
    return [
        ('section', '1) REVENUE'),
        ('Room Revenue', 'room_revenue', 'money'),
        ('Restaurant / F&B Revenue', 'fnb_revenue', 'money'),
        ('Other Income', 'other_income', 'money'),
        ('Gross Revenue', 'gross_revenue', 'money', 'bold'),
        ('Less: Discount Allowed', 'discount', 'money'),
        ('Net Revenue', 'net_revenue', 'money', 'bold'),
        ('GST Collected from Customers', 'gst', 'money'),
        ('Total Billing Value', 'total_billing', 'money', 'bold'),
        ('Pure Room Sale', 'pure_room_sale', 'money'),
        ('Pure F&B Sale', 'pure_fnb_sale', 'money'),

        ('section', '2) EXPENSES'),
        *[(f'  {h}', ('expenses', h), 'money') for h in EXPENSE_HEADS],
        ('Total Expenses', 'total_expenses', 'money', 'bold'),
        ('Net Profit/(Loss)', 'net_profit', 'money', 'bold'),

        ('section', '3) FIXED / VARIABLE'),
        ('Total Fixed Expenses Excluding Rent', 'fixed_excluding_rent', 'money'),
        ('Rent Expense', ('expenses', 'Rent Expense'), 'money'),
        ('Total Fixed Expenses', 'total_fixed_expenses', 'money', 'bold'),
        ('Total Variable Expenses', 'total_variable_expenses', 'money', 'bold'),
        ('Loss/Profit Excluding Rent', 'loss_excluding_rent', 'money', 'bold'),
        ('Total Staff Food Costing', 'staff_food_costing', 'money'),
        ('Total Guest Food Costing', 'guest_food_costing', 'money'),
        ('Plan Sale', 'plan_sale', 'money'),

        ('section', '4) REVENUE METRICS'),
        ('No of Days Operational', 'days_operational', 'int'),
        ('No Of Room Available', 'rooms_available', 'int'),
        ('Room Occupancy %', 'occupancy_pct', 'pct'),
        ('Avg Room Rent', 'arr', 'money'),
        ('Room Inventory', 'room_inventory', 'int'),
        ('No of Pax - FnB', 'pax_fnb', 'int'),
        ('Room Occupied', 'rooms_occupied', 'int'),
        ('F&B Per Room', 'fnb_per_room', 'money'),
        ('Running Cost of Per Room', 'running_cost_per_room', 'money'),
        ('F&B Inventory', 'fb_inventory', 'pct'),

        ('section', '5) VARIANCE / BEP'),
        ('Variance (F&B Sale - Variable Expenses)', 'variance_fnb', 'money'),
        ('Variance (Room Sale - Fixed Expenses)', 'variance_room', 'money'),
        ('Shortage/(Excess) In Room Nights For BEP', 'room_nights_shortage', 'int'),
        ('Target Room Night to Achieve Break Even', 'target_room_nights', 'int'),
        ('Target Room Night Percentage', 'target_room_nights_pct', 'pct'),
        ('Contribution in F&B Sale against Increase Room Night', 'fnb_contribution', 'money'),
        ('FB Revenue Percentage', 'fb_revenue_pct', 'pct'),

        ('section', '6) EXPENSE RATIOS'),
        ('Fixed Expense to Total Expense', 'fixed_pct', 'pct'),
        ('Variable Expense To Total Expense', 'variable_pct', 'pct'),
        ('Employee Cost To Total Expense', 'employee_cost_pct', 'pct'),
        ('F&B Cost % of Total Expenses', 'fnb_cost_pct', 'pct'),
        ('Hotel / Restaurant Operating Expenses % of Total Expense', 'hotel_opex_pct', 'pct'),
        ('Rent Expense To Total Expense %', 'rent_pct', 'pct'),

        ('section', '7) EXPENSE / REVENUE RATIOS'),
        ('Employee Expenses as a % of Total Revenue', 'employee_to_revenue', 'pct'),
        ('Hotel / Restaurant Operating Expenses as a % of Total Revenue', 'hotel_opex_to_revenue', 'pct'),
        ('Rent Expense as a % of Total Revenue', 'rent_to_revenue', 'pct'),
        ('Food and Beverage Expense as a % of FnB Revenue', 'fnb_cost_to_fnb_revenue', 'pct'),
    ]


def _get(data, key):
    if isinstance(key, tuple):
        cur = data
        for k in key:
            cur = (cur or {}).get(k)
            if cur is None:
                return 0
        return cur
    return (data or {}).get(key, 0)


def _write_sheet(ws, title, columns_data):
    """columns_data: list of dicts, each has 'label' and 'data' (dict)."""
    rows_def = _rows()

    # Title row
    ws['A1'] = title
    ws['A1'].font = Font(bold=True, size=14)
    ws.merge_cells(start_row=1, start_column=1,
                   end_row=1, end_column=len(columns_data) + 1)

    # Header
    ws['A2'] = 'Particulars'
    ws['A2'].fill = HEADER_FILL
    ws['A2'].font = HEADER_FONT
    ws['A2'].border = BORDER

    for i, col in enumerate(columns_data, start=2):
        c = ws.cell(row=2, column=i, value=col['label'])
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = CENTER
        c.border = BORDER

    # Body
    row_idx = 3
    for r in rows_def:
        if r[0] == 'section':
            c = ws.cell(row=row_idx, column=1, value=r[1])
            c.fill = SECTION_FILL
            c.font = SECTION_FONT
            c.border = BORDER
            for i in range(2, len(columns_data) + 2):
                ws.cell(row=row_idx, column=i).fill = SECTION_FILL
                ws.cell(row=row_idx, column=i).border = BORDER
            row_idx += 1
            continue

        # Normal row
        label = r[0]
        key = r[1]
        fmt = r[2] if len(r) > 2 else 'money'
        style = r[3] if len(r) > 3 else None

        label_cell = ws.cell(row=row_idx, column=1, value=label)
        label_cell.border = BORDER
        if style == 'bold':
            label_cell.font = BOLD

        for i, col in enumerate(columns_data, start=2):
            v = _get(col['data'], key)
            if fmt == 'pct':
                val = _pct(v)
            elif fmt == 'int':
                val = int(float(v)) if v else 0
            else:
                val = _num(v, is_money=True)

            cell = ws.cell(row=row_idx, column=i, value=val)
            cell.border = BORDER
            if fmt == 'pct':
                cell.number_format = '0.00%'
                cell.alignment = RIGHT
            elif fmt == 'int':
                cell.number_format = '#,##0'
                cell.alignment = RIGHT
            else:
                cell.number_format = '#,##0.00'
                cell.alignment = RIGHT
            if style == 'bold':
                cell.font = BOLD

        row_idx += 1

    # Column widths
    ws.column_dimensions['A'].width = 52
    for i in range(2, len(columns_data) + 2):
        col_letter = ws.cell(row=2, column=i).column_letter
        ws.column_dimensions[col_letter].width = 16

    ws.freeze_panes = 'B3'


def _wb_to_response(wb, filename):
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# Endpoints
# ============================================================

@router.get("/monthly")
def excel_monthly(
    month: int = Query(...),
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    out = [_pnl(db, b, month=month, year=year) for b in branches]
    totals = _aggregate_totals(out)

    columns = [{'label': b['branch'], 'data': b} for b in out]
    columns.append({'label': 'TOTAL', 'data': totals})

    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    title = f"El Hotel MIS — Monthly Report — {month_names[month]} {year}"

    wb = Workbook()
    ws = wb.active
    ws.title = "Monthly Report"
    _write_sheet(ws, title, columns)

    filename = f"ElHotelMIS_Monthly_{year}-{month:02d}.xlsx"
    return _wb_to_response(wb, filename)


@router.get("/ytd")
def excel_ytd(
    year: int = Query(...),
    db: Session = Depends(get_db),
):
    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    out = [_pnl(db, b, fy_year=year) for b in branches]
    totals = _aggregate_totals(out)

    columns = [{'label': b['branch'], 'data': b} for b in out]
    columns.append({'label': 'TOTAL', 'data': totals})

    label = fy_label(year)
    title = f"El Hotel MIS — YTD Summary — FY {label}"

    wb = Workbook()
    ws = wb.active
    ws.title = f"YTD {label}"
    _write_sheet(ws, title, columns)

    filename = f"ElHotelMIS_YTD_{label}.xlsx"
    return _wb_to_response(wb, filename)


@router.get("/comparison")
def excel_comparison(
    month_a: int = Query(...),
    year_a: int = Query(...),
    month_b: int = Query(...),
    year_b: int = Query(...),
    db: Session = Depends(get_db),
):
    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    a_list = [_pnl(db, b, month=month_a, year=year_a) for b in branches]
    b_list = [_pnl(db, b, month=month_b, year=year_b) for b in branches]

    wb = Workbook()
    ws = wb.active
    ws.title = "Comparison"

    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    # A section
    title_a = f"Period A — {month_names[month_a]} {year_a}"
    columns_a = [{'label': b['branch'], 'data': b} for b in a_list]
    columns_a.append({'label': 'TOTAL', 'data': _aggregate_totals(a_list)})
    _write_sheet(ws, f"Comparison — {title_a} vs {month_names[month_b]} {year_b}", columns_a)

    # B section on a new sheet
    ws2 = wb.create_sheet(title=f"Period B")
    title_b = f"Period B — {month_names[month_b]} {year_b}"
    columns_b = [{'label': b['branch'], 'data': b} for b in b_list]
    columns_b.append({'label': 'TOTAL', 'data': _aggregate_totals(b_list)})
    _write_sheet(ws2, title_b, columns_b)

    filename = f"ElHotelMIS_Comparison_{year_a}-{month_a:02d}_vs_{year_b}-{month_b:02d}.xlsx"
    return _wb_to_response(wb, filename)


@router.get("/all-fy")
def excel_all_fy(db: Session = Depends(get_db)):
    today = date.today()
    current_fy = today.year if today.month >= 4 else today.year - 1

    min_exp = db.query(models.ExpenseEntry.year).order_by(models.ExpenseEntry.year).first()
    min_rev = db.query(models.RevenueEntry.year).order_by(models.RevenueEntry.year).first()
    years = [y[0] for y in [min_exp, min_rev] if y]
    min_year = min(years) if years else current_fy

    branches = db.query(models.Branch).order_by(models.Branch.id).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Per FY"

    # Per FY
    fy_cols = []
    for fy in range(min_year, current_fy + 1):
        pnls = [_pnl(db, b, fy_year=fy) for b in branches]
        fy_cols.append({'label': f'FY {fy_label(fy)}', 'data': _aggregate_totals(pnls)})
    _write_sheet(ws, "El Hotel MIS — Per FY", fy_cols)

    # Cumulative
    ws2 = wb.create_sheet(title="Cumulative")
    running = {}
    cum_cols = []
    for fy in range(min_year, current_fy + 1):
        pnls = [_pnl(db, b, fy_year=fy) for b in branches]
        fy_totals = _aggregate_totals(pnls)
        for k, v in fy_totals.items():
            if isinstance(v, (int, float)):
                running[k] = running.get(k, 0) + float(v)
        cum_cols.append({'label': f'FY {fy_label(fy)}', 'data': dict(running)})
    _write_sheet(ws2, "El Hotel MIS — Cumulative", cum_cols)

    # Grand Total
    ws3 = wb.create_sheet(title="Grand Total")
    gt_branches = []
    for b in branches:
        fy_pnls = [_pnl(db, b, fy_year=fy) for fy in range(min_year, current_fy + 1)]
        # Sum all FYs
        keys = [
            "room_revenue", "fnb_revenue", "other_income", "gross_revenue",
            "discount", "net_revenue", "gst", "total_billing",
            "pure_room_sale", "pure_fnb_sale", "total_expenses", "net_profit",
            "total_fixed_expenses", "total_variable_expenses",
            "fixed_excluding_rent", "loss_excluding_rent",
            "staff_food_costing", "guest_food_costing", "plan_sale",
            "days_operational", "rooms_available", "room_inventory",
            "pax_fnb", "rooms_occupied", "variance_fnb", "variance_room",
            "room_nights_shortage", "target_room_nights", "fnb_contribution",
        ]
        agg = {k: 0 for k in keys}
        heads = {}
        for p in fy_pnls:
            for k in keys:
                agg[k] += float(p.get(k, 0) or 0)
            for h, v in (p.get("expenses") or {}).items():
                heads[h] = heads.get(h, 0) + float(v or 0)
        agg['expenses'] = heads
        agg['occupancy_pct'] = _safe_div(agg['rooms_occupied'], agg['rooms_available'])
        agg['arr'] = _safe_div(agg['pure_room_sale'], agg['rooms_occupied'])
        agg['fnb_per_room'] = _safe_div(agg['fnb_revenue'], agg['rooms_occupied'])
        agg['fb_inventory'] = _safe_div(agg['pure_fnb_sale'], agg['pure_room_sale'] + agg['pure_fnb_sale'])
        agg['fixed_pct'] = _safe_div(agg['total_fixed_expenses'], agg['total_expenses'])
        agg['variable_pct'] = _safe_div(agg['total_variable_expenses'], agg['total_expenses'])
        emp = heads.get("Employee Expenses", 0)
        fnb_cost = heads.get("Food and Beverage Expense", 0)
        hot = heads.get("Hotel / Restaurant Operating Expenses", 0)
        rent = heads.get("Rent Expense", 0)
        agg['employee_cost_pct'] = _safe_div(emp, agg['total_expenses'])
        agg['fnb_cost_pct'] = _safe_div(fnb_cost, agg['total_expenses'])
        agg['hotel_opex_pct'] = _safe_div(hot, agg['total_expenses'])
        agg['rent_pct'] = _safe_div(rent, agg['total_expenses'])
        agg['employee_to_revenue'] = _safe_div(emp, agg['gross_revenue'])
        agg['hotel_opex_to_revenue'] = _safe_div(hot, agg['gross_revenue'])
        agg['rent_to_revenue'] = _safe_div(rent, agg['gross_revenue'])
        agg['fnb_cost_to_fnb_revenue'] = _safe_div(fnb_cost, agg['fnb_revenue'])
        agg['running_cost_per_room'] = 0
        agg['branch'] = b.name
        agg['branch_id'] = b.id
        agg['is_head_office'] = b.is_head_office
        gt_branches.append(agg)

    gt_cols = [{'label': b['branch'], 'data': b} for b in gt_branches]
    gt_cols.append({'label': 'GRAND TOTAL', 'data': _aggregate_totals(gt_branches)})
    _write_sheet(ws3, "El Hotel MIS — Grand Total (All Time)", gt_cols)

    filename = "ElHotelMIS_AllFY.xlsx"
    return _wb_to_response(wb, filename)
