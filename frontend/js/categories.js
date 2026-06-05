document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupCategoryForm();
    loadCategories();
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

function setupCategoryForm() {
    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;

        const btn = document.getElementById('saveCategoryBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');
        const name = document.getElementById('categoryName').value.trim();

        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        if (!name) {
            errorEl.textContent = 'Category name is required.';
            errorEl.className = 'alert alert-danger show';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
            await post('/categories', { user_id: user.id, category_name: name });
            successEl.textContent = 'Category created successfully!';
            successEl.className = 'alert alert-success show';
            document.getElementById('categoryForm').reset();
            loadCategories();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Category';
        }
    });
}

async function loadCategories() {
    const user = getCurrentUser();
    if (!user) return;

    const tbody = document.getElementById('categoriesBody');
    const loading = document.getElementById('loadingCategories');
    const empty = document.getElementById('categoriesEmpty');

    loading.style.display = 'flex';

    try {
        const result = await get(`/users/${user.id}/categories`);
        const categories = result.categories || [];

        loading.style.display = 'none';

        if (!categories.length) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        tbody.innerHTML = categories.map((cat, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(cat.category_name)}</td>
            </tr>
        `).join('');
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('errorAlert').textContent = 'Failed to load categories: ' + err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
