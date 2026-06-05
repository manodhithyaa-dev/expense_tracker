let trendChart = null, categoryChart = null, budgetChart = null;
let currentPeriod = 'current';

document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupPeriodSelector();
    loadNotificationsBadge();
    loadDashboard();
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPeriodDates() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const start = `${y}-${String(m).padStart(2,'0')}-01`;
    const end = `${y}-${String(m).padStart(2,'0')}-${new Date(y, m, 0).getDate()}`;

    if (currentPeriod === 'current') {
        const endD = new Date();
        return { start, end: endD.toISOString().split('T')[0] };
    }
    if (currentPeriod === 'previous') {
        const prev = new Date(y, m - 2, 1);
        const py = prev.getFullYear();
        const pm = prev.getMonth() + 1;
        const s = `${py}-${String(pm).padStart(2,'0')}-01`;
        const e = `${py}-${String(pm).padStart(2,'0')}-${new Date(py, pm, 0).getDate()}`;
        return { start: s, end: e };
    }
    if (currentPeriod === 'yearly') {
        return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
    return { start: document.getElementById('startDate').value, end: document.getElementById('endDate').value };
}

function setupPeriodSelector() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            const dr = document.getElementById('dateRange');
            dr.style.display = currentPeriod === 'custom' ? 'flex' : 'none';

            if (currentPeriod === 'yearly') {
                const now = new Date();
                document.getElementById('startDate').value = `${now.getFullYear()}-01-01`;
                document.getElementById('endDate').value = `${now.getFullYear()}-12-31`;
            } else if (currentPeriod === 'custom') {
                const now = new Date();
                const s = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
                document.getElementById('startDate').value = s;
                document.getElementById('endDate').value = now.toISOString().split('T')[0];
            }
            loadDashboard();
        });
    });

    document.getElementById('applyDateRange').addEventListener('click', loadDashboard);

    const now = new Date();
    document.getElementById('startDate').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    document.getElementById('endDate').value = now.toISOString().split('T')[0];
}

function getChangeHtml(pct, label) {
    if (pct === null || pct === undefined) return `<span style="color:var(--text-secondary)">No prior data</span>`;
    const cls = pct > 0 ? 'green' : 'red';
    const arrow = pct > 0 ? '&#8593;' : '&#8595;';
    return `<span style="color:var(--${cls})">${arrow} ${Math.abs(pct)}% vs ${label}</span>`;
}

async function loadDashboard() {
    const user = getCurrentUser();
    if (!user) return;

    const dates = getPeriodDates();
    const params = `?start_date=${dates.start}&end_date=${dates.end}`;
    document.getElementById('loadingIndicator').style.display = 'flex';
    document.getElementById('dashboardContent').style.display = 'none';

    try {
        const data = await get(`/dashboard${params}`);
        renderStats(data);
        renderRecentExpenses();
        loadCharts(dates);
    } catch (err) {
        console.error('Dashboard error:', err);
    } finally {
        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';
    }
}

function renderStats(data) {
    document.getElementById('statIncome').textContent = formatCurrency(data.total_income);
    document.getElementById('statExpenses').textContent = formatCurrency(data.total_expenses);
    document.getElementById('statSavings').textContent = formatCurrency(data.net_savings);
    document.getElementById('statAvgDaily').textContent = formatCurrency(data.avg_daily_spending);

    if (data.vs_previous) {
        const v = data.vs_previous;
        document.getElementById('statIncomeChange').innerHTML = getChangeHtml(v.income_change_pct, 'last period');
        document.getElementById('statExpenseChange').innerHTML = getChangeHtml(v.expense_change_pct ? -v.expense_change_pct : null, 'last period');
        document.getElementById('statSavingsChange').innerHTML = getChangeHtml(v.savings_change_pct, 'last period');
    }

    if (data.budget) {
        document.getElementById('statBudget').textContent = formatCurrency(data.budget);
        document.getElementById('statRemaining').textContent = formatCurrency(data.remaining_budget);
        const util = data.budget_utilization;
        document.getElementById('statBudgetUtil').textContent = `${util !== null && util !== undefined ? util : 0}% utilized`;
        document.getElementById('statBudgetUtil').style.color = util > 80 ? 'var(--danger)' : 'var(--success)';
        document.getElementById('statRemaining').style.color = data.remaining_budget < 0 ? 'var(--danger)' : 'var(--success)';
    } else {
        document.getElementById('statBudget').textContent = 'No budget';
        document.getElementById('statRemaining').textContent = '-';
        document.getElementById('statBudgetUtil').textContent = '';
    }

    if (data.top_category) {
        document.getElementById('statTopCategory').innerHTML = `${escapeHtml(data.top_category.category_name)}: ${formatCurrency(data.top_category.total)}`;
    } else {
        document.getElementById('statTopCategory').textContent = 'No expenses';
    }

    if (data.largest_expense) {
        document.getElementById('statLargestExpense').innerHTML = `${escapeHtml(data.largest_expense.title)}: ${formatCurrency(data.largest_expense.amount)}`;
    } else {
        document.getElementById('statLargestExpense').textContent = 'No expenses';
    }
}

async function loadCharts(dates) {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const now = new Date();
        const y = now.getFullYear();

        const yearlyRes = await get(`/reports/yearly?year=${y}`);
        renderTrendChart(yearlyRes.monthly_breakdown || []);
        renderCategoryChart(yearlyRes.top_categories || []);
    } catch {
        // charts may fail silently
    }

    try {
        const m = now.getMonth() + 1;
        const monthlyRes = await get(`/reports/monthly?year=${y}&month=${m}`);
        if (monthlyRes.budget_utilization !== null) {
            renderBudgetChart(monthlyRes.budget_utilization);
        }
    } catch {
        // budget chart may fail
    }
}

function renderTrendChart(monthlyData) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = monthlyData.map(d => months[d.month - 1]);
    const expenses = monthlyData.map(d => d.expenses);
    const income = monthlyData.map(d => d.income);

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Income', data: income, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true },
                { label: 'Expenses', data: expenses, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.3, fill: true },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + v.toLocaleString() } } }
        }
    });
}

function renderCategoryChart(categories) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const colors = ['#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1'];

    if (categoryChart) categoryChart.destroy();

    const top5 = categories.slice(0, 7);
    const labels = top5.map(c => c.category_name);
    const data = top5.map(c => parseFloat(c.total));

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } }
            }
        }
    });
}

function renderBudgetChart(utilization) {
    const ctx = document.getElementById('budgetChart').getContext('2d');

    if (budgetChart) budgetChart.destroy();

    budgetChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Used', 'Remaining'],
            datasets: [{
                data: [utilization, Math.max(0, 100 - utilization)],
                backgroundColor: utilization > 80 ? ['#ef4444', '#e2e8f0'] : ['#3b82f6', '#e2e8f0'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: ctx => `${ctx.raw}%` } }
            }
        }
    });
}

async function renderRecentExpenses() {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const dates = getPeriodDates();
        const result = await get(`/expenses?start_date=${dates.start}&end_date=${dates.end}&limit=5`);
        const expenses = result.expenses || [];
        const tbody = document.getElementById('recentExpensesBody');
        const empty = document.getElementById('recentEmpty');

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
            </tr>
        `).join('');
    } catch {
        // silent
    }
}
