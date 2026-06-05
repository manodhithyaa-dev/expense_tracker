document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupBudgetForm();
    setupCancelEdit();
    loadBudgets();
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

const MONTH_NAMES = {
    1: 'January', 2: 'February', 3: 'March', 4: 'April',
    5: 'May', 6: 'June', 7: 'July', 8: 'August',
    9: 'September', 10: 'October', 11: 'November', 12: 'December'
};

function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupCancelEdit() {
    document.getElementById('cancelBudgetEditBtn').addEventListener('click', cancelBudgetEdit);
}

function cancelBudgetEdit() {
    document.getElementById('editBudgetId').value = '';
    document.getElementById('budgetForm').reset();
    document.getElementById('budgetFormTitle').textContent = 'Set Budget';
    document.getElementById('saveBudgetBtn').textContent = 'Set Budget';
    document.getElementById('cancelBudgetEditBtn').style.display = 'none';
    document.getElementById('budgetYear').value = new Date().getFullYear();
    document.getElementById('budgetMonth').value = new Date().getMonth() + 1;
}

function editBudget(id, month, year, budget_amount) {
    document.getElementById('editBudgetId').value = id;
    document.getElementById('budgetMonth').value = month;
    document.getElementById('budgetYear').value = year;
    document.getElementById('budgetAmount').value = budget_amount;
    document.getElementById('budgetFormTitle').textContent = 'Edit Budget';
    document.getElementById('saveBudgetBtn').textContent = 'Update Budget';
    document.getElementById('cancelBudgetEditBtn').style.display = 'inline-flex';
    document.getElementById('budgetMonth').focus();
    document.getElementById('errorAlert').className = 'alert alert-danger';
    document.getElementById('successAlert').className = 'alert alert-success';
}

async function deleteBudget(id) {
    if (!confirm('Are you sure you want to delete this budget?')) return;

    const errorEl = document.getElementById('errorAlert');
    const successEl = document.getElementById('successAlert');
    errorEl.className = 'alert alert-danger';
    successEl.className = 'alert alert-success';

    try {
        await del(`/budgets/${id}`);
        successEl.textContent = 'Budget deleted successfully!';
        successEl.className = 'alert alert-success show';
        loadBudgets();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.className = 'alert alert-danger show';
    }
}

function setupBudgetForm() {
    const yearInput = document.getElementById('budgetYear');
    if (!yearInput.value) {
        yearInput.value = new Date().getFullYear();
    }

    const monthSelect = document.getElementById('budgetMonth');
    if (!monthSelect.value) {
        monthSelect.value = new Date().getMonth() + 1;
    }

    document.getElementById('budgetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;

        const editId = document.getElementById('editBudgetId').value;
        const btn = document.getElementById('saveBudgetBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');

        const month = parseInt(document.getElementById('budgetMonth').value);
        const year = parseInt(document.getElementById('budgetYear').value);
        const budget_amount = parseFloat(document.getElementById('budgetAmount').value);

        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        if (!month) {
            errorEl.textContent = 'Please select a month.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        if (!year || year < 2000 || year > 2100) {
            errorEl.textContent = 'Please enter a valid year (2000-2100).';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        if (!budget_amount || budget_amount <= 0) {
            errorEl.textContent = 'Please enter a valid budget amount.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        btn.disabled = true;

        try {
            if (editId) {
                await put(`/budgets/${editId}`, { month, year, budget_amount });
                successEl.textContent = 'Budget updated successfully!';
                cancelBudgetEdit();
            } else {
                await post('/budgets', { user_id: user.id, month, year, budget_amount });
                successEl.textContent = 'Budget set successfully!';
                document.getElementById('budgetForm').reset();
                yearInput.value = new Date().getFullYear();
                monthSelect.value = new Date().getMonth() + 1;
            }

            successEl.className = 'alert alert-success show';
            loadBudgets();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false;
            btn.textContent = editId ? 'Update Budget' : 'Set Budget';
        }
    });
}

async function loadBudgets() {
    const user = getCurrentUser();
    if (!user) return;

    const tbody = document.getElementById('budgetsBody');
    const loading = document.getElementById('loadingBudgets');
    const empty = document.getElementById('budgetsEmpty');

    loading.style.display = 'flex';

    try {
        const result = await get(`/users/${user.id}/budgets`);
        const budgets = result.budgets || [];

        loading.style.display = 'none';

        if (!budgets.length) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        tbody.innerHTML = budgets.map(bud => `
            <tr>
                <td>${MONTH_NAMES[bud.month] || 'Unknown'}</td>
                <td>${bud.year}</td>
                <td><strong>${formatCurrency(bud.budget_amount)}</strong></td>
                <td>
                    <div class="actions">
                        <button class="btn btn-warning btn-sm" onclick="editBudget(${bud.id}, ${bud.month}, ${bud.year}, ${bud.budget_amount})">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteBudget(${bud.id})">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('errorAlert').textContent = 'Failed to load budgets: ' + err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}
