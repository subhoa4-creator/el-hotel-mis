from io import BytesIO
from datetime import date
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
)
from ..database import get_db
from .. import models
from .reports import (
    _pnl, _aggregate_totals, fy_label, _safe_div,
)

router = APIRouter(prefix="/api/export/pdf", tags=["export-pdf"])


# ============================================================
# Shared rows
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
        *[(h, ('expenses', h), 'money') for h in EXPENSE_HEADS],
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


def _fmt(v, fmt):
    if fmt == 'pct':
        try:
            return f"{float(v or 0) * 100:.2f}%"
        except (ValueError, TypeError):
            return '—'
    if fmt == 'int':
        try:
            return f"{int(float(v or 0)):,}"
        except (ValueError, TypeError):
            return '0'
    try:
        return f"{float(v or 0):,.0f}"
    except (ValueError, TypeError):
        return '0'


def _build_table(title, columns_data):
    """columns_data: list of {'label':..., 'data': {...}}"""
    rows_def = _rows()

    # Header
    header = ['Particulars'] + [c['label'] for c in columns_data]
    table_data = [header]

    # Body
    for r in rows_def:
        if r[0] == 'section':
            row = [r[1]] + [''] * len(columns_data)
            table_data.append(row)
            continue
        label = r[0]
        key = r[1]
        fmt = r[2] if len(r) > 2 else 'money'
        values = [_fmt(_get(col['data'], key), fmt) for col in columns_data]
        table_data.append([label] + values)

    # Style
    n_cols = len(header)
    table = Table(table_data, repeatRows=1, hAlign='LEFT')

    style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#CBD5E1')),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]

    # Style section and total rows
    row_idx = 1  # first data row after header
    for r in rows_def:
        if r[0] == 'section':
            style.append(('BACKGROUND', (0, row_idx), (-1, row_idx), colors.HexColor('#334155')))
            style.append(('TEXTCOLOR', (0, row_idx), (-1, row_idx), colors.white))
            style.append(('FONTNAME', (0, row_idx), (-1, row_idx), 'Helvetica-Bold'))
            row_idx += 1
            continue
        is_bold = (len(r) > 3 and r[3] == 'bold')
        if is_bold:
            style.append(('FONTNAME', (0, row_idx), (-1, row_idx), 'Helvetica-Bold'))
            style.append(('BACKGROUND', (0, row_idx), (-1, row_idx), colors.HexColor('#F1F5F9')))
        row_idx += 1

    table.setStyle(TableStyle(style))
    return table


def _build_pdf(title, columns_data, filename):
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=0.4 * inch,
        rightMargin=0.4 * inch,
        topMargin=0.4 * inch,
        bottomMargin=0.4 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleCustom',
        parent=styles['Title'],
        fontSize=14,
        spaceAfter=10,
    )

    story = [
        Paragraph(title, title_style),
        Spacer(1, 0.1 * inch),
        _build_table(title, columns_data),
    ]

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# Endpoints
# ============================================================

@router.get("/monthly")
def pdf_monthly(
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

    filename = f"ElHotelMIS_Monthly_{year}-{month:02d}.pdf"
    return _build_pdf(title, columns, filename)


@router.get("/ytd")
def pdf_ytd(
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
    filename = f"ElHotelMIS_YTD_{label}.pdf"
    return _build_pdf(title, columns, filename)


@router.get("/comparison")
def pdf_comparison(
    month_a: int = Query(...),
    year_a: int = Query(...),
    month_b: int = Query(...),
    year_b: int = Query(...),
    db: Session = Depends(get_db),
):
    branches = db.query(models.Branch).order_by(models.Branch.id).all()
    a_list = [_pnl(db, b, month=month_a, year=year_a) for b in branches]
    b_list = [_pnl(db, b, month=month_b, year=year_b) for b in branches]

    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    columns = []
    for b in a_list:
        columns.append({'label': f"A · {b['branch']}", 'data': b})
    columns.append({'label': 'A · TOTAL', 'data': _aggregate_totals(a_list)})
    for b in b_list:
        columns.append({'label': f"B · {b['branch']}", 'data': b})
    columns.append({'label': 'B · TOTAL', 'data': _aggregate_totals(b_list)})

    title = (
        f"El Hotel MIS — Comparison — "
        f"{month_names[month_a]} {year_a} vs {month_names[month_b]} {year_b}"
    )
    filename = f"ElHotelMIS_Comparison_{year_a}-{month_a:02d}_vs_{year_b}-{month_b:02d}.pdf"
    return _build_pdf(title, columns, filename)


@router.get("/all-fy")
def pdf_all_fy(db: Session = Depends(get_db)):
    today = date.today()
    current_fy = today.year if today.month >= 4 else today.year - 1

    min_exp = db.query(models.ExpenseEntry.year).order_by(models.ExpenseEntry.year).first()
    min_rev = db.query(models.RevenueEntry.year).order_by(models.RevenueEntry.year).first()
    years = [y[0] for y in [min_exp, min_rev] if y]
    min_year = min(years) if years else current_fy

    branches = db.query(models.Branch).order_by(models.Branch.id).all()

    # Per FY
    per_cols = []
    for fy in range(min_year, current_fy + 1):
        pnls = [_pnl(db, b, fy_year=fy) for b in branches]
        per_cols.append({'label': f'FY {fy_label(fy)}', 'data': _aggregate_totals(pnls)})

    # Cumulative
    running = {}
    cum_cols = []
    for fy in range(min_year, current_fy + 1):
        pnls = [_pnl(db, b, fy_year=fy) for b in branches]
        fy_totals = _aggregate_totals(pnls)
        for k, v in fy_totals.items():
            if isinstance(v, (int, float)):
                running[k] = running.get(k, 0) + float(v)
        cum_cols.append({'label': f'FY {fy_label(fy)}', 'data': dict(running)})

    title = "El Hotel MIS — All Financial Years"
    filename = "ElHotelMIS_AllFY.pdf"
    return _build_pdf(title, per_cols + cum_cols, filename)
