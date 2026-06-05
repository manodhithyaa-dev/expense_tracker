#!/bin/bash

BASE_URL="http://127.0.0.1:8000"

echo "================================="
echo "HEALTH CHECK"
echo "================================="
curl -s "$BASE_URL/"
echo -e "\n\n"

echo "================================="
echo "CREATE USER 1"
echo "================================="
curl -s -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mano",
    "age": 21,
    "email": "mano@example.com",
    "password": "secure123"
  }'
echo -e "\n\n"

echo "================================="
echo "CREATE USER 2"
echo "================================="
curl -s -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John",
    "age": 25,
    "email": "john@example.com",
    "password": "secure456"
  }'
echo -e "\n\n"

echo "================================="
echo "TEST DUPLICATE EMAIL"
echo "================================="
curl -s -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate",
    "age": 30,
    "email": "mano@example.com",
    "password": "test123"
  }'
echo -e "\n\n"

echo "================================="
echo "LIST USERS"
echo "================================="
curl -s "$BASE_URL/users"
echo -e "\n\n"

echo "================================="
echo "GET USER 1"
echo "================================="
curl -s "$BASE_URL/users/1"
echo -e "\n\n"

echo "================================="
echo "GET INVALID USER"
echo "================================="
curl -s "$BASE_URL/users/999"
echo -e "\n\n"

echo "================================="
echo "LOGIN USER 1"
echo "================================="
curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mano@example.com",
    "password": "secure123"
  }'
echo -e "\n\n"

echo "================================="
echo "LOGIN INVALID PASSWORD"
echo "================================="
curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "mano@example.com",
    "password": "wrongpassword"
  }'
echo -e "\n\n"

echo "================================="
echo "CREATE CATEGORY FOR USER 1"
echo "================================="
curl -s -X POST "$BASE_URL/categories" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "category_name": "Food"
  }'
echo -e "\n\n"

curl -s -X POST "$BASE_URL/categories" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "category_name": "Transport"
  }'
echo -e "\n\n"

echo "================================="
echo "CREATE CATEGORY FOR USER 2"
echo "================================="
curl -s -X POST "$BASE_URL/categories" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "category_name": "Shopping"
  }'
echo -e "\n\n"

echo "================================="
echo "LIST ALL CATEGORIES"
echo "================================="
curl -s "$BASE_URL/categories"
echo -e "\n\n"

echo "================================="
echo "LIST USER 1 CATEGORIES"
echo "================================="
curl -s "$BASE_URL/users/1/categories"
echo -e "\n\n"

echo "================================="
echo "CREATE EXPENSE FOR USER 1 (Food)"
echo "================================="
curl -s -X POST "$BASE_URL/expenses" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "category_id": 1,
    "title": "Pizza dinner",
    "amount": 450.00,
    "expense_date": "2026-06-05",
    "notes": "Dinner with friends"
  }'
echo -e "\n\n"

curl -s -X POST "$BASE_URL/expenses" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "category_id": 2,
    "title": "Bus pass",
    "amount": 150.00,
    "expense_date": "2026-06-03"
  }'
echo -e "\n\n"

echo "================================="
echo "CREATE EXPENSE FOR USER 2 (Shopping)"
echo "================================="
curl -s -X POST "$BASE_URL/expenses" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "category_id": 3,
    "title": "New shoes",
    "amount": 2500.00,
    "expense_date": "2026-06-04",
    "notes": "Sports shoes"
  }'
echo -e "\n\n"

echo "================================="
echo "TEST INVALID CATEGORY"
echo "================================="
curl -s -X POST "$BASE_URL/expenses" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "category_id": 999,
    "title": "Test",
    "amount": 100.00,
    "expense_date": "2026-06-05"
  }'
echo -e "\n\n"

echo "================================="
echo "TEST CATEGORY NOT BELONGING TO USER"
echo "================================="
curl -s -X POST "$BASE_URL/expenses" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "category_id": 3,
    "title": "Test wrong category",
    "amount": 100.00,
    "expense_date": "2026-06-05"
  }'
