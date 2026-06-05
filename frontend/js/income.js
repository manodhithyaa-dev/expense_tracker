document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupIncomeForm();
    loadIncome();
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

function setupIncomeForm() {
    document.getElementById('incomeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;

        const btn = document.getElementById('saveIncomeBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');

        const source = document.getElementById('incomeSource').value.trim();
        const amount = parseFloat(document.getElementById('incomeAmount').value);
        const income_date = document.getElementById('incomeDate').value;

        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        if (!source) {
            errorEl.textContent = 'Source is required.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        if (!amount || amount <= 0) {
            errorEl.textContent = 'Please enter a valid amount.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        if (!income_date) {
            errorEl.textContent = 'Please select a date.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Adding...';

        try {
            await post('/income', {
                user_id: user.id,
                source,
                amount,
                income_date
            });

            successEl.textContent = 'Income added successfully!';
            successEl.className = 'alert alert-success show';
            document.getElementById('incomeForm').reset();
            loadIncome();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Add Income';
        }
    });
}

async function loadIncome() {
    const user = getCurrentUser();
    if (!user) return;

    const tbody = document.getElementById('incomeBody');
    const loading = document.getElementById('loadingIncome');
    const empty = document.getElementById('incomeEmpty');

    loading.style.display = 'flex';

    try {
        const result = await get(`/users/${user.id}/income`);
        const incomeList = result.income || [];

        loading.style.display = 'none';

        if (!incomeList.length) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        tbody.innerHTML = incomeList.map(inc => `
            <tr>
                <td><strong>${escapeHtml(inc.source)}</strong></td>
                <td>${formatCurrency(inc.amount)}</td>
                <td>${formatDate(inc.income_date)}</td>
            </tr>
        `).join('');
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('errorAlert').textContent = 'Failed to load income: ' + err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}
