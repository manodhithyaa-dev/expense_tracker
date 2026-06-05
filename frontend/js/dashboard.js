document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    loadDashboard();
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

async function loadDashboard() {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const data = await get(`/dashboard/${user.id}`);

        document.getElementById('statExpenses').textContent = formatCurrency(data.total_expenses);
        document.getElementById('statIncome').textContent = formatCurrency(data.total_income);

        if (data.budget) {
            document.getElementById('statBudget').textContent = formatCurrency(data.budget);
        } else {
            document.getElementById('statBudget').textContent = 'No budget set';
            document.getElementById('statBudget').style.fontSize = '1rem';
        }

        if (data.remaining_budget !== null && data.remaining_budget !== undefined) {
            const remainingEl = document.getElementById('statRemaining');
            remainingEl.textContent = formatCurrency(data.remaining_budget);
            const subEl = document.getElementById('statRemainingSub');
            if (data.remaining_budget < 0) {
                remainingEl.style.color = 'var(--danger)';
                subEl.textContent = 'Over budget!';
                subEl.style.color = 'var(--danger)';
            } else {
                remainingEl.style.color = 'var(--success)';
                subEl.textContent = 'Within budget';
                subEl.style.color = 'var(--success)';
            }
        } else {
            document.getElementById('statRemaining').textContent = 'No budget';
            document.getElementById('statRemaining').style.fontSize = '1rem';
        }

        document.getElementById('statExpenseCount').textContent = data.expense_count;
        document.getElementById('statIncomeCount').textContent = data.income_count;

        const expenses = await get(`/users/${user.id}/expenses`);
        renderRecentExpenses(expenses.expenses || []);

    } catch (err) {
        console.error('Dashboard load error:', err);
    } finally {
        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';
    }
}

function renderRecentExpenses(expenses) {
    const tbody = document.getElementById('recentExpensesBody');
    const empty = document.getElementById('recentEmpty');

    if (!expenses.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    const recent = expenses.slice(0, 5);

    tbody.innerHTML = recent.map(exp => `
        <tr>
            <td><strong>${escapeHtml(exp.title)}</strong></td>
            <td>${escapeHtml(exp.category_name || 'Uncategorized')}</td>
            <td>${formatCurrency(exp.amount)}</td>
            <td>${formatDate(exp.expense_date)}</td>
        </tr>
    `).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
