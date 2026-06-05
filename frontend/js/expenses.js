document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    loadCategoryOptions();
    setupExpenseForm();
    setupCancelEdit();
    loadExpenses();
});

function setupSidebar() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    });
}

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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadCategoryOptions() {
    const user = getCurrentUser();
    if (!user) return;

    const select = document.getElementById('expenseCategory');
    select.innerHTML = '<option value="">Select a category</option>';

    try {
        const result = await get(`/users/${user.id}/categories`);
        const categories = result.categories || [];

        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.category_name;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load categories:', err);
    }
}

function setupExpenseForm() {
    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;

        const editId = document.getElementById('editExpenseId').value;
        const btn = document.getElementById('saveExpenseBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');

        const category_id = parseInt(document.getElementById('expenseCategory').value);
        const title = document.getElementById('expenseTitle').value.trim();
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const expense_date = document.getElementById('expenseDate').value;
        const notes = document.getElementById('expenseNotes').value.trim();

        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        if (!category_id) {
            errorEl.textContent = 'Please select a category.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        if (!title) {
            errorEl.textContent = 'Title is required.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        if (!amount || amount <= 0) {
            errorEl.textContent = 'Please enter a valid amount.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        if (!expense_date) {
            errorEl.textContent = 'Please select a date.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        btn.disabled = true;

        try {
            const payload = {
                user_id: user.id,
                category_id,
                title,
                amount,
                expense_date,
                notes: notes || null
            };

            if (editId) {
                await put(`/expenses/${editId}`, payload);
                successEl.textContent = 'Expense updated successfully!';
                cancelEdit();
            } else {
                await post('/expenses', payload);
                successEl.textContent = 'Expense added successfully!';
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

function setupCancelEdit() {
    document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);
}

function cancelEdit() {
    document.getElementById('editExpenseId').value = '';
    document.getElementById('expenseForm').reset();
    document.getElementById('formTitle').textContent = 'Add Expense';
    document.getElementById('saveExpenseBtn').textContent = 'Add Expense';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

function editExpense(id, category_id, title, amount, expense_date, notes) {
    document.getElementById('editExpenseId').value = id;
    document.getElementById('expenseCategory').value = category_id;
    document.getElementById('expenseTitle').value = title;
    document.getElementById('expenseAmount').value = amount;
    document.getElementById('expenseDate').value = expense_date;
    document.getElementById('expenseNotes').value = notes || '';

    document.getElementById('formTitle').textContent = 'Edit Expense';
    document.getElementById('saveExpenseBtn').textContent = 'Update Expense';
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';

    document.getElementById('expenseCategory').focus();

    document.getElementById('errorAlert').className = 'alert alert-danger';
    document.getElementById('successAlert').className = 'alert alert-success';
}

async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    const errorEl = document.getElementById('errorAlert');
    const successEl = document.getElementById('successAlert');
    errorEl.className = 'alert alert-danger';
    successEl.className = 'alert alert-success';

    try {
        await del(`/expenses/${id}`);
        successEl.textContent = 'Expense deleted successfully!';
        successEl.className = 'alert alert-success show';
        loadExpenses();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.className = 'alert alert-danger show';
    }
}

async function loadExpenses() {
    const user = getCurrentUser();
    if (!user) return;

    const tbody = document.getElementById('expensesBody');
    const loading = document.getElementById('loadingExpenses');
    const empty = document.getElementById('expensesEmpty');

    loading.style.display = 'flex';

    try {
        const result = await get(`/users/${user.id}/expenses`);
        const expenses = result.expenses || [];

        loading.style.display = 'none';

        if (!expenses.length) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        tbody.innerHTML = expenses.map(exp => `
            <tr>
                <td><strong>${escapeHtml(exp.title)}</strong></td>
                <td>${escapeHtml(exp.category_name || 'Uncategorized')}</td>
                <td>${formatCurrency(exp.amount)}</td>
                <td>${formatDate(exp.expense_date)}</td>
                <td>
                    <div class="actions">
                        <button class="btn btn-warning btn-sm" onclick="editExpense(${exp.id}, ${exp.category_id}, '${escapeHtml(exp.title)}', ${exp.amount}, '${exp.expense_date}', '${escapeHtml(exp.notes || '')}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteExpense(${exp.id})">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('errorAlert').textContent = 'Failed to load expenses: ' + err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}
