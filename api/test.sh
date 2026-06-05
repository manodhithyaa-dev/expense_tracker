#!/bin/bash

BASE_URL="http://127.0.0.1:8000"
TOKEN=""

echo "================================="
echo "HEALTH CHECK"
echo "================================="
curl -s "$BASE_URL/"
echo -e "\n\n"

echo "================================="
echo "REGISTER USER 1"
echo "================================="
RESP=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mano","age":21,"email":"mano@example.com","password":"secure123"}')
echo "$RESP"
TOKEN1=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
echo -e "\n\n"

echo "================================="
echo "REGISTER USER 2"
echo "================================="
RESP2=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"John","age":25,"email":"john@example.com","password":"secure456"}')
echo "$RESP2"
TOKEN2=$(echo "$RESP2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
echo -e "\n\n"

echo "================================="
echo "TEST DUPLICATE EMAIL"
echo "================================="
curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Dup","age":30,"email":"mano@example.com","password":"test123"}'
echo -e "\n\n"

echo "================================="
echo "LOGIN USER 1"
echo "================================="
RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mano@example.com","password":"secure123"}')
echo "$RESP"
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
echo -e "\n\n"

echo "================================="
echo "GET CURRENT USER"
echo "================================="
curl -s "$BASE_URL/auth/me" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "LOGIN INVALID PASSWORD"
echo "================================="
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mano@example.com","password":"wrong"}'
echo -e "\n\n"

echo "================================="
echo "CREATE CATEGORY"
echo "================================="
curl -s -X POST "$BASE_URL/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"category_name":"Food"}'
echo -e "\n\n"

curl -s -X POST "$BASE_URL/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"category_name":"Transport"}'
echo -e "\n\n"

echo "================================="
echo "LIST CATEGORIES"
echo "================================="
curl -s "$BASE_URL/categories" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "UPDATE CATEGORY"
echo "================================="
curl -s -X PUT "$BASE_URL/categories/1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"category_name":"Groceries"}'
echo -e "\n\n"

echo "================================="
echo "DUPLICATE CATEGORY"
echo "================================="
curl -s -X POST "$BASE_URL/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"category_name":"Groceries"}'
echo -e "\n\n"

echo "================================="
echo "CREATE EXPENSE"
echo "================================="
curl -s -X POST "$BASE_URL/expenses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"category_id":1,"title":"Pizza dinner","amount":450,"expense_date":"2026-06-05","payment_method":"card","merchant_name":"Pizza Hut"}'
echo -e "\n\n"

curl -s -X POST "$BASE_URL/expenses" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"category_id":1,"title":"Bus pass","amount":150,"expense_date":"2026-06-03","payment_method":"upi"}'
echo -e "\n\n"

echo "================================="
echo "LIST EXPENSES"
echo "================================="
curl -s "$BASE_URL/expenses?page=1&limit=10" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "SEARCH EXPENSES"
echo "================================="
curl -s "$BASE_URL/expenses?search=Pizza" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "UPDATE EXPENSE"
echo "================================="
curl -s -X PUT "$BASE_URL/expenses/1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Pizza and pasta","amount":550,"notes":"Dinner with family"}'
echo -e "\n\n"

echo "================================="
echo "DELETE EXPENSE"
echo "================================="
curl -s -X DELETE "$BASE_URL/expenses/2" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "LIST EXPENSES AFTER DELETE"
echo "================================="
curl -s "$BASE_URL/expenses" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "CREATE INCOME"
echo "================================="
curl -s -X POST "$BASE_URL/income" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"source":"Salary","amount":50000,"income_date":"2026-06-01","income_type":"salary"}'
echo -e "\n\n"

curl -s -X POST "$BASE_URL/income" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"source":"Freelance","amount":5000,"income_date":"2026-06-10","income_type":"freelance"}'
echo -e "\n\n"

echo "================================="
echo "LIST INCOME"
echo "================================="
curl -s "$BASE_URL/income" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "UPDATE INCOME"
echo "================================="
curl -s -X PUT "$BASE_URL/income/1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"source":"Salary","amount":55000,"income_date":"2026-06-01"}'
echo -e "\n\n"

echo "================================="
echo "DELETE INCOME"
echo "================================="
curl -s -X DELETE "$BASE_URL/income/2" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "CREATE BUDGET"
echo "================================="
curl -s -X POST "$BASE_URL/budgets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"month":6,"year":2026,"budget_amount":10000}'
echo -e "\n\n"

echo "================================="
echo "UPDATE BUDGET (UPSERT SAME MONTH/YEAR)"
echo "================================="
curl -s -X POST "$BASE_URL/budgets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"month":6,"year":2026,"budget_amount":15000}'
echo -e "\n\n"

echo "================================="
echo "LIST BUDGETS"
echo "================================="
curl -s "$BASE_URL/budgets" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "DELETE BUDGET"
echo "================================="
curl -s -X DELETE "$BASE_URL/budgets/1" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "DASHBOARD (CURRENT MONTH)"
echo "================================="
curl -s "$BASE_URL/dashboard" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "MONTHLY REPORT"
echo "================================="
curl -s "$BASE_URL/reports/monthly?year=2026&month=6" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "UPDATE PROFILE"
echo "================================="
curl -s -X PUT "$BASE_URL/users/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Mano Updated","age":22}'
echo -e "\n\n"

echo "================================="
echo "CHANGE PASSWORD"
echo "================================="
curl -s -X PUT "$BASE_URL/users/password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"current_password":"secure123","new_password":"newsecure456"}'
echo -e "\n\n"

echo "================================="
echo "LOGIN WITH NEW PASSWORD"
echo "================================="
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mano@example.com","password":"newsecure456"}'
echo -e "\n\n"

echo "================================="
echo "SETTINGS - UPDATE"
echo "================================="
curl -s -X PUT "$BASE_URL/settings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"currency":"INR","budget_warning_percent":85}'
echo -e "\n\n"

echo "================================="
echo "SETTINGS - GET"
echo "================================="
curl -s "$BASE_URL/settings" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "GLOBAL SEARCH"
echo "================================="
curl -s "$BASE_URL/search?q=Pizza" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "NOTIFICATIONS"
echo "================================="
curl -s "$BASE_URL/notifications" -H "Authorization: Bearer $TOKEN"
echo -e "\n\n"

echo "================================="
echo "EXPORT BACKUP"
echo "================================="
curl -s "$BASE_URL/export/backup" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Expenses: {len(d.get(\"expenses\",[]))}, Income: {len(d.get(\"income\",[]))}')" 2>/dev/null
echo -e "\n\n"

echo "================================="
echo "UNAUTHORIZED ACCESS (SHOULD FAIL)"
echo "================================="
curl -s "$BASE_URL/dashboard"
echo -e "\n\n"

echo "================================="
echo "ALL TESTS COMPLETE"
echo "================================="
