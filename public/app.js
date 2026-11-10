'use strict';

const state = { csrfToken: null, user: null, entries: [], view: 'overview' };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
let toastTimeout;

function showToast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 3600);
}

function addLog(method, route, status) {
  state.entries.unshift({ method, route, status, time: new Date().toLocaleTimeString('pt-BR') });
  state.entries = state.entries.slice(0, 15);
  const container = $('#request-log');
  container.replaceChildren();
  for (const item of state.entries) {
    const row = document.createElement('div');
    row.className = 'log-row';
    const code = document.createElement('span');
    code.className = `log-code ${item.status >= 200 && item.status < 300 ? 'ok' : item.status === 401 ? 'auth' : item.status === 403 ? 'denied' : 'other'}`;
    code.textContent = String(item.status);
    const meth = document.createElement('span'); meth.className = 'log-method'; meth.textContent = item.method;
    const path = document.createElement('span'); path.className = 'log-path'; path.textContent = item.route;
    const time = document.createElement('span'); time.className = 'log-time'; time.textContent = item.time;
    row.append(code, meth, path, time);
    container.appendChild(row);
  }
}

async function api(route, { method = 'GET', body, log = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = state.csrfToken || '';
  }
  try {
    const response = await fetch(route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    const data = await response.json();
    if (log) {
      addLog(method, route, response.status);
      $('#response-preview').textContent = JSON.stringify({ statusHTTP: response.status, ...data }, null, 2);
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    if (log) $('#response-preview').textContent = 'Falha de conexão com o servidor.';
    return { ok: false, status: 0, data: { erro: 'Não foi possível conectar ao servidor.' } };
  }
}

function updateIdentity() {
  const user = state.user;
  $('#current-profile').textContent = user ? `${user.nome} · ${user.papel}` : 'Visitante';
  $('#avatar').textContent = user ? user.nome.slice(0, 1).toUpperCase() : '?';
  $$('[data-guest]').forEach((item) => { item.hidden = !!user; });
  $$('[data-auth]').forEach((item) => { item.hidden = !user; });
  $$('[data-admin]').forEach((item) => { item.hidden = !user || user.papel !== 'admin'; });
  $('#logout-btn').hidden = !user;
  if (user) {
    $('#welcome-heading').textContent = `Olá, ${user.nome.split(' ')[0]}!`;
    $('#welcome-copy').textContent = 'Seu acesso foi validado e esta página está disponível para sua conta.';
    $('#dash-name').textContent = user.nome;
    $('#dash-email').textContent = user.email;
    $('#dash-role').textContent = user.papel === 'admin' ? 'Administrador' : 'Aluno';
  }
}

async function loadAdmin() {
  const result = await api('/api/admin/usuarios');
  if (!result.ok) { showToast(result.data.erro || 'Acesso negado.', true); return; }
  $('#admin-total').textContent = result.data.total;
  const body = $('#admin-users');
  body.replaceChildren();
  for (const user of result.data.usuarios) {
    const row = document.createElement('tr');
    for (const prop of ['nome', 'email', 'papel', 'criadoEm']) {
      const cell = document.createElement('td');
      if (prop === 'papel') {
        const badge = document.createElement('span');
        badge.className = `role-tag ${user.papel === 'admin' ? 'admin' : ''}`;
        badge.textContent = user.papel === 'admin' ? 'Admin' : 'Aluno';
        cell.appendChild(badge);
      } else if (prop === 'criadoEm') {
        cell.textContent = new Date(user.criadoEm).toLocaleDateString('pt-BR');
      } else cell.textContent = user[prop];
      row.appendChild(cell);
    }
    body.appendChild(row);
  }
}

function switchView(view) {
  if (['dashboard', 'admin'].includes(view) && !state.user) view = 'login';
  if (view === 'admin' && state.user?.papel !== 'admin') view = 'overview';
  if (['login', 'register'].includes(view) && state.user) view = 'dashboard';
  state.view = view;
  $$('.view').forEach((element) => {
    const active = element.id === `view-${view}`;
    element.classList.toggle('active', active);
    element.hidden = !active;
  });
  $$('.tab').forEach((button) => button.classList.toggle('active', button.dataset.viewTarget === view));
  if (view === 'admin') loadAdmin();
  if (view === 'dashboard') api('/api/painel');
}

async function refreshCsrf() {
  const result = await api('/api/csrf', { log: false });
  state.csrfToken = result.data.csrfToken || null;
}

async function handleAuthentication(form, route) {
  const btn = form.querySelector('[type=submit]');
  const values = Object.fromEntries(new FormData(form).entries());
  btn.disabled = true;
  try {
    const result = await api(route, { method: 'POST', body: values });
    if (!result.ok) { showToast(result.data.erro || 'Não foi possível continuar.', true); return; }
    state.user = result.data.usuario;
    state.csrfToken = result.data.csrfToken;
    form.reset();
    updateIdentity();
    showToast(route === '/api/cadastro' ? 'Cadastro realizado com sucesso!' : 'Login efetuado com sucesso!');
    switchView('dashboard');
  } finally { btn.disabled = false; }
}

$$('[data-view-target]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.viewTarget)));
$$('[data-test]').forEach((button) => button.addEventListener('click', async () => {
  const result = await api(button.dataset.test);
  if (result.ok) showToast(`HTTP ${result.status}: acesso permitido!`);
  else showToast(`HTTP ${result.status}: ${result.data.erro || 'Acesso negado.'}`, true);
}));
$('#login-form').addEventListener('submit', (event) => { event.preventDefault(); handleAuthentication(event.currentTarget, '/api/login'); });
$('#register-form').addEventListener('submit', (event) => { event.preventDefault(); handleAuthentication(event.currentTarget, '/api/cadastro'); });
$('#logout-btn').addEventListener('click', async () => {
  const result = await api('/api/logout', { method: 'POST', body: {} });
  if (!result.ok) { showToast(result.data.erro || 'Falha ao sair.', true); return; }
  state.user = null;
  state.csrfToken = null;
  await refreshCsrf();
  updateIdentity();
  switchView('overview');
  showToast('Você saiu da sua conta.');
});
$('#refresh-admin').addEventListener('click', loadAdmin);
$('#clear-log').addEventListener('click', () => {
  state.entries = [];
  $('#request-log').replaceChildren();
  const empty = document.createElement('div');
  empty.className = 'empty-log';
  empty.textContent = 'Nenhuma requisição de teste ainda.';
  $('#request-log').appendChild(empty);
  $('#response-preview').textContent = 'Histórico limpo. Teste uma rota novamente.';
});

(async function init() {
  await refreshCsrf();
  const result = await api('/api/me', { log: false });
  state.user = result.data.usuario || null;
  updateIdentity();
  switchView('overview');
})();