echo -e "\n\n"

echo "================================="
echo "TEST INVALID USER EXPENSE"
echo "================================="
curl -s -X POST "$BASE_URL/expenses" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 999,
    "category_id": 1,
    "title": "Test",
    "amount": 100.00,
    "expense_date": "2026-06-05"
  }'
echo -e "\n\n"

echo "================================="
echo "LIST ALL EXPENSES"
echo "================================="
curl -s "$BASE_URL/expenses"
echo -e "\n\n"

echo "================================="
echo "GET EXPENSE 1"
echo "================================="
curl -s "$BASE_URL/expenses/1"
echo -e "\n\n"

echo "================================="
echo "LIST USER 1 EXPENSES"
echo "================================="
curl -s "$BASE_URL/users/1/expenses"
echo -e "\n\n"

echo "================================="
echo "LIST USER 2 EXPENSES"
echo "================================="
curl -s "$BASE_URL/users/2/expenses"
echo -e "\n\n"

echo "================================="
echo "UPDATE EXPENSE 1"
echo "================================="
curl -s -X PUT "$BASE_URL/expenses/1" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Pizza and pasta",
    "amount": 550.00,
    "notes": "Dinner with family"
  }'
echo -e "\n\n"

echo "================================="
echo "VERIFY EXPENSE UPDATE"
echo "================================="
curl -s "$BASE_URL/expenses/1"
echo -e "\n\n"

echo "================================="
echo "DELETE EXPENSE 2"
echo "================================="
curl -s -X DELETE "$BASE_URL/expenses/2"
echo -e "\n\n"

echo "================================="
echo "VERIFY DELETE"
echo "================================="
curl -s "$BASE_URL/expenses"
echo -e "\n\n"

echo "================================="
echo "CREATE INCOME FOR USER 1"
echo "================================="
curl -s -X POST "$BASE_URL/income" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "source": "Salary",
    "amount": 50000.00,
    "income_date": "2026-06-01"
  }'
echo -e "\n\n"

curl -s -X POST "$BASE_URL/income" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "source": "Freelance",
    "amount": 5000.00,
    "income_date": "2026-06-10"
  }'
echo -e "\n\n"

echo "================================="
echo "CREATE INCOME FOR USER 2"
echo "================================="
curl -s -X POST "$BASE_URL/income" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "source": "Salary",
    "amount": 30000.00,
    "income_date": "2026-06-01"
  }'
echo -e "\n\n"

echo "================================="
echo "LIST ALL INCOME"
echo "================================="
curl -s "$BASE_URL/income"
echo -e "\n\n"

echo "================================="
echo "LIST USER 1 INCOME"
echo "================================="
curl -s "$BASE_URL/users/1/income"
echo -e "\n\n"

echo "================================="
echo "CREATE BUDGET FOR USER 1"
echo "================================="
curl -s -X POST "$BASE_URL/budgets" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "month": 6,
    "year": 2026,
    "budget_amount": 10000.00
  }'
echo -e "\n\n"

echo "================================="
echo "CREATE BUDGET FOR USER 2"
echo "================================="
curl -s -X POST "$BASE_URL/budgets" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "month": 6,
    "year": 2026,
    "budget_amount": 8000.00
  }'
echo -e "\n\n"

echo "================================="
echo "LIST ALL BUDGETS"
echo "================================="
curl -s "$BASE_URL/budgets"
echo -e "\n\n"

echo "================================="
echo "LIST USER 1 BUDGETS"
echo "================================="
curl -s "$BASE_URL/users/1/budgets"
echo -e "\n\n"

echo "================================="
echo "DASHBOARD USER 1"
echo "================================="
curl -s "$BASE_URL/dashboard/1"
echo -e "\n\n"

echo "================================="
echo "DASHBOARD USER 2"
echo "================================="
curl -s "$BASE_URL/dashboard/2"
echo -e "\n\n"

echo "================================="
echo "ALL TESTS COMPLETE"
echo "================================="
