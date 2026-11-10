'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempData = fs.mkdtempSync(path.join(os.tmpdir(), 'acessolab-test-'));
process.env.DATA_DIR = tempData;
const { server } = require('../server');
const { createUser, hashPassword } = require('../src/users');

function client(base) {
  let cookie = '';
  let token = null;
  return {
    async call(route, method = 'GET', body = undefined, includeCsrf = true) {
      const response = await fetch(`${base}${route}`, {
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(method !== 'GET' ? { 'Content-Type': 'application/json', ...(includeCsrf ? { 'X-CSRF-Token': token || '' } : {}) } : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const data = await response.json();
      if (data.csrfToken) token = data.csrfToken;
      return { status: response.status, data };
    }
  };
}

test('Autenticação, autorização, CSRF, papéis e logout funcionando', async () => {
  const adminHash = await hashPassword('SenhaAdmin123!');
  createUser({ nome: 'Admin de Teste', email: 'admin@exemplo.com', senhaHash: adminHash, papel: 'admin' });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const visitor = client(base);
  const student = client(base);
  const admin = client(base);

  try {
    assert.equal((await visitor.call('/api/publico')).status, 200, 'Rota pública');
    assert.equal((await visitor.call('/api/painel')).status, 401, 'Sem login: 401');
    assert.equal((await visitor.call('/api/admin/usuarios')).status, 401, 'Sem login: admin 401');

    assert.equal((await student.call('/api/csrf')).status, 200);
    assert.equal((await student.call('/api/cadastro', 'POST', { nome: 'Estudante Teste', email: 'aluno@exemplo.com', senha: 'MinhaSenha123', papel: 'admin' }, false)).status, 403, 'Sem token CSRF');
    const signedUp = await student.call('/api/cadastro', 'POST', { nome: 'Estudante Teste', email: 'aluno@exemplo.com', senha: 'MinhaSenha123', papel: 'admin' });
    assert.equal(signedUp.status, 201);
    assert.equal(signedUp.data.usuario.papel, 'aluno', 'Cadastro público não permite escolher admin');
    assert.equal((await student.call('/api/painel')).status, 200, 'Aluno autenticado acessa painel');
    assert.equal((await student.call('/api/admin/usuarios')).status, 403, 'Aluno autenticado não pode acessar admin');
    assert.equal((await student.call('/api/me')).data.usuario.email, 'aluno@exemplo.com');

    assert.equal((await admin.call('/api/csrf')).status, 200);
    const adminLogin = await admin.call('/api/login', 'POST', { email: 'admin@exemplo.com', senha: 'SenhaAdmin123!' });
    assert.equal(adminLogin.status, 200, 'Login do admin');
    assert.equal(adminLogin.data.usuario.papel, 'admin');
    const adminList = await admin.call('/api/admin/usuarios');
    assert.equal(adminList.status, 200, 'Admin acessa rota exclusiva');
    assert.equal(adminList.data.total, 2);
    assert.equal(adminList.data.usuarios.some((user) => 'senhaHash' in user), false, 'Hashes não retornados na API');

    assert.equal((await student.call('/api/logout', 'POST', {})).status, 200);
    assert.equal((await student.call('/api/painel')).status, 401, 'Após logout perde acesso');
    assert.equal((await student.call('/api/csrf')).status, 200);
    assert.equal((await student.call('/api/login', 'POST', { email: 'aluno@exemplo.com', senha: 'SenhaIncorreta' })).status, 401);
    assert.equal((await student.call('/api/login', 'POST', { email: 'aluno@exemplo.com', senha: 'MinhaSenha123' })).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempData, { recursive: true, force: true });
  }
});
