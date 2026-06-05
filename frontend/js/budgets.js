document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupBudgetForm();
    document.getElementById('cancelBudgetEditBtn').addEventListener('click', cancelEdit);
    loadBudgets();
});

const MONTH_NAMES = {1:'January',2:'February',3:'March',4:'April',5:'May',6:'June',7:'July',8:'August',9:'September',10:'October',11:'November',12:'December'};

function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cancelEdit() {
    document.getElementById('editBudgetId').value = '';
    document.getElementById('budgetForm').reset();
    document.getElementById('budgetFormTitle').textContent = 'Set Budget';
    document.getElementById('saveBudgetBtn').textContent = 'Set Budget';
    document.getElementById('cancelBudgetEditBtn').style.display = 'none';
    const now = new Date();
    document.getElementById('budgetYear').value = now.getFullYear();
    document.getElementById('budgetMonth').value = now.getMonth() + 1;
}

function editBudget(id, month, year, amount) {
    document.getElementById('editBudgetId').value = id;
    document.getElementById('budgetMonth').value = month;
    document.getElementById('budgetYear').value = year;
    document.getElementById('budgetAmount').value = amount;
    document.getElementById('budgetFormTitle').textContent = 'Edit Budget';
    document.getElementById('saveBudgetBtn').textContent = 'Update Budget';
    document.getElementById('cancelBudgetEditBtn').style.display = 'inline-flex';
}

async function deleteBudget(id) {
    if (!confirm('Delete this budget?')) return;
    try {
        await del(`/budgets/${id}`);
        document.getElementById('successAlert').textContent = 'Budget deleted!';
        document.getElementById('successAlert').className = 'alert alert-success show';
        loadBudgets();
    } catch (err) {
        document.getElementById('errorAlert').textContent = err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}

function setupBudgetForm() {
    const now = new Date();
    const yearInput = document.getElementById('budgetYear');
    if (!yearInput.value) yearInput.value = now.getFullYear();
    const monthSelect = document.getElementById('budgetMonth');
    if (!monthSelect.value) monthSelect.value = now.getMonth() + 1;

    document.getElementById('budgetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('editBudgetId').value;
        const btn = document.getElementById('saveBudgetBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');
        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        const month = parseInt(document.getElementById('budgetMonth').value);
        const year = parseInt(document.getElementById('budgetYear').value);
        const budget_amount = parseFloat(document.getElementById('budgetAmount').value);

        if (!month) { errorEl.textContent = 'Select a month.'; errorEl.className = 'alert alert-danger show'; return; }
        if (!year || year < 2000 || year > 2100) { errorEl.textContent = 'Valid year required.'; errorEl.className = 'alert alert-danger show'; return; }
        if (!budget_amount || budget_amount <= 0) { errorEl.textContent = 'Valid budget amount required.'; errorEl.className = 'alert alert-danger show'; return; }

        btn.disabled = true;
        try {
            if (editId) {
                await put(`/budgets/${editId}`, { month, year, budget_amount });
                successEl.textContent = 'Budget updated!';
                cancelEdit();
            } else {
                await post('/budgets', { month, year, budget_amount });
                successEl.textContent = 'Budget set!';
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
    const tbody = document.getElementById('budgetsBody');
    const loading = document.getElementById('loadingBudgets');
    const empty = document.getElementById('budgetsEmpty');
    loading.style.display = 'flex';

    try {
        const result = await get('/budgets');
        const budgets = result.budgets || [];
        loading.style.display = 'none';
        if (!budgets.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';
        tbody.innerHTML = budgets.map(b => `
            <tr>
                <td>${MONTH_NAMES[b.month] || 'Unknown'}</td>
                <td>${b.year}</td>
                <td><strong>${formatCurrency(b.budget_amount)}</strong></td>
                <td><div class="actions">
                    <button class="btn btn-warning btn-sm" onclick="editBudget(${b.id},${b.month},${b.year},${b.budget_amount})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteBudget(${b.id})">Delete</button>
                </div></td>
            </tr>
        `).join('');
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('errorAlert').textContent = err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}
