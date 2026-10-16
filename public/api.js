// When staff open a client's page (/admin/clients/<id>), every API call acts on
// that client's account by adding ?as=<id>. Otherwise calls go through as-is.
(() => {
  const match = location.pathname.match(/^\/admin\/clients\/(\d+)$/);
  window.VIEWING_CLIENT_ID = match ? match[1] : null;

  window.apiFetch = (path, options) => {
    if (!window.VIEWING_CLIENT_ID) return fetch(path, options);
    const sep = path.includes('?') ? '&' : '?';
    return fetch(`${path}${sep}as=${window.VIEWING_CLIENT_ID}`, options);
  };
})();
