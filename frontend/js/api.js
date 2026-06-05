const API_BASE = 'http://localhost:8000';

async function request(method, endpoint, data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
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
