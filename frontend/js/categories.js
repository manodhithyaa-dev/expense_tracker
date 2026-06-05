document.addEventListener('DOMContentLoaded', () => {
    protectPage();
    displayUserInfo();
    setupLogout();
    setupSidebar();
    setupCategoryForm();
    document.getElementById('cancelCatEditBtn').addEventListener('click', cancelEdit);
    loadCategories();
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div'); div.textContent = text; return div.innerHTML;
}

function cancelEdit() {
    document.getElementById('editCategoryId').value = '';
    document.getElementById('categoryForm').reset();
    document.getElementById('catFormTitle').textContent = 'Create Category';
    document.getElementById('saveCategoryBtn').textContent = 'Create';
    document.getElementById('cancelCatEditBtn').style.display = 'none';
}

function editCategory(id, name) {
    document.getElementById('editCategoryId').value = id;
    document.getElementById('categoryName').value = name;
    document.getElementById('catFormTitle').textContent = 'Edit Category';
    document.getElementById('saveCategoryBtn').textContent = 'Update';
    document.getElementById('cancelCatEditBtn').style.display = 'inline-flex';
}

async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    try {
        await del(`/categories/${id}`);
        document.getElementById('successAlert').textContent = 'Category deleted!';
        document.getElementById('successAlert').className = 'alert alert-success show';
        loadCategories();
    } catch (err) {
        document.getElementById('errorAlert').textContent = err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}

function setupCategoryForm() {
    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('editCategoryId').value;
        const btn = document.getElementById('saveCategoryBtn');
        const errorEl = document.getElementById('errorAlert');
        const successEl = document.getElementById('successAlert');
        const name = document.getElementById('categoryName').value.trim();
        errorEl.className = 'alert alert-danger';
        successEl.className = 'alert alert-success';

        if (!name) { errorEl.textContent = 'Name required.'; errorEl.className = 'alert alert-danger show'; return; }

        btn.disabled = true;
        try {
            if (editId) {
                await put(`/categories/${editId}`, { category_name: name });
                successEl.textContent = 'Category updated!';
                cancelEdit();
            } else {
                await post('/categories', { category_name: name });
                successEl.textContent = 'Category created!';
                document.getElementById('categoryForm').reset();
            }
            successEl.className = 'alert alert-success show';
            loadCategories();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.className = 'alert alert-danger show';
        } finally {
            btn.disabled = false;
            btn.textContent = editId ? 'Update' : 'Create';
        }
    });
}

async function loadCategories() {
    const tbody = document.getElementById('categoriesBody');
    const loading = document.getElementById('loadingCategories');
    const empty = document.getElementById('categoriesEmpty');
    loading.style.display = 'flex';

    try {
        const result = await get('/categories');
        const categories = result.categories || [];
        loading.style.display = 'none';
        if (!categories.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
        empty.style.display = 'none';

        let html = '';
        for (const cat of categories) {
            const isSystem = cat.is_system;
            html += `<tr>
                <td>${escapeHtml(cat.category_name)}</td>
                <td>${isSystem ? '<span style="color:var(--text-secondary)">System</span>' : 'Custom'}</td>
                <td><div class="actions">
                    ${isSystem ? '<span style="color:var(--text-secondary);font-size:0.8rem;">Locked</span>' : `
                        <button class="btn btn-warning btn-sm" onclick="editCategory(${cat.id},'${escapeHtml(cat.category_name)}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCategory(${cat.id})">Delete</button>
                    `}
                </div></td>
            </tr>`;
        }
        tbody.innerHTML = html;
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('errorAlert').textContent = err.message;
        document.getElementById('errorAlert').className = 'alert alert-danger show';
    }
}
