from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import Error as MySQLError
from database import get_connection
from schemas import (
    UserCreate, UserLogin, UserUpdate, PasswordUpdate,
    CategoryCreate, CategoryUpdate,
    ExpenseCreate, ExpenseUpdate,
    IncomeCreate, IncomeUpdate,
    BudgetCreate, BudgetUpdate,
    DashboardResponse
)
from auth import hash_password, verify_password
from datetime import date

app = FastAPI(title="Expense Tracker API", version="1.0.0")

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


def _user_exists(cursor, user_id):
    row = _fetch_one(cursor, "SELECT id FROM users WHERE id=%s", (user_id,))
    return row is not None


def _category_exists(cursor, category_id):
    row = _fetch_one(cursor, "SELECT id FROM categories WHERE id=%s", (category_id,))
    return row is not None


def _category_belongs_to_user(cursor, category_id, user_id):
    row = _fetch_one(
        cursor,
        "SELECT id FROM categories WHERE id=%s AND user_id=%s",
        (category_id, user_id)
    )
    return row is not None


# ==========================================
# Health
# ==========================================

@app.get("/")
def health_check():
    return {"message": "Expense Tracker API Running"}


# ==========================================
# Users
# ==========================================

@app.post("/users", status_code=201)
def create_user(user: UserCreate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor,
            "SELECT id FROM users WHERE email=%s",
            (user.email,)
        )
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")

        hashed = hash_password(user.password)
        cursor.execute(
            "INSERT INTO users (name, age, email, password) VALUES (%s, %s, %s, %s)",
            (user.name, user.age, user.email, hashed)
        )
        conn.commit()
        return {"message": "User created", "user_id": cursor.lastrowid}
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
        rows = _fetch_all(
            cursor,
            "SELECT id, name, age, email, created_at FROM users"
        )
        return {"count": len(rows), "users": rows}
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/users/{user_id}")
def get_user(user_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor,
            "SELECT id, name, age, email, created_at FROM users WHERE id=%s",
            (user_id,)
        )
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return row
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.put("/users/{user_id}")
def update_user(user_id: int, updates: UserUpdate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor,
            "SELECT id FROM users WHERE id=%s",
            (user_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="User not found")

        fields = []
        values = []

        if updates.name is not None:
            fields.append("name=%s")
            values.append(updates.name)

        if updates.age is not None:
            fields.append("age=%s")
            values.append(updates.age)

        if updates.email is not None:
            dup = _fetch_one(
                cursor,
                "SELECT id FROM users WHERE email=%s AND id!=%s",
                (updates.email, user_id)
            )
            if dup:
                raise HTTPException(status_code=400, detail="Email already in use")
            fields.append("email=%s")
            values.append(updates.email)

        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(user_id)
        query = f"UPDATE users SET {', '.join(fields)} WHERE id=%s"
        cursor.execute(query, values)
        conn.commit()

        updated = _fetch_one(
            cursor,
            "SELECT id, name, age, email, created_at FROM users WHERE id=%s",
            (user_id,)
        )
        return {"message": "User updated", "user": updated}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.put("/users/{user_id}/password")
def change_password(user_id: int, pw: PasswordUpdate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor,
            "SELECT password FROM users WHERE id=%s",
            (user_id,)
        )
        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        if not verify_password(pw.current_password, row["password"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        hashed = hash_password(pw.new_password)
        cursor.execute(
            "UPDATE users SET password=%s WHERE id=%s",
            (hashed, user_id)
        )
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


# ==========================================
# Authentication
# ==========================================

@app.post("/login")
def login(creds: UserLogin):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor,
            "SELECT id, name, email, password FROM users WHERE email=%s",
            (creds.email,)
        )
        if not row:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not verify_password(creds.password, row["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        return {
            "message": "Login successful",
            "user": {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"]
            }
        }
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


# ==========================================
# Categories
# ==========================================

@app.post("/categories", status_code=201)
def create_category(cat: CategoryCreate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        if not _user_exists(cursor, cat.user_id):
            raise HTTPException(status_code=404, detail="User not found")

        dup = _fetch_one(
            cursor,
            "SELECT id FROM categories WHERE user_id=%s AND category_name=%s",
            (cat.user_id, cat.category_name)
        )
        if dup:
            raise HTTPException(status_code=400, detail="Category name already exists for this user")

        cursor.execute(
            "INSERT INTO categories (user_id, category_name) VALUES (%s, %s)",
            (cat.user_id, cat.category_name)
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
def list_categories():
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        rows = _fetch_all(cursor, "SELECT id, user_id, category_name FROM categories")
        return {"count": len(rows), "categories": rows}
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/users/{user_id}/categories")
def list_user_categories(user_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        if not _user_exists(cursor, user_id):
            raise HTTPException(status_code=404, detail="User not found")

        rows = _fetch_all(
            cursor,
            "SELECT id, user_id, category_name FROM categories WHERE user_id=%s",
            (user_id,)
        )
        return {"user_id": user_id, "count": len(rows), "categories": rows}
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.put("/categories/{category_id}")
def update_category(category_id: int, cat: CategoryUpdate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor,
            "SELECT id, user_id FROM categories WHERE id=%s",
            (category_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")

        dup = _fetch_one(
            cursor,
            "SELECT id FROM categories WHERE user_id=%s AND category_name=%s AND id!=%s",
            (existing["user_id"], cat.category_name, category_id)
        )
        if dup:
            raise HTTPException(status_code=400, detail="Category name already exists for this user")

        cursor.execute(
            "UPDATE categories SET category_name=%s WHERE id=%s",
            (cat.category_name, category_id)
        )
        conn.commit()
        return {"message": "Category updated", "category_id": category_id}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.delete("/categories/{category_id}")
def delete_category(category_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor,
            "SELECT id FROM categories WHERE id=%s",
            (category_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")

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
def create_expense(exp: ExpenseCreate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        if not _user_exists(cursor, exp.user_id):
            raise HTTPException(status_code=404, detail="User not found")

        if not _category_exists(cursor, exp.category_id):
            raise HTTPException(status_code=404, detail="Category not found")

        if not _category_belongs_to_user(cursor, exp.category_id, exp.user_id):
            raise HTTPException(
                status_code=400,
                detail="Category does not belong to this user"
            )

        cursor.execute(
            """INSERT INTO expenses
               (user_id, category_id, title, amount, expense_date, notes)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (exp.user_id, exp.category_id, exp.title,
             exp.amount, exp.expense_date, exp.notes)
        )
        conn.commit()
        return {"message": "Expense created", "expense_id": cursor.lastrowid}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/expenses")
def list_expenses():
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        rows = _fetch_all(
            cursor,
            """SELECT e.id, e.user_id, e.category_id, c.category_name,
                      e.title, e.amount, e.expense_date, e.notes, e.created_at
               FROM expenses e
               LEFT JOIN categories c ON c.id = e.category_id
               ORDER BY e.created_at DESC"""
        )
        return {"count": len(rows), "expenses": rows}
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/expenses/{expense_id}")
def get_expense(expense_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor,
            """SELECT e.id, e.user_id, e.category_id, c.category_name,
                      e.title, e.amount, e.expense_date, e.notes, e.created_at
               FROM expenses e
               LEFT JOIN categories c ON c.id = e.category_id
               WHERE e.id=%s""",
            (expense_id,)
        )
        if not row:
            raise HTTPException(status_code=404, detail="Expense not found")
        return row
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/users/{user_id}/expenses")
def list_user_expenses(user_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        if not _user_exists(cursor, user_id):
            raise HTTPException(status_code=404, detail="User not found")

        rows = _fetch_all(
            cursor,
            """SELECT e.id, e.category_id, c.category_name,
                      e.title, e.amount, e.expense_date, e.notes, e.created_at
               FROM expenses e
               LEFT JOIN categories c ON c.id = e.category_id
               WHERE e.user_id=%s
               ORDER BY e.created_at DESC""",
            (user_id,)
        )
        return {"user_id": user_id, "count": len(rows), "expenses": rows}
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.put("/expenses/{expense_id}")
def update_expense(expense_id: int, exp: ExpenseUpdate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor,
            "SELECT id, user_id, category_id FROM expenses WHERE id=%s",
            (expense_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Expense not found")

        fields = []
        values = []

        if exp.category_id is not None:
            if not _category_exists(cursor, exp.category_id):
                raise HTTPException(status_code=404, detail="Category not found")
            if not _category_belongs_to_user(cursor, exp.category_id, existing["user_id"]):
                raise HTTPException(
                    status_code=400,
                    detail="Category does not belong to this user"
                )
            fields.append("category_id=%s")
            values.append(exp.category_id)

        if exp.title is not None:
            fields.append("title=%s")
            values.append(exp.title)
        if exp.amount is not None:
            fields.append("amount=%s")
            values.append(exp.amount)
        if exp.expense_date is not None:
            fields.append("expense_date=%s")
            values.append(exp.expense_date)
        if exp.notes is not None:
            fields.append("notes=%s")
            values.append(exp.notes)

        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(expense_id)
        query = f"UPDATE expenses SET {', '.join(fields)} WHERE id=%s"
        cursor.execute(query, values)
        conn.commit()

        return {"message": "Expense updated", "expense_id": expense_id}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor,
            "SELECT id FROM expenses WHERE id=%s",
            (expense_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Expense not found")

        cursor.execute("DELETE FROM expenses WHERE id=%s", (expense_id,))
        conn.commit()
        return {"message": "Expense deleted", "expense_id": expense_id}
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
def create_income(inc: IncomeCreate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        if not _user_exists(cursor, inc.user_id):
            raise HTTPException(status_code=404, detail="User not found")

        cursor.execute(
            "INSERT INTO income (user_id, source, amount, income_date) VALUES (%s, %s, %s, %s)",
            (inc.user_id, inc.source, inc.amount, inc.income_date)
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
def list_income():
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        rows = _fetch_all(
            cursor,
            "SELECT id, user_id, source, amount, income_date, created_at FROM income ORDER BY created_at DESC"
        )
        return {"count": len(rows), "income": rows}
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/income/{income_id}")
def get_income(income_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor,
            "SELECT id, user_id, source, amount, income_date, created_at FROM income WHERE id=%s",
            (income_id,)
        )
        if not row:
            raise HTTPException(status_code=404, detail="Income not found")
        return row
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/users/{user_id}/income")
def list_user_income(user_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        if not _user_exists(cursor, user_id):
            raise HTTPException(status_code=404, detail="User not found")

        rows = _fetch_all(
            cursor,
            """SELECT id, source, amount, income_date, created_at
               FROM income WHERE user_id=%s
               ORDER BY created_at DESC""",
            (user_id,)
        )
        return {"user_id": user_id, "count": len(rows), "income": rows}
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.put("/income/{income_id}")
def update_income(income_id: int, inc: IncomeUpdate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor,
            "SELECT id FROM income WHERE id=%s",
            (income_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Income not found")

        fields = []
        values = []

        if inc.source is not None:
            fields.append("source=%s")
            values.append(inc.source)
        if inc.amount is not None:
            fields.append("amount=%s")
            values.append(inc.amount)
        if inc.income_date is not None:
            fields.append("income_date=%s")
            values.append(inc.income_date)

        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(income_id)
        query = f"UPDATE income SET {', '.join(fields)} WHERE id=%s"
        cursor.execute(query, values)
        conn.commit()
        return {"message": "Income updated", "income_id": income_id}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.delete("/income/{income_id}")
def delete_income(income_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor,
            "SELECT id FROM income WHERE id=%s",
            (income_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Income not found")

        cursor.execute("DELETE FROM income WHERE id=%s", (income_id,))
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
# Budgets
# ==========================================

@app.post("/budgets", status_code=201)
def create_budget(bud: BudgetCreate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        if not _user_exists(cursor, bud.user_id):
            raise HTTPException(status_code=404, detail="User not found")

        cursor.execute(
            "INSERT INTO budgets (user_id, month, year, budget_amount) VALUES (%s, %s, %s, %s)",
            (bud.user_id, bud.month, bud.year, bud.budget_amount)
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
def list_budgets():
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        rows = _fetch_all(
            cursor,
            "SELECT id, user_id, month, year, budget_amount FROM budgets"
        )
        return {"count": len(rows), "budgets": rows}
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/budgets/{budget_id}")
def get_budget(budget_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        row = _fetch_one(
            cursor,
            "SELECT id, user_id, month, year, budget_amount FROM budgets WHERE id=%s",
            (budget_id,)
        )
        if not row:
            raise HTTPException(status_code=404, detail="Budget not found")
        return row
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.get("/users/{user_id}/budgets")
def list_user_budgets(user_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        if not _user_exists(cursor, user_id):
            raise HTTPException(status_code=404, detail="User not found")

        rows = _fetch_all(
            cursor,
            "SELECT id, month, year, budget_amount FROM budgets WHERE user_id=%s",
            (user_id,)
        )
        return {"user_id": user_id, "count": len(rows), "budgets": rows}
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.put("/budgets/{budget_id}")
def update_budget(budget_id: int, bud: BudgetUpdate):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor,
            "SELECT id FROM budgets WHERE id=%s",
            (budget_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Budget not found")

        fields = []
        values = []

        if bud.month is not None:
            fields.append("month=%s")
            values.append(bud.month)
        if bud.year is not None:
            fields.append("year=%s")
            values.append(bud.year)
        if bud.budget_amount is not None:
            fields.append("budget_amount=%s")
            values.append(bud.budget_amount)

        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        values.append(budget_id)
        query = f"UPDATE budgets SET {', '.join(fields)} WHERE id=%s"
        cursor.execute(query, values)
        conn.commit()
        return {"message": "Budget updated", "budget_id": budget_id}
    except HTTPException:
        raise
    except MySQLError as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


@app.delete("/budgets/{budget_id}")
def delete_budget(budget_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        existing = _fetch_one(
            cursor,
            "SELECT id FROM budgets WHERE id=%s",
            (budget_id,)
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Budget not found")

        cursor.execute("DELETE FROM budgets WHERE id=%s", (budget_id,))
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

@app.get("/dashboard/{user_id}")
def get_dashboard(user_id: int):
    conn = get_connection()
    cursor = _dict_cursor(conn)
    try:
        if not _user_exists(cursor, user_id):
            raise HTTPException(status_code=404, detail="User not found")

        expense_row = _fetch_one(
            cursor,
            "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt FROM expenses WHERE user_id=%s",
            (user_id,)
        )
        income_row = _fetch_one(
            cursor,
            "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt FROM income WHERE user_id=%s",
            (user_id,)
        )
        now = date.today()
        budget_row = _fetch_one(
            cursor,
            "SELECT COALESCE(SUM(budget_amount), 0) AS total FROM budgets WHERE user_id=%s AND month=%s AND year=%s",
            (user_id, now.month, now.year)
        )

        total_expenses = float(expense_row["total"])
        total_income = float(income_row["total"])
        budget = float(budget_row["total"])
        remaining = budget - total_expenses if budget else None

        return {
            "total_expenses": total_expenses,
            "total_income": total_income,
            "budget": budget if budget else None,
            "remaining_budget": remaining,
            "expense_count": expense_row["cnt"],
            "income_count": income_row["cnt"],
        }
    except HTTPException:
        raise
    except MySQLError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()
