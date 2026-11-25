window.API = {
  async request(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ${res.status}`);
    }
    return data;
  },

  get(path) {
    return this.request(path, { method: 'GET' });
  },
  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body || {}) });
  },
  put(path, body) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body || {}) });
  },
  del(path) {
    return this.request(path, { method: 'DELETE' });
  },
};
