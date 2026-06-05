document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    loadSettings();
    document.getElementById('settingsForm').addEventListener('submit', saveSettings);
    setupExportDates();
});

function setupExportDates() {
    const now = new Date();
    document.getElementById('exportStart').value = `${now.getFullYear()}-01-01`;
    document.getElementById('exportEnd').value = now.toISOString().split('T')[0];
}

async function loadSettings() {
    try {
        const data = await get('/settings');
        if (data.currency) document.getElementById('settingsCurrency').value = data.currency;
        if (data.date_format) document.getElementById('settingsDateFormat').value = data.date_format;
        if (data.theme) document.getElementById('settingsTheme').value = data.theme;
        if (data.timezone) document.getElementById('settingsTimezone').value = data.timezone;
        if (data.budget_warning_percent) document.getElementById('settingsBudgetWarning').value = data.budget_warning_percent;
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

async function saveSettings(e) {
    e.preventDefault();
    const btn = document.getElementById('saveSettingsBtn');
    const errorEl = document.getElementById('errorAlert');
    const successEl = document.getElementById('successAlert');

    errorEl.className = 'alert alert-danger';
    successEl.className = 'alert alert-success';

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        await put('/settings', {
            currency: document.getElementById('settingsCurrency').value,
            date_format: document.getElementById('settingsDateFormat').value,
            theme: document.getElementById('settingsTheme').value,
            timezone: document.getElementById('settingsTimezone').value.trim(),
            budget_warning_percent: parseInt(document.getElementById('settingsBudgetWarning').value) || 80,
        });
        successEl.textContent = 'Settings saved successfully!';
        successEl.className = 'alert alert-success show';
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.className = 'alert alert-danger show';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Settings';
    }
}

async function exportCSV(type) {
    const sd = document.getElementById('exportStart').value;
    const ed = document.getElementById('exportEnd').value;
    const token = localStorage.getItem('access_token');

    try {
        const res = await fetch(`https://expense-tracker-2-4o4e.onrender.com/export/csv/${type}?start_date=${sd}&end_date=${ed}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${sd}_${ed}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Export failed: ' + err.message);
    }
}

async function exportBackup() {
    try {
        const data = await get('/export/backup');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expense_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Export failed: ' + err.message);
    }
}
