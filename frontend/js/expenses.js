let currentPage = 1;

document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    loadCategoryOptions();
    setupExpenseForm();
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);
    document.getElementById('searchExpense').addEventListener('input', () => { currentPage = 1; loadExpenses(); });
    loadExpenses();
});

function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
}

async function loadCategoryOptions() {
    const select = document.getElementById('expenseCategory');
    select.innerHTML = '<option value="">Select a category</option>';
    try {
        const result = await get('/categories');
        (result.categories || []).forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id; opt.textContent = cat.category_name;
            select.appendChild(opt);
        });
    } catch (err) { console.error(err); }
}

function cancelEdit() {
    document.getElementById('editExpenseId').value = '';
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseFormTitle').textContent = 'Add Expense';
    document.getElementById('saveExpenseBtn').textContent = 'Add Expense';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

function editExpense(id, cat_id, title, amount, date, notes, type, payment, merchant, tags) {
    document.getElementById('editExpenseId').value = id;
    document.getElementById('expenseCategory').value = cat_id;
    document.getElementById('expenseTitle').value = title;
    document.getElementById('expenseAmount').value = amount;
    document.getElementById('expenseDate').value = date;
    document.getElementById('expenseNotes').value = notes || '';
    document.getElementById('expenseType').value = type || 'expense';
    document.getElementById('paymentMethod').value = payment || 'cash';
    document.getElementById('merchantName').value = merchant || '';
    document.getElementById('expenseTags').value = tags || '';
    document.getElementById('expenseFormTitle').textContent = 'Edit Expense';
    document.getElementById('saveExpenseBtn').textContent = 'Update Expense';
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';
}

async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    try {
        await del(`/expenses/${id}`);
        document.getElementById('successAlert').textContent = 'Expense deleted!';
        document.getElementById('successAlert').className = 'alert alert-success show';
        loadExpenses();
    } catch (err) {
        document.getElementById('errorAlert').textContent = err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}

function setupExpenseForm() {
    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('editExpenseId').value;
        const btn = document.getElementById('saveExpenseBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');
        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        const payload = {
            category_id: parseInt(document.getElementById('expenseCategory').value),
            title: document.getElementById('expenseTitle').value.trim(),
            amount: parseFloat(document.getElementById('expenseAmount').value),
            expense_date: document.getElementById('expenseDate').value,
            notes: document.getElementById('expenseNotes').value.trim() || null,
            expense_type: document.getElementById('expenseType').value,
            payment_method: document.getElementById('paymentMethod').value,
            merchant_name: document.getElementById('merchantName').value.trim() || null,
            tags: document.getElementById('expenseTags').value.trim() || null,
        };

        if (!payload.category_id) { errorEl.textContent = 'Select a category.'; errorEl.className = 'alert alert-danger show'; return; }
        if (!payload.title) { errorEl.textContent = 'Title is required.'; errorEl.className = 'alert alert-danger show'; return; }
        if (!payload.amount || payload.amount <= 0) { errorEl.textContent = 'Valid amount required.'; errorEl.className = 'alert alert-danger show'; return; }
        if (!payload.expense_date) { errorEl.textContent = 'Select a date.'; errorEl.className = 'alert alert-danger show'; return; }

        btn.disabled = true;
        try {
            if (editId) {
                await put(`/expenses/${editId}`, payload);
                successEl.textContent = 'Expense updated!';
                cancelEdit();
            } else {
                await post('/expenses', payload);
                successEl.textContent = 'Expense added!';
                document.getElementById('expenseForm').reset();
            }
            successEl.className = 'alert alert-success show';
            loadExpenses();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false;
            btn.textContent = editId ? 'Update Expense' : 'Add Expense';
        }
    });
}

async function loadExpenses() {
    const tbody = document.getElementById('expensesBody');
    const loading = document.getElementById('loadingExpenses');
    const empty = document.getElementById('expensesEmpty');
    const search = document.getElementById('searchExpense').value.trim();
    loading.style.display = 'flex';

    try {
        let url = `/expenses?page=${currentPage}&limit=20`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        const result = await get(url);
        const expenses = result.expenses || [];
        loading.style.display = 'none';

        if (!expenses.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';
        tbody.innerHTML = expenses.map(e => {
            const safeTitle = escapeHtml(e.title);
            const safeCat = escapeHtml(e.category_name || '');
            const safeNotes = escapeHtml(e.notes || '');
            const safeMerchant = escapeHtml(e.merchant_name || '');
            const safeTags = escapeHtml(e.tags || '');
            return `<tr>
                <td><strong>${safeTitle}</strong></td>
                <td>${safeCat}</td>
                <td>${formatCurrency(e.amount)}</td>
                <td>${formatDate(e.expense_date)}</td>
                <td>${e.payment_method || 'cash'}</td>
                <td><div class="actions">
                    <button class="btn btn-warning btn-sm" onclick="editExpense(${e.id},${e.category_id},'${safeTitle}',${e.amount},'${e.expense_date}','${safeNotes}','${e.expense_type||'expense'}','${e.payment_method||'cash'}','${safeMerchant}','${safeTags}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteExpense(${e.id})">Delete</button>
                </div></td>
            </tr>`;
        }).join('');
        renderPagination(result);
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('errorAlert').textContent = err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}

function renderPagination(result) {
    const el = document.getElementById('expensePagination');
    if (!result.total_pages || result.total_pages <= 1) { el.innerHTML = ''; return; }
    let html = '<div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">';
    for (let i = 1; i <= result.total_pages; i++) {
        html += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline'}" onclick="currentPage=${i};loadExpenses();">${i}</button>`;
    }
    html += '</div>';
    el.innerHTML = html;
}
