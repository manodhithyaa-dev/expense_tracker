document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupCategoryForm();
    setupCancelEdit();
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupCancelEdit() {
    document.getElementById('cancelCategoryEditBtn').addEventListener('click', cancelCategoryEdit);
}

function cancelCategoryEdit() {
    document.getElementById('editCategoryId').value = '';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryFormTitle').textContent = 'Create Category';
    document.getElementById('saveCategoryBtn').textContent = 'Create Category';
    document.getElementById('cancelCategoryEditBtn').style.display = 'none';
}

function editCategory(id, name) {
    document.getElementById('editCategoryId').value = id;
    document.getElementById('categoryName').value = name;
    document.getElementById('categoryFormTitle').textContent = 'Edit Category';
    document.getElementById('saveCategoryBtn').textContent = 'Update Category';
    document.getElementById('cancelCategoryEditBtn').style.display = 'inline-flex';
    document.getElementById('categoryName').focus();
    document.getElementById('errorAlert').className = 'alert alert-danger';
    document.getElementById('successAlert').className = 'alert alert-success';
}

async function deleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category?')) return;

    const errorEl = document.getElementById('errorAlert');
    const successEl = document.getElementById('successAlert');
    errorEl.className = 'alert alert-danger';
    successEl.className = 'alert alert-success';

    try {
        await del(`/categories/${id}`);
        successEl.textContent = 'Category deleted successfully!';
        successEl.className = 'alert alert-success show';
        loadCategories();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.className = 'alert alert-danger show';
    }
}

function setupCategoryForm() {
    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return;

        const editId = document.getElementById('editCategoryId').value;
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

        try {
            if (editId) {
                await put(`/categories/${editId}`, { category_name: name });
                successEl.textContent = 'Category updated successfully!';
                cancelCategoryEdit();
            } else {
                await post('/categories', { user_id: user.id, category_name: name });
                successEl.textContent = 'Category created successfully!';
                document.getElementById('categoryForm').reset();
            }

            successEl.className = 'alert alert-success show';
            loadCategories();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false;
            btn.textContent = editId ? 'Update Category' : 'Create Category';
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
                <td>
                    <div class="actions">
                        <button class="btn btn-warning btn-sm" onclick="editCategory(${cat.id}, '${escapeHtml(cat.category_name)}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCategory(${cat.id})">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('errorAlert').textContent = 'Failed to load categories: ' + err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}
