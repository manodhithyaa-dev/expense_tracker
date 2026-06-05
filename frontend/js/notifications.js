document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    document.getElementById('markAllRead').addEventListener('click', markAllRead);
    loadNotifications();
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadNotifications() {
    const loading = document.getElementById('loadingNotif');
    const list = document.getElementById('notifList');
    const empty = document.getElementById('notifEmpty');

    loading.style.display = 'flex';

    try {
        const result = await get('/notifications');
        const notifs = result.notifications || [];

        loading.style.display = 'none';

        if (!notifs.length) {
            list.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        list.innerHTML = notifs.map(n => `
            <div class="card" style="margin-bottom:12px;${!n.is_read ? 'border-left:4px solid var(--primary);' : 'opacity:0.7;'}">
                <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;">
                    <div>
                        <strong style="color:${n.type === 'danger' ? 'var(--danger)' : n.type === 'warning' ? 'var(--warning)' : 'var(--text)'}">${escapeHtml(n.title)}</strong>
                        ${n.message ? `<p style="margin:4px 0 0;font-size:0.85rem;color:var(--text-secondary)">${escapeHtml(n.message)}</p>` : ''}
                        <small style="color:var(--text-secondary)">${n.created_at ? new Date(n.created_at).toLocaleString() : ''}</small>
                    </div>
                    <div class="actions">
                        ${!n.is_read ? `<button class="btn btn-sm btn-outline" onclick="markRead(${n.id})">Mark Read</button>` : ''}
                        <button class="btn btn-sm btn-danger" onclick="deleteNotif(${n.id})">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        loading.style.display = 'none';
        list.innerHTML = `<div style="color:var(--danger)">Failed to load: ${err.message}</div>`;
    }
}

async function markRead(id) {
    try {
        await put(`/notifications/${id}/read`);
        loadNotifications();
    } catch (err) {
        alert(err.message);
    }
}

async function markAllRead() {
    try {
        await put('/notifications/read-all');
        loadNotifications();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteNotif(id) {
    if (!confirm('Delete this notification?')) return;
    try {
        await del(`/notifications/${id}`);
        loadNotifications();
    } catch (err) {
        alert(err.message);
    }
}
