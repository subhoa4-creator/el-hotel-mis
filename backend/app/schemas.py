from pydantic import BaseModel, EmailStr
from typing import Optional

class BranchIn(BaseModel):
    name: str
    rooms: int = 0
    rent: float = 0
    electricity: float = 0
    dg_cost: float = 0
    housekeeping: float = 0
    home_amenities: float = 0
    is_head_office: int = 0

class BranchOut(BranchIn):
    id: int
    class Config: from_attributes = True

class ExpenseHeadIn(BaseModel):
    name: str

class ExpenseHeadOut(ExpenseHeadIn):
    id: int
    class Config: from_attributes = True

class ExpenseLedgerIn(BaseModel):
    name: str
    expense_head_id: int
    nature: str = "Variable"

class ExpenseLedgerOut(ExpenseLedgerIn):
    id: int
    class Config: from_attributes = True

class ExpenseEntryIn(BaseModel):
    branch_id: int
    ledger_id: int
    month: int
    year: int
    amount: float

class RevenueEntryIn(BaseModel):
    branch_id: int
    month: int
    year: int
    room_revenue: float = 0
    fnb_revenue: float = 0
    other_income: float = 0
    discount: float = 0
    gst: float = 0
    rooms_available: int = 0
    rooms_occupied: int = 0
    pax_fnb: int = 0

class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: str
    branch_id: Optional[int]
    class Config: from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class LoginIn(BaseModel):
    email: EmailStr
    password: str
