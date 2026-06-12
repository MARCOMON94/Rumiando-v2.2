const configuredApiUrl = import.meta.env.VITE_API_URL;

function isConfiguredLocalhost(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/api\/?$/i.test(String(url || ''));
}

function isBrowserLocalhost() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function resolveApiUrl() {
  if (configuredApiUrl && (!isConfiguredLocalhost(configuredApiUrl) || isBrowserLocalhost())) {
    return configuredApiUrl.replace(/\/$/, '');
  }

  return '/api';
}

const API_URL = resolveApiUrl();

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = data?.message || data?.error || 'Error en la petición';
    throw new Error(message);
  }

  return data;
}

export function get(endpoint, options = {}) {
  return request(endpoint, {
    ...options,
    method: 'GET'
  });
}

export function post(endpoint, body, options = {}) {
  return request(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function put(endpoint, body, options = {}) {
  return request(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export function del(endpoint, options = {}) {
  return request(endpoint, {
    ...options,
    method: 'DELETE'
  });
}

export function apiUrl() {
  return API_URL;
}
