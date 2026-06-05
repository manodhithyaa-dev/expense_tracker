document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupProfileForm();
    setupPasswordForm();
    loadProfile();
});

function loadProfile() {
    const user = getCurrentUser();
    if (!user) return;
    document.getElementById('profileName').value = user.name || '';
    document.getElementById('profileEmail').value = user.email || '';

    get('/auth/me').then(data => {
        if (data.age) document.getElementById('profileAge').value = data.age;
    }).catch(() => {});
}

function setupProfileForm() {
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveProfileBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');
        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        const name = document.getElementById('profileName').value.trim();
        const age = document.getElementById('profileAge').value.trim();
        const email = document.getElementById('profileEmail').value.trim();

        if (!name || name.length < 2) { errorEl.textContent = 'Name must be at least 2 characters.'; errorEl.className = 'alert alert-danger show'; return; }
        if (!email) { errorEl.textContent = 'Email required.'; errorEl.className = 'alert alert-danger show'; return; }

        btn.disabled = true; btn.textContent = 'Saving...';
        try {
            const payload = { name, email };
            if (age) payload.age = parseInt(age);
            const result = await put('/users/profile', payload);
            const updatedUser = result.user || { ...getCurrentUser(), name, email };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            displayUserInfo();
            successEl.textContent = 'Profile updated!';
            successEl.className = 'alert alert-success show';
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false; btn.textContent = 'Save Changes';
        }
    });
}

function setupPasswordForm() {
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('savePasswordBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');
        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword) { errorEl.textContent = 'Current password required.'; errorEl.className = 'alert alert-danger show'; return; }
        if (newPassword.length < 6) { errorEl.textContent = 'New password must be at least 6 characters.'; errorEl.className = 'alert alert-danger show'; return; }
        if (newPassword !== confirmPassword) { errorEl.textContent = 'Passwords do not match.'; errorEl.className = 'alert alert-danger show'; return; }

        btn.disabled = true; btn.textContent = 'Changing...';
        try {
            await put('/users/password', { current_password: currentPassword, new_password: newPassword });
            successEl.textContent = 'Password changed!';
            successEl.className = 'alert alert-success show';
            document.getElementById('passwordForm').reset();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false; btn.textContent = 'Change Password';
        }
    });
}
