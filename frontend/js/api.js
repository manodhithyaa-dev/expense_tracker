const API_BASE = 'http://localhost:8000';

function getTokens() {
    return {
        access: localStorage.getItem('access_token'),
        refresh: localStorage.getItem('refresh_token'),
    };
}

function storeTokens(access, refresh) {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
}

function clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
}

async function refreshAccessToken() {
    const { refresh } = getTokens();
    if (!refresh) throw new Error('No refresh token');

    const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) throw new Error('Token refresh failed');
    const data = await res.json();
    storeTokens(data.access_token, data.refresh_token);
    return data.access_token;
}

async function request(method, endpoint, data = null, retry = true) {
    const { access } = getTokens();
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (access) {
        options.headers['Authorization'] = `Bearer ${access}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    let response = await fetch(`${API_BASE}${endpoint}`, options);

    if (response.status === 401 && access && retry) {
        try {
            const newToken = await refreshAccessToken();
            options.headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(`${API_BASE}${endpoint}`, options);
        } catch {
            clearTokens();
            window.location.href = 'login.html';
            throw new Error('Session expired');
        }
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.detail || `Request failed with status ${response.status}`);
    }

    return result;
}

async function get(endpoint) {
    return request('GET', endpoint);
}

async function post(endpoint, data) {
    return request('POST', endpoint, data);
}

async function put(endpoint, data) {
    return request('PUT', endpoint, data);
}

async function del(endpoint) {
    return request('DELETE', endpoint);
}
