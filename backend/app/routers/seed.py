from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models

router = APIRouter(prefix="/api/seed", tags=["seed"])

# The full list of ledgers grouped by Expense Head.
# (name, expense_head_name, nature)
LEDGERS = [
    # Employee Expenses
    ("Salary",                          "Employee Expenses", "Fixed"),
    ("Staff Salary",                    "Employee Expenses", "Fixed"),
    ("Basic Salary",                    "Employee Expenses", "Fixed"),
    ("HRA",                             "Employee Expenses", "Fixed"),
    ("PF Employer Contribution",        "Employee Expenses", "Fixed"),
    ("Stipend",                         "Employee Expenses", "Fixed"),
    ("Director Remuneration",           "Employee Expenses", "Fixed"),
    ("Bonus",                           "Employee Expenses", "Variable"),
    ("Staff Accommodation Charges",     "Employee Expenses", "Variable"),
    ("Staff Accommodation - Electricity","Employee Expenses", "Variable"),
    ("Staff Refreshment Exp",           "Employee Expenses", "Variable"),
    ("Staff Welfare",                   "Employee Expenses", "Variable"),
    ("Staff Welfare Exp",               "Employee Expenses", "Variable"),
    ("Staff Transportation Exp",        "Employee Expenses", "Variable"),
    ("Staff Food",                      "Employee Expenses", "Variable"),
    ("Fooding Exp",                     "Employee Expenses", "Variable"),
    ("Medical Expenses",                "Employee Expenses", "Variable"),
    ("Emp LWF",                         "Employee Expenses", "Variable"),
    ("Fuel Charges",                    "Employee Expenses", "Variable"),
    ("Reimbursement Expenses",          "Employee Expenses", "Variable"),

    # Finance Expense
    ("Bank Charges",                    "Finance Expense", "Fixed"),
    ("Software Exp",                    "Finance Expense", "Fixed"),
    ("Finance Expenses",                "Finance Expense", "Variable"),
    ("Late Filing Interest",            "Finance Expense", "Variable"),
    ("Late Fees",                       "Finance Expense", "Variable"),
    ("Rates & Taxes",                   "Finance Expense", "Variable"),
    ("TRADE LICENSE Fees",              "Finance Expense", "Variable"),

    # Food and Beverage Expense
    ("Grocery Purchase",                "Food and Beverage Expense", "Variable"),
    ("Bakery Items Purchase",           "Food and Beverage Expense", "Variable"),
    ("Kitchen Consumables",             "Food and Beverage Expense", "Variable"),
    ("Kitchen Item Purchase",           "Food and Beverage Expense", "Variable"),
    ("Milk & Dairy Products",           "Food and Beverage Expense", "Variable"),
    ("Mineral Water & Beverages",       "Food and Beverage Expense", "Variable"),
    ("Non Veg Item Purchase",           "Food and Beverage Expense", "Variable"),
    ("Non Veg Item Purchase for Guest", "Food and Beverage Expense", "Variable"),
    ("Raw Material Purchase - Non Veg", "Food and Beverage Expense", "Variable"),
    ("Raw Material Purchase -Veg",      "Food and Beverage Expense", "Variable"),
    ("Raw Material Purchase - Vegetables","Food and Beverage Expense","Variable"),
    ("Vegetable Purchase",              "Food and Beverage Expense", "Variable"),
    ("Veg Item Purchase",               "Food and Beverage Expense", "Variable"),
    ("Packing & Consumables",           "Food and Beverage Expense", "Variable"),
    ("Tea Exp",                         "Food and Beverage Expense", "Variable"),
    ("F & B Consumables Item Purchase", "Food and Beverage Expense", "Variable"),
    ("Food & Beverage Expenses",        "Food and Beverage Expense", "Variable"),
    ("Beverage Expenses",               "Food and Beverage Expense", "Variable"),

    # Hotel / Restaurant Operating Expenses
    ("Electricity Expenses",            "Hotel / Restaurant Operating Expenses", "Fixed"),
    ("Cable Expenses",                  "Hotel / Restaurant Operating Expenses", "Fixed"),
    ("Security Expenses",               "Hotel / Restaurant Operating Expenses", "Fixed"),
    ("Pest Control Expense",            "Hotel / Restaurant Operating Expenses", "Fixed"),
    ("Waste Disposal Charges",          "Hotel / Restaurant Operating Expenses", "Fixed"),
    ("Cleaning Charges",                "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Courier Charges",                 "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Electrical Item Expenses",        "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Fuel, Heat & Power Expenses",     "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Freight Charges",                 "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Kitchen Gas Exp",                 "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Cooking Gas",                     "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Laundry Expenses",                "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Laundry Expense",                 "Hotel / Restaurant Operating Expenses", "Variable"),
    ("News Paper Expenses",             "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Printing & Stationery Exp",       "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Printing & Stationery",           "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Postage",                         "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Postage & Courier Exp",           "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Puja Expenses",                   "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Wifi Charges",                    "Hotel / Restaurant Operating Expenses", "Variable"),
    ("License & Service Fee",           "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Kitchen Appliances",              "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Housekeeping Supplies",           "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Housekeeping Accessories",        "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Website Subscription",            "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Telephone Expenses",              "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Display & Decoration Exp",        "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Administrative Expenses",         "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Security Charges",                "Hotel / Restaurant Operating Expenses", "Variable"),
    ("Security Exp",                    "Hotel / Restaurant Operating Expenses", "Variable"),
    ("KEDARNATH GENERAL STORE",         "Hotel / Restaurant Operating Expenses", "Variable"),

    # Rent Expense
    ("Rental Expenses",                 "Rent Expense", "Fixed"),
    ("Rental Expneses",                 "Rent Expense", "Fixed"),
    ("Lease Rent",                      "Rent Expense", "Fixed"),
    ("Office Rent",                     "Rent Expense", "Fixed"),
    ("Annual Rental Expneses",          "Rent Expense", "Fixed"),
    ("EDC Annual Rental Expneses",      "Rent Expense", "Fixed"),
    ("EDC Annual Rental Expenses",      "Rent Expense", "Fixed"),

    # Marketing & Sales Expenses
    ("Commission & Brokages Expenses",  "Marketing & Sales Expenses", "Variable"),
    ("Commission Exp",                  "Marketing & Sales Expenses", "Variable"),
    ("Marketing Expenses",              "Marketing & Sales Expenses", "Variable"),
    ("Travel Agent Commission Exp",     "Marketing & Sales Expenses", "Variable"),
    ("Promotional Expenses",            "Marketing & Sales Expenses", "Variable"),

    # Miscellaneous Expenses
    ("Miscellaneous Expenses",          "Miscellaneous Expenses", "Variable"),
    ("Misc Allowance",                  "Miscellaneous Expenses", "Variable"),
    ("General Exp",                     "Miscellaneous Expenses", "Variable"),
    ("General Expenses",                "Miscellaneous Expenses", "Variable"),
    ("DONATION",                        "Miscellaneous Expenses", "Variable"),
    ("Discount Allowed",                "Miscellaneous Expenses", "Variable"),
    ("Round Off",                       "Miscellaneous Expenses", "Variable"),
    ("Petty Cash Expenses",             "Miscellaneous Expenses", "Variable"),
    ("Professional Fees",               "Miscellaneous Expenses", "Variable"),
    ("Reimbursement Exp",               "Miscellaneous Expenses", "Variable"),
    ("Software Expenses",               "Miscellaneous Expenses", "Fixed"),
    ("Suspense",                        "Miscellaneous Expenses", "Variable"),

    # Repair & Maintance Expenses
    ("R&M Exp - Electric Item",         "Repair & Maintance Expenses", "Variable"),
    ("R&M Exp - Equipment",             "Repair & Maintance Expenses", "Variable"),
    ("R&M Exp - Furniture",             "Repair & Maintance Expenses", "Variable"),
    ("R&M Exp - Computer",              "Repair & Maintance Expenses", "Variable"),
    ("R&M Exp - Others",                "Repair & Maintance Expenses", "Variable"),
    ("AMC Charges Fire",                "Repair & Maintance Expenses", "Variable"),
    ("Service Charges",                 "Repair & Maintance Expenses", "Variable"),
    ("Room Division Expenses",          "Repair & Maintance Expenses", "Variable"),

    # Traveling & Conveyance Expneses
    ("Traveling & Conveyance Exp",      "Traveling & Conveyance Expneses", "Variable"),
    ("Travelling & Conveyance Exp",     "Traveling & Conveyance Expneses", "Variable"),
    ("Travelling & Convyance Expenses", "Traveling & Conveyance Expneses", "Variable"),
    ("Traveling Expenses",              "Traveling & Conveyance Expneses", "Variable"),
    ("Travelling Expenses",             "Traveling & Conveyance Expneses", "Variable"),
    ("Convyance Charges",               "Traveling & Conveyance Expneses", "Variable"),
    ("Food & Breverage Exp",            "Traveling & Conveyance Expneses", "Variable"),
]


@router.post("/ledgers")
def seed_ledgers(db: Session = Depends(get_db)):
    inserted = 0
    skipped = 0
    missing_heads = set()

    # Map head name -> id
    heads = {h.name: h.id for h in db.query(models.ExpenseHead).all()}

    # Existing ledger names (to avoid duplicates)
    existing = {l.name for l in db.query(models.ExpenseLedger).all()}

    for name, head_name, nature in LEDGERS:
        if name in existing:
            skipped += 1
            continue
        head_id = heads.get(head_name)
        if not head_id:
            missing_heads.add(head_name)
            continue
        db.add(models.ExpenseLedger(
            name=name,
            expense_head_id=head_id,
            nature=nature,
        ))
        inserted += 1

    db.commit()
    return {
        "inserted": inserted,
        "skipped": skipped,
        "missing_heads": sorted(missing_heads),
        "message": f"Seeded {inserted} new ledgers, skipped {skipped} existing.",
    }


@router.post("/reset-ledgers")
def reset_ledgers(db: Session = Depends(get_db)):
    """DANGER: deletes ALL ledgers and re-seeds. Use only if you need a clean slate."""
    db.query(models.ExpenseLedger).delete()
    db.commit()
    return seed_ledgers(db)
