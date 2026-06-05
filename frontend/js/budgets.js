document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupBudgetForm();
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
        btn.textContent = 'Setting budget...';

        try {
            await post('/budgets', {
                user_id: user.id,
                month,
                year,
                budget_amount
            });

            successEl.textContent = 'Budget set successfully!';
            successEl.className = 'alert alert-success show';
            document.getElementById('budgetForm').reset();
            yearInput.value = new Date().getFullYear();
            monthSelect.value = new Date().getMonth() + 1;
            loadBudgets();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Set Budget';
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
            </tr>
        `).join('');
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('errorAlert').textContent = 'Failed to load budgets: ' + err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}
