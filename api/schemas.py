from pydantic import BaseModel, EmailStr, Field
from datetime import date
from typing import Optional


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    age: Optional[int] = Field(None, gt=0, lt=120)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    age: Optional[int]
    email: str
    created_at: Optional[str]


class CategoryCreate(BaseModel):
    user_id: int
    category_name: str = Field(..., min_length=1, max_length=50)


class CategoryResponse(BaseModel):
    id: int
    user_id: int
    category_name: str


class ExpenseCreate(BaseModel):
    user_id: int
    category_id: int
    title: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    expense_date: date
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    category_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    amount: Optional[float] = Field(None, gt=0)
    expense_date: Optional[date] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: int
    user_id: int
    category_id: int
    category_name: Optional[str]
    title: str
    amount: float
    expense_date: str
    notes: Optional[str]
    created_at: Optional[str]


class IncomeCreate(BaseModel):
    user_id: int
    source: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    income_date: date


class IncomeResponse(BaseModel):
    id: int
    user_id: int
    source: str
    amount: float
    income_date: str
    created_at: Optional[str]


class BudgetCreate(BaseModel):
    user_id: int
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    budget_amount: float = Field(..., gt=0)


class BudgetResponse(BaseModel):
    id: int
    user_id: int
    month: int
    year: int
    budget_amount: float


class DashboardResponse(BaseModel):
    total_expenses: float
    total_income: float
    budget: Optional[float]
    remaining_budget: Optional[float]
    expense_count: int
    income_count: int
