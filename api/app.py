from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import Error as MySQLError
from database import get_connection
from schemas import (
    UserCreate, UserLogin, UserUpdate, PasswordUpdate,
    CategoryCreate, CategoryUpdate,
    ExpenseCreate, ExpenseUpdate,
    IncomeCreate, IncomeUpdate,
    BudgetCreate, BudgetUpdate,
    UserSettingsUpdate,
    TokenResponse, RefreshRequest,
)
from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    get_current_user
)
from datetime import date, datetime
from typing import Optional
import csv
import io
import json

app = FastAPI(title="Expense Tracker API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _dict_cursor(conn):
    return conn.cursor(dictionary=True)


def _fetch_one(cursor, query, params=None):
    cursor.execute(query, params or ())
    return cursor.fetchone()


def _fetch_all(cursor, query, params=None):
    cursor.execute(query, params or ())
    return cursor.fetchall()


def _get_user_id(user: dict) -> int:
    return user["id"]


def _category_exists(cursor, category_id):
    row = _fetch_one(cursor, "SELECT id FROM categories WHERE id=%s", (category_id,))
    return row is not None


def _category_belongs_to_user(cursor, category_id, user_id):
    row = _fetch_one(
        cursor,
        "SELECT id FROM categories WHERE id=%s AND (user_id=%s OR is_system=TRUE)",
        (category_id, user_id)
    )
    return row is not None


def _check_notifications(user_id):
    try:
        conn = get_connection()
        cursor = _dict_cursor(conn)
        now = date.today()
        start = date(now.year, now.month, 1)

        expense_row = _fetch_one(
            cursor,
            "SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE user_id=%s AND expense_date>=%s AND expense_date<=%s",
            (user_id, start, now)
        )
        income_row = _fetch_one(
            cursor,
            "SELECT COALESCE(SUM(amount),0) AS total FROM income WHERE user_id=%s AND income_date>=%s AND income_date<=%s",
            (user_id, start, now)
        )
        budget_row = _fetch_one(
            cursor,
            "SELECT budget_amount FROM budgets WHERE user_id=%s AND month=%s AND year=%s",
            (user_id, now.month, now.year)
        )

        if budget_row and float(budget_row["budget_amount"]) > 0:
            spent = float(expense_row["total"])
            budget = float(budget_row["budget_amount"])
            pct = (spent / budget) * 100

            warn_pct = 80
            setting = _fetch_one(
                cursor,
                "SELECT budget_warning_percent FROM user_settings WHERE user_id=%s",
                (user_id,)
            )
            if setting:
                warn_pct = setting["budget_warning_percent"]

            if pct >= 100:
                exists = _fetch_one(
                    cursor,
                    "SELECT id FROM notifications WHERE user_id=%s AND title='Budget Exceeded' AND DATE(created_at)=CURDATE()",
                    (user_id,)
                )
                if not exists:
                    cursor.execute(
                        "INSERT INTO notifications (user_id, title, message, type) VALUES (%s,%s,%s,%s)",
                        (user_id, "Budget Exceeded",
                         f"You have exceeded your monthly budget of ${budget:.2f}. Current spending: ${spent:.2f}.",
                         "danger")
                    )
                    conn.commit()
            elif pct >= warn_pct and pct < 100:
                exists = _fetch_one(
                    cursor,
                    "SELECT id FROM notifications WHERE user_id=%s AND title LIKE 'Budget Warning%' AND DATE(created_at)=CURDATE()",
                    (user_id,)
                )
                if not exists:
                    cursor.execute(
                        "INSERT INTO notifications (user_id, title, message, type) VALUES (%s,%s,%s,%s)",
                        (user_id, f"Budget Warning {int(pct)}%",
                         f"You have used {int(pct)}% of your monthly budget (${spent:.2f} of ${budget:.2f}).",
                         "warning")
                    )
                    conn.commit()
        cursor.close()
        conn.close()
    except Exception:
        pass


# ==========================================
# Auth
# ==========================================

@app.post("/auth/register", status_code=201)
def register(user: UserCreate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor, "SELECT id FROM users WHERE email=%s", (user.email,)
        )
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")

        hashed = hash_password(user.password)
        cursor.execute(
            "INSERT INTO users (name, age, email, password) VALUES (%s,%s,%s,%s)",
            (user.name, user.age, user.email, hashed)
        )
        user_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO user_settings (user_id) VALUES (%s)", (user_id,)
        )
        conn.commit()

        access = create_access_token({"sub": str(user_id), "email": user.email})
        refresh = create_refresh_token({"sub": str(user_id), "email": user.email})

        return TokenResponse(
            access_token=access,
            refresh_token=refresh,
            user={"id": user_id, "name": user.name, "email": user.email}
        )
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.post("/auth/login")
def login(creds: UserLogin):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor,
            "SELECT id, name, email, password FROM users WHERE email=%s",
            (creds.email,)
        )
        if not row or not verify_password(creds.password, row["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        access = create_access_token({"sub": str(row["id"]), "email": row["email"]})
        refresh = create_refresh_token({"sub": str(row["id"]), "email": row["email"]})

        return TokenResponse(
            access_token=access,
            refresh_token=refresh,
            user={"id": row["id"], "name": row["name"], "email": row["email"]}
        )
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.post("/auth/refresh")
def refresh_token(body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    email = payload.get("email")

    access = create_access_token({"sub": str(user_id), "email": email})
    refresh = create_refresh_token({"sub": str(user_id), "email": email})

    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


@app.get("/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor,
            "SELECT id, name, age, email, created_at FROM users WHERE id=%s",
            (user["id"],)
        )
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return row
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Users
# ==========================================

@app.put("/users/profile")
def update_profile(updates: UserUpdate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        existing = _fetch_one(cursor, "SELECT id FROM users WHERE id=%s", (uid,))
        if not existing:
            raise HTTPException(status_code=404, detail="User not found")

        fields, values = [], []
        if updates.name is not None:
            fields.append("name=%s"); values.append(updates.name)
        if updates.age is not None:
            fields.append("age=%s"); values.append(updates.age)
        if updates.email is not None:
            dup = _fetch_one(cursor, "SELECT id FROM users WHERE email=%s AND id!=%s", (updates.email, uid))
            if dup:
                raise HTTPException(status_code=400, detail="Email already in use")
            fields.append("email=%s"); values.append(updates.email)

        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(uid)
        cursor.execute(f"UPDATE users SET {', '.join(fields)} WHERE id=%s", values)
        conn.commit()

        updated = _fetch_one(
            cursor, "SELECT id, name, age, email, created_at FROM users WHERE id=%s", (uid,)
        )
        return {"message": "Profile updated", "user": updated}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.put("/users/password")
def change_password(pw: PasswordUpdate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        row = _fetch_one(cursor, "SELECT password FROM users WHERE id=%s", (uid,))
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        if not verify_password(pw.current_password, row["password"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        hashed = hash_password(pw.new_password)
        cursor.execute("UPDATE users SET password=%s WHERE id=%s", (hashed, uid))
        conn.commit()
        return {"message": "Password updated successfully"}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/users")
def list_users():
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        rows = _fetch_all(cursor, "SELECT id, name, age, email, created_at FROM users")
        return {"count": len(rows), "users": rows}
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Categories
# ==========================================

@app.get("/categories/system")
def get_system_categories():
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        rows = _fetch_all(cursor, "SELECT id, category_name, icon FROM system_categories")
        return {"categories": rows}
    finally:
        cursor.close()
        conn.close()


@app.post("/categories", status_code=201)
def create_category(cat: CategoryCreate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        dup = _fetch_one(
            cursor,
            "SELECT id FROM categories WHERE user_id=%s AND category_name=%s",
            (uid, cat.category_name)
        )
        if dup:
            raise HTTPException(status_code=400, detail="Category name already exists")

        cursor.execute(
            "INSERT INTO categories (user_id, category_name) VALUES (%s,%s)",
            (uid, cat.category_name)
        )
        conn.commit()
        return {"message": "Category created", "category_id": cursor.lastrowid}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/categories")
def list_user_categories(user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        rows = _fetch_all(
            cursor,
            "SELECT id, user_id, category_name, is_system FROM categories WHERE user_id=%s OR is_system=TRUE",
            (uid,)
        )
        return {"count": len(rows), "categories": rows}
    finally:
        cursor.close()
        conn.close()


@app.put("/categories/{category_id}")
def update_category(category_id: int, cat: CategoryUpdate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        existing = _fetch_one(
            cursor,
            "SELECT id, user_id, is_system FROM categories WHERE id=%s",
            (category_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")
        if existing["is_system"]:
            raise HTTPException(status_code=400, detail="Cannot modify system categories")
        if existing["user_id"] != uid:
            raise HTTPException(status_code=403, detail="Access denied")

        dup = _fetch_one(
            cursor,
            "SELECT id FROM categories WHERE user_id=%s AND category_name=%s AND id!=%s",
            (uid, cat.category_name, category_id)
        )
        if dup:
            raise HTTPException(status_code=400, detail="Category name already exists")

        cursor.execute("UPDATE categories SET category_name=%s WHERE id=%s", (cat.category_name, category_id))
        conn.commit()
        return {"message": "Category updated"}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.delete("/categories/{category_id}")
def delete_category(category_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        existing = _fetch_one(
            cursor,
            "SELECT id, user_id, is_system FROM categories WHERE id=%s",
            (category_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")
        if existing["is_system"]:
            raise HTTPException(status_code=400, detail="Cannot delete system categories")
        if existing["user_id"] != uid:
            raise HTTPException(status_code=403, detail="Access denied")

        cursor.execute("DELETE FROM categories WHERE id=%s", (category_id,))
        conn.commit()
        return {"message": "Category deleted"}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Expenses
# ==========================================

@app.post("/expenses", status_code=201)
def create_expense(exp: ExpenseCreate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        if not _category_exists(cursor, exp.category_id):
            raise HTTPException(status_code=404, detail="Category not found")
        if not _category_belongs_to_user(cursor, exp.category_id, uid):
            raise HTTPException(status_code=400, detail="Category does not belong to you")

        cursor.execute(
            """INSERT INTO expenses
               (user_id, category_id, title, amount, expense_date, notes,
                expense_type, payment_method, is_recurring, recurring_frequency,
                merchant_name, attachment_url, tags)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (uid, exp.category_id, exp.title, exp.amount, exp.expense_date,
             exp.notes, exp.expense_type, exp.payment_method, exp.is_recurring,
             exp.recurring_frequency, exp.merchant_name, exp.attachment_url, exp.tags)
        )
        conn.commit()
        expense_id = cursor.lastrowid
        _check_notifications(uid)
        return {"message": "Expense created", "expense_id": expense_id}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/expenses")
def list_expenses(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    sort: Optional[str] = "expense_date",
    order: Optional[str] = "desc",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[int] = None,
    payment_method: Optional[str] = None,
    expense_type: Optional[str] = None,
    amount_min: Optional[float] = None,
    amount_max: Optional[float] = None,
    user: dict = Depends(get_current_user)
):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        conditions = ["e.user_id=%s"]
        params = [uid]

        if search:
            conditions.append("(e.title LIKE %s OR e.merchant_name LIKE %s OR e.notes LIKE %s OR e.tags LIKE %s)")
            params.extend([f"%{search}%"] * 4)
        if start_date:
            conditions.append("e.expense_date>=%s"); params.append(start_date)
        if end_date:
            conditions.append("e.expense_date<=%s"); params.append(end_date)
        if category_id:
            conditions.append("e.category_id=%s"); params.append(category_id)
        if payment_method:
            conditions.append("e.payment_method=%s"); params.append(payment_method)
        if expense_type:
            conditions.append("e.expense_type=%s"); params.append(expense_type)
        if amount_min is not None:
            conditions.append("e.amount>=%s"); params.append(amount_min)
        if amount_max is not None:
            conditions.append("e.amount<=%s"); params.append(amount_max)

        allowed_sort = {"expense_date", "amount", "title", "created_at"}
        sort_col = sort if sort in allowed_sort else "expense_date"
        order_dir = "ASC" if order and order.upper() == "asc" else "DESC"

        where = " AND ".join(conditions)
        count_row = _fetch_one(
            cursor,
            f"SELECT COUNT(*) AS cnt FROM expenses e WHERE {where}", params
        )
        total = count_row["cnt"]
        offset = (page - 1) * limit

        rows = _fetch_all(
            cursor,
            f"""SELECT e.*, c.category_name
                FROM expenses e
                LEFT JOIN categories c ON c.id=e.category_id
                WHERE {where}
                ORDER BY e.{sort_col} {order_dir}
                LIMIT %s OFFSET %s""",
            params + [limit, offset]
        )

        return {
            "count": total,
            "page": page,
            "limit": limit,
            "total_pages": max(1, (total + limit - 1) // limit),
            "expenses": rows
        }
    finally:
        cursor.close()
        conn.close()


@app.get("/expenses/{expense_id}")
def get_expense(expense_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor,
            """SELECT e.*, c.category_name
               FROM expenses e
               LEFT JOIN categories c ON c.id=e.category_id
               WHERE e.id=%s AND e.user_id=%s""",
            (expense_id, user["id"])
        )
        if not row:
            raise HTTPException(status_code=404, detail="Expense not found")
        return row
    except HTTPException:
        raise
    finally:
        cursor.close()
        conn.close()


@app.put("/expenses/{expense_id}")
def update_expense(expense_id: int, exp: ExpenseUpdate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        existing = _fetch_one(
            cursor, "SELECT id FROM expenses WHERE id=%s AND user_id=%s",
            (expense_id, uid)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Expense not found")

        fields, values = [], []
        if exp.category_id is not None:
            if not _category_exists(cursor, exp.category_id):
                raise HTTPException(status_code=404, detail="Category not found")
            if not _category_belongs_to_user(cursor, exp.category_id, uid):
                raise HTTPException(status_code=400, detail="Category does not belong to you")
            fields.append("category_id=%s"); values.append(exp.category_id)
        if exp.title is not None:
            fields.append("title=%s"); values.append(exp.title)
        if exp.amount is not None:
            fields.append("amount=%s"); values.append(exp.amount)
        if exp.expense_date is not None:
            fields.append("expense_date=%s"); values.append(exp.expense_date)
        if exp.notes is not None:
            fields.append("notes=%s"); values.append(exp.notes)
        if exp.expense_type is not None:
            fields.append("expense_type=%s"); values.append(exp.expense_type)
        if exp.payment_method is not None:
            fields.append("payment_method=%s"); values.append(exp.payment_method)
        if exp.is_recurring is not None:
            fields.append("is_recurring=%s"); values.append(exp.is_recurring)
        if exp.recurring_frequency is not None:
            fields.append("recurring_frequency=%s"); values.append(exp.recurring_frequency)
        if exp.merchant_name is not None:
            fields.append("merchant_name=%s"); values.append(exp.merchant_name)
        if exp.attachment_url is not None:
            fields.append("attachment_url=%s"); values.append(exp.attachment_url)
        if exp.tags is not None:
            fields.append("tags=%s"); values.append(exp.tags)

        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(expense_id)
        cursor.execute(f"UPDATE expenses SET {', '.join(fields)} WHERE id=%s", values)
        conn.commit()
        return {"message": "Expense updated"}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        cursor.execute(
            "DELETE FROM expenses WHERE id=%s AND user_id=%s",
            (expense_id, user["id"])
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Expense not found")
        conn.commit()
        return {"message": "Expense deleted"}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Income
# ==========================================

@app.post("/income", status_code=201)
def create_income(inc: IncomeCreate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        cursor.execute(
            """INSERT INTO income
               (user_id, source, amount, income_date, income_type,
                is_recurring, recurring_frequency, notes)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (uid, inc.source, inc.amount, inc.income_date,
             inc.income_type, inc.is_recurring, inc.recurring_frequency, inc.notes)
        )
        conn.commit()
        return {"message": "Income created", "income_id": cursor.lastrowid}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/income")
def list_income(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    income_type: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        conditions = ["user_id=%s"]
        params = [uid]

        if start_date:
            conditions.append("income_date>=%s"); params.append(start_date)
        if end_date:
            conditions.append("income_date<=%s"); params.append(end_date)
        if income_type:
            conditions.append("income_type=%s"); params.append(income_type)

        where = " AND ".join(conditions)
        count_row = _fetch_one(cursor, f"SELECT COUNT(*) AS cnt FROM income WHERE {where}", params)
        total = count_row["cnt"]
        offset = (page - 1) * limit

        rows = _fetch_all(
            cursor,
            f"SELECT * FROM income WHERE {where} ORDER BY income_date DESC LIMIT %s OFFSET %s",
            params + [limit, offset]
        )
        return {"count": total, "page": page, "limit": limit, "total_pages": max(1, (total + limit - 1) // limit), "income": rows}
    finally:
        cursor.close()
        conn.close()


@app.get("/income/{income_id}")
def get_income(income_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor, "SELECT * FROM income WHERE id=%s AND user_id=%s",
            (income_id, user["id"])
        )
        if not row:
            raise HTTPException(status_code=404, detail="Income not found")
        return row
    except HTTPException:
        raise
    finally:
        cursor.close()
        conn.close()


@app.put("/income/{income_id}")
def update_income(income_id: int, inc: IncomeUpdate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor, "SELECT id FROM income WHERE id=%s AND user_id=%s",
            (income_id, user["id"])
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Income not found")

        fields, values = [], []
        if inc.source is not None:
            fields.append("source=%s"); values.append(inc.source)
        if inc.amount is not None:
            fields.append("amount=%s"); values.append(inc.amount)
        if inc.income_date is not None:
            fields.append("income_date=%s"); values.append(inc.income_date)
        if inc.income_type is not None:
            fields.append("income_type=%s"); values.append(inc.income_type)
        if inc.is_recurring is not None:
            fields.append("is_recurring=%s"); values.append(inc.is_recurring)
        if inc.recurring_frequency is not None:
            fields.append("recurring_frequency=%s"); values.append(inc.recurring_frequency)
        if inc.notes is not None:
            fields.append("notes=%s"); values.append(inc.notes)

        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(income_id)
        cursor.execute(f"UPDATE income SET {', '.join(fields)} WHERE id=%s", values)
        conn.commit()
        return {"message": "Income updated"}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.delete("/income/{income_id}")
def delete_income(income_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        cursor.execute(
            "DELETE FROM income WHERE id=%s AND user_id=%s",
            (income_id, user["id"])
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Income not found")
        conn.commit()
        return {"message": "Income deleted"}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Budgets (upsert)
# ==========================================

@app.post("/budgets", status_code=201)
def create_or_update_budget(bud: BudgetCreate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        existing = _fetch_one(
            cursor,
            "SELECT id FROM budgets WHERE user_id=%s AND month=%s AND year=%s",
            (uid, bud.month, bud.year)
        )
        if existing:
            cursor.execute(
                "UPDATE budgets SET budget_amount=%s WHERE id=%s",
                (bud.budget_amount, existing["id"])
            )
            conn.commit()
            return {"message": "Budget updated", "budget_id": existing["id"]}
        else:
            cursor.execute(
                "INSERT INTO budgets (user_id, month, year, budget_amount) VALUES (%s,%s,%s,%s)",
                (uid, bud.month, bud.year, bud.budget_amount)
            )
            conn.commit()
            return {"message": "Budget created", "budget_id": cursor.lastrowid}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/budgets")
def list_budgets(user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        rows = _fetch_all(
            cursor,
            "SELECT * FROM budgets WHERE user_id=%s ORDER BY year DESC, month DESC",
            (user["id"],)
        )
        return {"count": len(rows), "budgets": rows}
    finally:
        cursor.close()
        conn.close()


@app.get("/budgets/{budget_id}")
def get_budget(budget_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor, "SELECT * FROM budgets WHERE id=%s AND user_id=%s",
            (budget_id, user["id"])
        )
        if not row:
            raise HTTPException(status_code=404, detail="Budget not found")
        return row
    except HTTPException:
        raise
    finally:
        cursor.close()
        conn.close()


@app.put("/budgets/{budget_id}")
def update_budget(budget_id: int, bud: BudgetUpdate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        existing = _fetch_one(
            cursor, "SELECT id FROM budgets WHERE id=%s AND user_id=%s",
            (budget_id, uid)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Budget not found")

        fields, values = [], []
        if bud.month is not None:
            fields.append("month=%s"); values.append(bud.month)
        if bud.year is not None:
            fields.append("year=%s"); values.append(bud.year)
        if bud.budget_amount is not None:
            fields.append("budget_amount=%s"); values.append(bud.budget_amount)
        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        values.append(budget_id)
        cursor.execute(f"UPDATE budgets SET {', '.join(fields)} WHERE id=%s", values)
        conn.commit()
        return {"message": "Budget updated"}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.delete("/budgets/{budget_id}")
def delete_budget(budget_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        cursor.execute(
            "DELETE FROM budgets WHERE id=%s AND user_id=%s",
            (budget_id, user["id"])
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Budget not found")
        conn.commit()
        return {"message": "Budget deleted"}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Dashboard
# ==========================================

@app.get("/dashboard")
def get_dashboard(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        now = date.today()

        if not start_date:
            start_date = date(now.year, now.month, 1).isoformat()
        if not end_date:
            end_date = now.isoformat()

        # Previous period
        sd = date.fromisoformat(start_date)
        ed = date.fromisoformat(end_date)
        days_in_period = (ed - sd).days + 1
        prev_sd = sd - __import__('datetime').timedelta(days=days_in_period)
        prev_ed = sd - __import__('datetime').timedelta(days=1)

        def period_totals(start, end):
            exp = _fetch_one(cursor,
                "SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt FROM expenses WHERE user_id=%s AND expense_date>=%s AND expense_date<=%s",
                (uid, start.isoformat(), end.isoformat()))
            inc = _fetch_one(cursor,
                "SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt FROM income WHERE user_id=%s AND income_date>=%s AND income_date<=%s",
                (uid, start.isoformat(), end.isoformat()))
            return float(exp["total"]), int(exp["cnt"]), float(inc["total"]), int(inc["cnt"])

        exp_total, exp_cnt, inc_total, inc_cnt = period_totals(sd, ed)
        prev_exp_total, prev_exp_cnt, prev_inc_total, prev_inc_cnt = period_totals(prev_sd, prev_ed)

        budget_row = _fetch_one(cursor,
            "SELECT budget_amount FROM budgets WHERE user_id=%s AND month=%s AND year=%s",
            (uid, sd.month, sd.year))
        budget = float(budget_row["budget_amount"]) if budget_row else None
        remaining = budget - exp_total if budget else None
        util = (exp_total / budget * 100) if budget and budget > 0 else None

        top_cat = _fetch_one(cursor,
            """SELECT c.category_name, SUM(e.amount) AS total
               FROM expenses e JOIN categories c ON c.id=e.category_id
               WHERE e.user_id=%s AND e.expense_date>=%s AND e.expense_date<=%s
               GROUP BY e.category_id ORDER BY total DESC LIMIT 1""",
            (uid, start_date, end_date))
        top_cat_dict = {"category_name": top_cat["category_name"], "total": float(top_cat["total"])} if top_cat else None

        largest_exp = _fetch_one(cursor,
            """SELECT e.title, e.amount, c.category_name
               FROM expenses e JOIN categories c ON c.id=e.category_id
               WHERE e.user_id=%s AND e.expense_date>=%s AND e.expense_date<=%s
               ORDER BY e.amount DESC LIMIT 1""",
            (uid, start_date, end_date))
        largest_exp_dict = {
            "title": largest_exp["title"], "amount": float(largest_exp["amount"]),
            "category": largest_exp["category_name"]
        } if largest_exp else None

        avg_daily = exp_total / days_in_period if days_in_period > 0 else 0
        net_savings = inc_total - exp_total

        vs_prev = {
            "income_change_pct": round(((inc_total - prev_inc_total) / prev_inc_total * 100), 1) if prev_inc_total else None,
            "expense_change_pct": round(((exp_total - prev_exp_total) / prev_exp_total * 100), 1) if prev_exp_total else None,
            "savings_change_pct": round((((inc_total - exp_total) - (prev_inc_total - prev_exp_total)) / (prev_inc_total - prev_exp_total) * 100), 1) if (prev_inc_total - prev_exp_total) != 0 else None
        }

        _check_notifications(uid)

        return {
            "total_income": inc_total,
            "total_expenses": exp_total,
            "net_savings": net_savings,
            "budget": budget,
            "remaining_budget": remaining,
            "budget_utilization": round(util, 1) if util is not None else None,
            "expense_count": exp_cnt,
            "income_count": inc_cnt,
            "top_category": top_cat_dict,
            "largest_expense": largest_exp_dict,
            "avg_daily_spending": round(avg_daily, 2),
            "vs_previous": vs_prev,
            "period": {"start": start_date, "end": end_date}
        }
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Reports
# ==========================================

@app.get("/reports/monthly")
def monthly_report(year: int, month: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        sd = date(year, month, 1)
        if month == 12:
            ed = date(year + 1, 1, 1)
        else:
            ed = date(year, month + 1, 1)
        from datetime import timedelta
        ed = ed - timedelta(days=1)

        sds, eds = sd.isoformat(), ed.isoformat()

        inc = _fetch_one(cursor,
            "SELECT COALESCE(SUM(amount),0) AS t FROM income WHERE user_id=%s AND income_date>=%s AND income_date<=%s",
            (uid, sds, eds))
        exp = _fetch_one(cursor,
            "SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE user_id=%s AND expense_date>=%s AND expense_date<=%s",
            (uid, sds, eds))
        inc_total, exp_total = float(inc["t"]), float(exp["t"])

        top_cats = _fetch_all(cursor,
            """SELECT c.category_name, SUM(e.amount) AS total
               FROM expenses e JOIN categories c ON c.id=e.category_id
               WHERE e.user_id=%s AND e.expense_date>=%s AND e.expense_date<=%s
               GROUP BY e.category_id ORDER BY total DESC LIMIT 5""",
            (uid, sds, eds))

        largest = _fetch_all(cursor,
            """SELECT e.title, e.amount, c.category_name
               FROM expenses e JOIN categories c ON c.id=e.category_id
               WHERE e.user_id=%s AND e.expense_date>=%s AND e.expense_date<=%s
               ORDER BY e.amount DESC LIMIT 5""",
            (uid, sds, eds))

        bud = _fetch_one(cursor,
            "SELECT budget_amount FROM budgets WHERE user_id=%s AND month=%s AND year=%s",
            (uid, month, year))
        bud_util = round(exp_total / float(bud["budget_amount"]) * 100, 1) if bud and float(bud["budget_amount"]) > 0 else None

        return {
            "month": month,
            "year": year,
            "income": inc_total,
            "expenses": exp_total,
            "savings": inc_total - exp_total,
            "top_categories": top_cats,
            "largest_transactions": largest,
            "budget_utilization": bud_util
        }
    finally:
        cursor.close()
        conn.close()


@app.get("/reports/yearly")
def yearly_report(year: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        sd = date(year, 1, 1)
        ed = date(year, 12, 31)
        sds, eds = sd.isoformat(), ed.isoformat()

        inc = _fetch_one(cursor,
            "SELECT COALESCE(SUM(amount),0) AS t FROM income WHERE user_id=%s AND income_date>=%s AND income_date<=%s",
            (uid, sds, eds))
        exp = _fetch_one(cursor,
            "SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE user_id=%s AND expense_date>=%s AND expense_date<=%s",
            (uid, sds, eds))
        inc_total, exp_total = float(inc["t"]), float(exp["t"])

        monthly = _fetch_all(cursor,
            """SELECT MONTH(expense_date) AS month, COALESCE(SUM(amount),0) AS total
               FROM expenses WHERE user_id=%s AND YEAR(expense_date)=%s
               GROUP BY MONTH(expense_date) ORDER BY month""",
            (uid, year))

        monthly_inc = _fetch_all(cursor,
            """SELECT MONTH(income_date) AS month, COALESCE(SUM(amount),0) AS total
               FROM income WHERE user_id=%s AND YEAR(income_date)=%s
               GROUP BY MONTH(income_date) ORDER BY month""",
            (uid, year))

        top_cats = _fetch_all(cursor,
            """SELECT c.category_name, SUM(e.amount) AS total
               FROM expenses e JOIN categories c ON c.id=e.category_id
               WHERE e.user_id=%s AND e.expense_date>=%s AND e.expense_date<=%s
               GROUP BY e.category_id ORDER BY total DESC LIMIT 10""",
            (uid, sds, eds))

        monthly_breakdown = []
        for m in range(1, 13):
            me = 0
            mi = 0
            for r in monthly:
                if r["month"] == m:
                    me = float(r["total"])
            for r in monthly_inc:
                if r["month"] == m:
                    mi = float(r["total"])
            monthly_breakdown.append({"month": m, "expenses": me, "income": mi, "savings": mi - me})

        return {
            "year": year,
            "total_income": inc_total,
            "total_expenses": exp_total,
            "total_savings": inc_total - exp_total,
            "monthly_breakdown": monthly_breakdown,
            "top_categories": top_cats
        }
    finally:
        cursor.close()
        conn.close()


@app.get("/reports/custom")
def custom_report(
    start_date: str, end_date: str, user: dict = Depends(get_current_user)
):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]

        inc = _fetch_one(cursor,
            "SELECT COALESCE(SUM(amount),0) AS t FROM income WHERE user_id=%s AND income_date>=%s AND income_date<=%s",
            (uid, start_date, end_date))
        exp = _fetch_one(cursor,
            "SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE user_id=%s AND expense_date>=%s AND expense_date<=%s",
            (uid, start_date, end_date))
        inc_total, exp_total = float(inc["t"]), float(exp["t"])

        top_cats = _fetch_all(cursor,
            """SELECT c.category_name, SUM(e.amount) AS total
               FROM expenses e JOIN categories c ON c.id=e.category_id
               WHERE e.user_id=%s AND e.expense_date>=%s AND e.expense_date<=%s
               GROUP BY e.category_id ORDER BY total DESC LIMIT 5""",
            (uid, start_date, end_date))

        largest = _fetch_all(cursor,
            """SELECT e.title, e.amount, c.category_name
               FROM expenses e JOIN categories c ON c.id=e.category_id
               WHERE e.user_id=%s AND e.expense_date>=%s AND e.expense_date<=%s
               ORDER BY e.amount DESC LIMIT 5""",
            (uid, start_date, end_date))

        return {
            "start_date": start_date,
            "end_date": end_date,
            "income": inc_total,
            "expenses": exp_total,
            "savings": inc_total - exp_total,
            "top_categories": top_cats,
            "largest_transactions": largest
        }
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Search
# ==========================================

@app.get("/search")
def global_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_user)
):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        search_term = f"%{q}%"

        expenses = _fetch_all(cursor,
            """SELECT id, title AS name, amount, expense_date AS dt, 'expense' AS type
               FROM expenses WHERE user_id=%s AND (title LIKE %s OR merchant_name LIKE %s OR notes LIKE %s OR tags LIKE %s)
               LIMIT %s""",
            (uid, search_term, search_term, search_term, search_term, limit))

        income = _fetch_all(cursor,
            """SELECT id, source AS name, amount, income_date AS dt, 'income' AS type
               FROM income WHERE user_id=%s AND (source LIKE %s OR notes LIKE %s) LIMIT %s""",
            (uid, search_term, search_term, limit))

        categories = _fetch_all(cursor,
            """SELECT id, category_name AS name, NULL AS amount, NULL AS dt, 'category' AS type
               FROM categories WHERE user_id=%s AND category_name LIKE %s LIMIT %s""",
            (uid, search_term, limit))

        return {"results": expenses + income + categories, "total": len(expenses) + len(income) + len(categories)}
    finally:
        cursor.close()
        conn.close()


# ==========================================
# User Settings
# ==========================================

@app.get("/settings")
def get_settings(user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(cursor,
            "SELECT * FROM user_settings WHERE user_id=%s", (user["id"],))
        if not row:
            cursor.execute("INSERT INTO user_settings (user_id) VALUES (%s)", (user["id"],))
            conn.commit()
            row = _fetch_one(cursor,
                "SELECT * FROM user_settings WHERE user_id=%s", (user["id"],))
        return row
    finally:
        cursor.close()
        conn.close()


@app.put("/settings")
def update_settings(settings: UserSettingsUpdate, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        fields, values = [], []
        if settings.currency is not None:
            fields.append("currency=%s"); values.append(settings.currency)
        if settings.date_format is not None:
            fields.append("date_format=%s"); values.append(settings.date_format)
        if settings.theme is not None:
            fields.append("theme=%s"); values.append(settings.theme)
        if settings.timezone is not None:
            fields.append("timezone=%s"); values.append(settings.timezone)
        if settings.budget_warning_percent is not None:
            fields.append("budget_warning_percent=%s"); values.append(settings.budget_warning_percent)

        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        values.append(uid)
        cursor.execute(f"UPDATE user_settings SET {', '.join(fields)} WHERE user_id=%s", values)
        if cursor.rowcount == 0:
            cursor.execute("INSERT INTO user_settings (user_id) VALUES (%s)", (uid,))
            conn.commit()
            cursor.execute(f"UPDATE user_settings SET {', '.join(fields)} WHERE user_id=%s", values)
        conn.commit()
        return {"message": "Settings updated"}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Notifications
# ==========================================

@app.get("/notifications")
def list_notifications(user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        rows = _fetch_all(cursor,
            "SELECT * FROM notifications WHERE user_id=%s ORDER BY created_at DESC LIMIT 50",
            (user["id"],))
        unread = _fetch_one(cursor,
            "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=%s AND is_read=FALSE",
            (user["id"],))
        return {"count": len(rows), "unread": unread["cnt"], "notifications": rows}
    finally:
        cursor.close()
        conn.close()


@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        cursor.execute(
            "UPDATE notifications SET is_read=TRUE WHERE id=%s AND user_id=%s",
            (notification_id, user["id"])
        )
        conn.commit()
        return {"message": "Notification marked as read"}
    finally:
        cursor.close()
        conn.close()


@app.put("/notifications/read-all")
def mark_all_read(user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        cursor.execute(
            "UPDATE notifications SET is_read=TRUE WHERE user_id=%s",
            (user["id"],)
        )
        conn.commit()
        return {"message": "All notifications marked as read"}
    finally:
        cursor.close()
        conn.close()


@app.delete("/notifications/{notification_id}")
def delete_notification(notification_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        cursor.execute(
            "DELETE FROM notifications WHERE id=%s AND user_id=%s",
            (notification_id, user["id"])
        )
        conn.commit()
        return {"message": "Notification deleted"}
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Export
# ==========================================

@app.get("/export/csv/{data_type}")
def export_csv(
    data_type: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        now = date.today()
        if not start_date:
            start_date = date(now.year, 1, 1).isoformat()
        if not end_date:
            end_date = now.isoformat()

        output = io.StringIO()
        writer = csv.writer(output)

        if data_type == "expenses":
            writer.writerow(["ID", "Title", "Amount", "Date", "Category", "Type", "Payment", "Merchant", "Notes", "Tags"])
            rows = _fetch_all(cursor,
                """SELECT e.id, e.title, e.amount, e.expense_date, c.category_name,
                          e.expense_type, e.payment_method, e.merchant_name, e.notes, e.tags
                   FROM expenses e LEFT JOIN categories c ON c.id=e.category_id
                   WHERE e.user_id=%s AND e.expense_date>=%s AND e.expense_date<=%s
                   ORDER BY e.expense_date""",
                (uid, start_date, end_date))
            for r in rows:
                writer.writerow([r["id"], r["title"], r["amount"], r["expense_date"],
                               r["category_name"], r["expense_type"], r["payment_method"],
                               r["merchant_name"], r["notes"], r["tags"]])
        elif data_type == "income":
            writer.writerow(["ID", "Source", "Amount", "Date", "Type", "Notes"])
            rows = _fetch_all(cursor,
                """SELECT id, source, amount, income_date, income_type, notes
                   FROM income WHERE user_id=%s AND income_date>=%s AND income_date<=%s
                   ORDER BY income_date""",
                (uid, start_date, end_date))
            for r in rows:
                writer.writerow([r["id"], r["source"], r["amount"], r["income_date"], r["income_type"], r["notes"]])
        else:
            raise HTTPException(status_code=400, detail="Invalid data type. Use 'expenses' or 'income'.")

        return __import__('fastapi').responses.Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={data_type}_{start_date}_{end_date}.csv"}
        )
    except HTTPException:
        raise
    finally:
        cursor.close()
        conn.close()


@app.get("/export/backup")
def export_backup(user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        uid = user["id"]
        expenses = _fetch_all(cursor,
            "SELECT * FROM expenses WHERE user_id=%s", (uid,))
        income = _fetch_all(cursor,
            "SELECT * FROM income WHERE user_id=%s", (uid,))
        budgets = _fetch_all(cursor,
            "SELECT * FROM budgets WHERE user_id=%s", (uid,))
        categories = _fetch_all(cursor,
            "SELECT * FROM categories WHERE user_id=%s OR is_system=TRUE", (uid,))

        for r in expenses:
            if "created_at" in r:
                r["created_at"] = str(r["created_at"])
        for r in income:
            if "created_at" in r:
                r["created_at"] = str(r["created_at"])
        for r in expenses:
            if "expense_date" in r:
                r["expense_date"] = str(r["expense_date"])
        for r in income:
            if "income_date" in r:
                r["income_date"] = str(r["income_date"])

        return {
            "exported_at": datetime.utcnow().isoformat(),
            "user_id": uid,
            "expenses": expenses,
            "income": income,
            "budgets": budgets,
            "categories": categories
        }
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Health
# ==========================================

@app.get("/")
def health_check():
    return {"message": "Expense Tracker API v2.0.0"}
