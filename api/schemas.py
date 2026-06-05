from pydantic import BaseModel, EmailStr, Field
from datetime import date, datetime
from typing import Optional, List


# ==========================================
# Auth
# ==========================================

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


# ==========================================
# Users
# ==========================================

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    age: Optional[int] = Field(None, gt=0, lt=120)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    age: Optional[int] = Field(None, gt=0, lt=120)
    email: Optional[EmailStr] = None


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


# ==========================================
# Categories
# ==========================================

class CategoryCreate(BaseModel):
    category_name: str = Field(..., min_length=1, max_length=50)


class CategoryUpdate(BaseModel):
    category_name: str = Field(..., min_length=1, max_length=50)


# ==========================================
# Expenses
# ==========================================

class ExpenseCreate(BaseModel):
    category_id: int
    title: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    expense_date: date
    notes: Optional[str] = None
    expense_type: str = Field(default="expense", pattern="^(expense|transfer)$")
    payment_method: str = Field(default="cash", pattern="^(cash|card|upi|bank|wallet)$")
    is_recurring: bool = False
    recurring_frequency: Optional[str] = Field(None, pattern="^(daily|weekly|monthly|yearly)$")
    merchant_name: Optional[str] = Field(None, max_length=100)
    attachment_url: Optional[str] = None
    tags: Optional[str] = Field(None, max_length=255)


class ExpenseUpdate(BaseModel):
    category_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    amount: Optional[float] = Field(None, gt=0)
    expense_date: Optional[date] = None
    notes: Optional[str] = None
    expense_type: Optional[str] = Field(None, pattern="^(expense|transfer)$")
    payment_method: Optional[str] = Field(None, pattern="^(cash|card|upi|bank|wallet)$")
    is_recurring: Optional[bool] = None
    recurring_frequency: Optional[str] = Field(None, pattern="^(daily|weekly|monthly|yearly)$")
    merchant_name: Optional[str] = Field(None, max_length=100)
    attachment_url: Optional[str] = None
    tags: Optional[str] = Field(None, max_length=255)


# ==========================================
# Income
# ==========================================

class IncomeCreate(BaseModel):
    source: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    income_date: date
    income_type: str = Field(default="other", pattern="^(salary|freelance|bonus|investment|gift|other)$")
    is_recurring: bool = False
    recurring_frequency: Optional[str] = Field(None, pattern="^(daily|weekly|monthly|yearly)$")
    notes: Optional[str] = None


class IncomeUpdate(BaseModel):
    source: Optional[str] = Field(None, min_length=1, max_length=100)
    amount: Optional[float] = Field(None, gt=0)
    income_date: Optional[date] = None
    income_type: Optional[str] = Field(None, pattern="^(salary|freelance|bonus|investment|gift|other)$")
    is_recurring: Optional[bool] = None
    recurring_frequency: Optional[str] = Field(None, pattern="^(daily|weekly|monthly|yearly)$")
    notes: Optional[str] = None


# ==========================================
# Budgets
# ==========================================

class BudgetCreate(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    budget_amount: float = Field(..., gt=0)


class BudgetUpdate(BaseModel):
    month: Optional[int] = Field(None, ge=1, le=12)
    year: Optional[int] = Field(None, ge=2000, le=2100)
    budget_amount: Optional[float] = Field(None, gt=0)


# ==========================================
# User Settings
# ==========================================

class UserSettingsUpdate(BaseModel):
    currency: Optional[str] = Field(None, max_length=10)
    date_format: Optional[str] = Field(None, max_length=20)
    theme: Optional[str] = Field(None, max_length=20)
    timezone: Optional[str] = Field(None, max_length=50)
    budget_warning_percent: Optional[int] = Field(None, ge=1, le=100)


# ==========================================
# Dashboard / Reports
# ==========================================

class PeriodRequest(BaseModel):
    start_date: str
    end_date: str


class DashboardResponse(BaseModel):
    total_income: float
    total_expenses: float
    net_savings: float
    budget: Optional[float]
    remaining_budget: Optional[float]
    budget_utilization: Optional[float]
    expense_count: int
    income_count: int
    top_category: Optional[dict]
    largest_expense: Optional[dict]
    avg_daily_spending: float
    vs_previous: Optional[dict]


class MonthlyReport(BaseModel):
    month: int
    year: int
    income: float
    expenses: float
    savings: float
    top_categories: List[dict]
    largest_transactions: List[dict]
    budget_utilization: Optional[float]


class YearlyReport(BaseModel):
    year: int
    total_income: float
    total_expenses: float
    total_savings: float
    monthly_breakdown: List[dict]
    top_categories: List[dict]


# ==========================================
# Notifications
# ==========================================

class NotificationCreate(BaseModel):
    title: str = Field(..., max_length=200)
    message: Optional[str] = None
    type: str = Field(default="info", pattern="^(warning|info|success|danger)$")


# ==========================================
# Pagination
# ==========================================

class PaginatedResponse(BaseModel):
    count: int
    page: int
    limit: int
    total_pages: int
    data: list
