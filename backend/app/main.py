from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import date
from .database import Base, engine, SessionLocal, get_db
from . import models
from .auth import hash_pw, verify_pw, create_token
from .routers import (
    branches, expense_heads, expense_ledgers,
    expense_entries, revenue_entries, reports, seed,
    food_cost, plan_sale, room_history,
    export_excel, export_pdf
)
from .schemas import LoginIn, Token

app = FastAPI(title="El Hotel MIS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed admin user
        if not db.query(models.User).filter_by(email="subhoa4@gmail.com").first():
            db.add(models.User(
                email="subhoa4@gmail.com",
                name="Subho",
                password_hash=hash_pw("admin123"),
                role="admin",
            ))
            db.commit()

        # Seed branches
        if db.query(models.Branch).count() == 0:
            for name, rooms, rent in [
                ("7 N Seas", 29, 1050000),
                ("La Bella", 35, 1200000),
                ("Varanasi", 17, 666000),
                ("New Mandela", 44, 1375000),
                ("Head Office", 0, 35000),
            ]:
                db.add(models.Branch(name=name, rooms=rooms, rent=rent))
            db.commit()

        # Backfill start_date for branches without it
        for b in db.query(models.Branch).all():
            if b.start_date is None and not b.is_head_office:
                b.start_date = date(2026, 4, 1)
        db.commit()

        # Seed expense heads
        if db.query(models.ExpenseHead).count() == 0:
            for h in [
                "Employee Expenses", "Finance Expense",
                "Food and Beverage Expense",
                "Hotel / Restaurant Operating Expenses",
                "Rent Expense", "Marketing & Sales Expenses",
                "Miscellaneous Expenses", "Repair & Maintance Expenses",
                "Traveling & Conveyance Expneses",
            ]:
                db.add(models.ExpenseHead(name=h))
            db.commit()
    finally:
        db.close()


@app.post("/api/auth/login", response_model=Token)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=data.email).first()
    if not user or not verify_pw(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return Token(access_token=create_token(user.id), user=user)


app.include_router(branches.router)
app.include_router(expense_heads.router)
app.include_router(expense_ledgers.router)
app.include_router(expense_entries.router)
app.include_router(revenue_entries.router)
app.include_router(reports.router)
app.include_router(seed.router)
app.include_router(food_cost.router)
app.include_router(plan_sale.router)
app.include_router(room_history.router)
app.include_router(export_excel.router)
app.include_router(export_pdf.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "El Hotel MIS"}
