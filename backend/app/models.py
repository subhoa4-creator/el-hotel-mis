from sqlalchemy import (
    Column, Integer, String, Numeric, Date, DateTime,
    ForeignKey, UniqueConstraint, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Branch(Base):
    __tablename__ = "branches"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    rooms = Column(Integer, default=0)
    rent = Column(Numeric(14, 2), default=0)
    electricity = Column(Numeric(14, 2), default=0)
    dg_cost = Column(Numeric(14, 2), default=0)
    housekeeping = Column(Numeric(14, 2), default=0)
    home_amenities = Column(Numeric(10, 2), default=0)
    is_head_office = Column(Integer, default=0)
    start_date = Column(Date, nullable=True)
    running_cost_per_room = Column(Numeric(14, 2), default=0)


class ExpenseHead(Base):
    __tablename__ = "expense_heads"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)


class ExpenseLedger(Base):
    __tablename__ = "expense_ledgers"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    expense_head_id = Column(Integer, ForeignKey("expense_heads.id"))
    nature = Column(String(20), default="Variable")
    expense_head = relationship("ExpenseHead")


class ExpenseEntry(Base):
    __tablename__ = "expense_entries"
    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    ledger_id = Column(Integer, ForeignKey("expense_ledgers.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    amount = Column(Numeric(14, 2), default=0)
    entered_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    entered_at = Column(DateTime, server_default=func.now())
    __table_args__ = (
        UniqueConstraint("branch_id", "ledger_id", "month", "year"),
    )


class RevenueEntry(Base):
    __tablename__ = "revenue_entries"
    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    room_revenue = Column(Numeric(14, 2), default=0)
    fnb_revenue = Column(Numeric(14, 2), default=0)
    other_income = Column(Numeric(14, 2), default=0)
    discount = Column(Numeric(14, 2), default=0)
    gst = Column(Numeric(14, 2), default=0)
    rooms_available = Column(Integer, default=0)
    rooms_occupied = Column(Integer, default=0)
    pax_fnb = Column(Integer, default=0)
    entered_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    entered_at = Column(DateTime, server_default=func.now())
    __table_args__ = (
        UniqueConstraint("branch_id", "month", "year"),
    )


class FoodCost(Base):
    __tablename__ = "food_costs"
    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    staff_cost = Column(Numeric(14, 2), default=0)
    guest_cost = Column(Numeric(14, 2), default=0)
    entered_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    entered_at = Column(DateTime, server_default=func.now())
    __table_args__ = (
        UniqueConstraint("branch_id", "month", "year"),
    )


class PlanSale(Base):
    __tablename__ = "plan_sales"
    id = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    amount = Column(Numeric(14, 2), default=0)
    entered_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    entered_at = Column(DateTime, server_default=func.now())
    __table_args__ = (
        UniqueConstraint("branch_id", "month", "year"),
    )


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(120), unique=True, nullable=False)
    name = Column(String(120))
    password_hash = Column(String(200), nullable=False)
    role = Column(String(30), default="viewer")
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(50))
    table_name = Column(String(60))
    record_id = Column(Integer)
    old_value = Column(Text)
    new_value = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
