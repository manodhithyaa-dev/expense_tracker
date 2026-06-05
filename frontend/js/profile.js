document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupProfileForm();
    setupPasswordForm();
    loadProfile();
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

function loadProfile() {
    const user = getCurrentUser();
    if (!user) return;

    document.getElementById('profileName').value = user.name || '';
    document.getElementById('profileEmail').value = user.email || '';

    get(`/users/${user.id}`)
        .then(data => {
            if (data.age) {
                document.getElementById('profileAge').value = data.age;
            }
        })
        .catch(err => {
            console.error('Failed to load profile details:', err);
        });
}

function setupProfileForm() {
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;

        const btn = document.getElementById('saveProfileBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');

        const name = document.getElementById('profileName').value.trim();
        const age = document.getElementById('profileAge').value.trim();
        const email = document.getElementById('profileEmail').value.trim();

        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        if (!name || name.length < 2) {
            errorEl.textContent = 'Name must be at least 2 characters.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        if (!email) {
            errorEl.textContent = 'Email is required.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            const payload = { name, email };
            if (age) payload.age = parseInt(age);

            const result = await put(`/users/${user.id}`, payload);

            const updatedUser = result.user || { id: user.id, name, email };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            displayUserInfo();

            successEl.textContent = 'Profile updated successfully!';
            successEl.className = 'alert alert-success show';
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Changes';
        }
    });
}

function setupPasswordForm() {
    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;

        const btn = document.getElementById('savePasswordBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        if (!currentPassword) {
            errorEl.textContent = 'Please enter your current password.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        if (newPassword.length < 6) {
            errorEl.textContent = 'New password must be at least 6 characters.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        if (newPassword !== confirmPassword) {
            errorEl.textContent = 'New passwords do not match.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Changing password...';

        try {
            await put(`/users/${user.id}/password`, {
                current_password: currentPassword,
                new_password: newPassword
            });

            successEl.textContent = 'Password changed successfully!';
            successEl.className = 'alert alert-success show';
            document.getElementById('passwordForm').reset();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Change Password';
        }
    });
}
