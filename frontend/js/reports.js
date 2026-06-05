let reportType = 'monthly';
let reportCategoryChart = null;
let reportBudgetChart = null;

document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupReportUI();
    setupGenerate();
});

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

function setupReportUI() {
    const now = new Date();
    document.getElementById('reportYear').value = now.getFullYear();
    document.getElementById('reportMonth').value = now.getMonth() + 1;

    document.querySelectorAll('[data-report]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-report]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            reportType = btn.dataset.report;
            document.getElementById('reportMonth').style.display = reportType === 'monthly' ? 'inline-block' : 'none';
        });
    });
}

function setupGenerate() {
    document.getElementById('generateReport').addEventListener('click', generateReport);
}

async function generateReport() {
    const loading = document.getElementById('loadingReport');
    const content = document.getElementById('reportContent');
    const stats = document.getElementById('reportStats');
    const year = document.getElementById('reportYear').value;
    const month = document.getElementById('reportMonth').value;

    loading.style.display = 'flex';
    content.style.display = 'none';

    try {
        let data;
        if (reportType === 'monthly') {
            data = await get(`/reports/monthly?year=${year}&month=${month}`);
        } else if (reportType === 'yearly') {
            data = await get(`/reports/yearly?year=${year}`);
        } else {
            const sd = document.getElementById('startDate')?.value || `${year}-01-01`;
            const ed = document.getElementById('endDate')?.value || `${year}-12-31`;
            data = await get(`/reports/custom?start_date=${sd}&end_date=${ed}`);
        }

        stats.innerHTML = `
            <div class="stat-card"><div class="stat-icon green">&#8593;</div><div class="stat-label">Income</div><div class="stat-value">${formatCurrency(data.income)}</div></div>
            <div class="stat-card"><div class="stat-icon red">&#36;</div><div class="stat-label">Expenses</div><div class="stat-value">${formatCurrency(data.expenses)}</div></div>
            <div class="stat-card"><div class="stat-icon blue">&#128176;</div><div class="stat-label">Savings</div><div class="stat-value">${formatCurrency(data.savings)}</div></div>
        `;

        if (data.budget_utilization !== null && data.budget_utilization !== undefined) {
            stats.innerHTML += `
                <div class="stat-card"><div class="stat-icon yellow">&#8722;</div><div class="stat-label">Budget Used</div><div class="stat-value">${data.budget_utilization.toFixed(1)}%</div></div>
            `;
        }

        renderReportCharts(data);
        renderTransactions(data);
        loading.style.display = 'none';
        content.style.display = 'block';
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('loadingReport').innerHTML = '<div style="color:var(--danger)">Failed to load report: ' + err.message + '</div>';
    }
}

function renderReportCharts(data) {
    const cats = data.top_categories || [];
    const colors = ['#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6','#ec4899','#14b8a6'];

    if (reportCategoryChart) reportCategoryChart.destroy();
    const ctx = document.getElementById('reportCategoryChart').getContext('2d');
    reportCategoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: cats.map(c => c.category_name),
            datasets: [{ data: cats.map(c => parseFloat(c.total)), backgroundColor: colors.slice(0, cats.length), borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
    });

    if (reportBudgetChart) reportBudgetChart.destroy();
    if (data.budget_utilization !== null && data.budget_utilization !== undefined) {
        const ctx2 = document.getElementById('reportBudgetChart').getContext('2d');
        const util = data.budget_utilization;
        reportBudgetChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Used', 'Remaining'],
                datasets: [{ data: [util, Math.max(0, 100 - util)], backgroundColor: util > 80 ? ['#ef4444','#e2e8f0'] : ['#3b82f6','#e2e8f0'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => `${ctx.raw}%` } } } }
        });
    }
}

function renderTransactions(data) {
    const tbody = document.getElementById('reportTransactionsBody');
    const transactions = data.largest_transactions || [];
    if (!transactions.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary)">No transactions found</td></tr>';
        return;
    }
    tbody.innerHTML = transactions.map(t => `
        <tr>
            <td><strong>${escapeHtml(t.title)}</strong></td>
            <td>${escapeHtml(t.category_name)}</td>
            <td>${formatCurrency(t.amount)}</td>
        </tr>
    `).join('');
}
