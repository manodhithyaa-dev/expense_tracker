document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupIncomeForm();
    document.getElementById('cancelIncomeEditBtn').addEventListener('click', cancelEdit);
    loadIncome();
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

function cancelEdit() {
    document.getElementById('editIncomeId').value = '';
    document.getElementById('incomeForm').reset();
    document.getElementById('incomeFormTitle').textContent = 'Add Income';
    document.getElementById('saveIncomeBtn').textContent = 'Add Income';
    document.getElementById('cancelIncomeEditBtn').style.display = 'none';
}

function editIncome(id, source, amount, date, type, notes) {
    document.getElementById('editIncomeId').value = id;
    document.getElementById('incomeSource').value = source;
    document.getElementById('incomeAmount').value = amount;
    document.getElementById('incomeDate').value = date;
    document.getElementById('incomeType').value = type || 'other';
    document.getElementById('incomeNotes').value = notes || '';
    document.getElementById('incomeFormTitle').textContent = 'Edit Income';
    document.getElementById('saveIncomeBtn').textContent = 'Update Income';
    document.getElementById('cancelIncomeEditBtn').style.display = 'inline-flex';
}

async function deleteIncome(id) {
    if (!confirm('Delete this income record?')) return;
    try {
        await del(`/income/${id}`);
        document.getElementById('successAlert').textContent = 'Income deleted!';
        document.getElementById('successAlert').className = 'alert alert-success show';
        loadIncome();
    } catch (err) {
        document.getElementById('errorAlert').textContent = err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}

function setupIncomeForm() {
    document.getElementById('incomeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('editIncomeId').value;
        const btn = document.getElementById('saveIncomeBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');
        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        const payload = {
            source: document.getElementById('incomeSource').value.trim(),
            amount: parseFloat(document.getElementById('incomeAmount').value),
            income_date: document.getElementById('incomeDate').value,
            income_type: document.getElementById('incomeType').value,
            notes: document.getElementById('incomeNotes').value.trim() || null,
        };

        if (!payload.source) { errorEl.textContent = 'Source is required.'; errorEl.className = 'alert alert-danger show'; return; }
        if (!payload.amount || payload.amount <= 0) { errorEl.textContent = 'Valid amount required.'; errorEl.className = 'alert alert-danger show'; return; }
        if (!payload.income_date) { errorEl.textContent = 'Select a date.'; errorEl.className = 'alert alert-danger show'; return; }

        btn.disabled = true;
        try {
            if (editId) {
                await put(`/income/${editId}`, payload);
                successEl.textContent = 'Income updated!';
                cancelEdit();
            } else {
                await post('/income', payload);
                successEl.textContent = 'Income added!';
                document.getElementById('incomeForm').reset();
            }
            successEl.className = 'alert alert-success show';
            loadIncome();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false;
            btn.textContent = editId ? 'Update Income' : 'Add Income';
        }
    });
}

async function loadIncome() {
    const tbody = document.getElementById('incomeBody');
    const loading = document.getElementById('loadingIncome');
    const empty = document.getElementById('incomeEmpty');
    loading.style.display = 'flex';

    try {
        const result = await get('/income');
        const incomeList = result.income || [];
        loading.style.display = 'none';

        if (!incomeList.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';
        tbody.innerHTML = incomeList.map(inc => {
            const safeSource = escapeHtml(inc.source);
            const safeNotes = escapeHtml(inc.notes || '');
            return `<tr>
                <td><strong>${safeSource}</strong></td>
                <td>${formatCurrency(inc.amount)}</td>
                <td>${formatDate(inc.income_date)}</td>
                <td>${inc.income_type || 'other'}</td>
                <td><div class="actions">
                    <button class="btn btn-warning btn-sm" onclick="editIncome(${inc.id},'${safeSource}',${inc.amount},'${inc.income_date}','${inc.income_type||'other'}','${safeNotes}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteIncome(${inc.id})">Delete</button>
                </div></td>
            </tr>`;
        }).join('');
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('errorAlert').textContent = err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}
