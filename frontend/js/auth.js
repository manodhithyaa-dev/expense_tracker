function getCurrentUser() {
    const stored = localStorage.getItem('user');
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

function protectPage() {
    const user = getCurrentUser();
    if (!user) {
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
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}
