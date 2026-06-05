function getCurrentUser() {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

function isAuthenticated() {
    return !!localStorage.getItem('access_token') && !!getCurrentUser();
}

function protectPage() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }
}

function displayUserInfo() {
    const user = getCurrentUser();
    if (!user) return;

    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const avatarEl = document.getElementById('userAvatar');

    if (nameEl) nameEl.textContent = user.name || 'User';
    if (emailEl) emailEl.textContent = user.email || '';
    if (avatarEl) avatarEl.textContent = (user.name || 'U')[0].toUpperCase();
}

function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

function logout() {
    clearTokens();
    window.location.href = 'login.html';
}

function setupSidebar() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (toggle) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('show');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });
    }
}

async function loadNotificationsBadge() {
    try {
        const result = await get('/notifications');
        const badge = document.getElementById('notifBadge');
        if (badge && result.unread > 0) {
            badge.textContent = result.unread;
            badge.style.display = 'inline';
        } else if (badge) {
            badge.style.display = 'none';
        }
    } catch {
        // silent
    }
}
