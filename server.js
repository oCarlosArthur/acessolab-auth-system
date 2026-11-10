'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { createUser, findById, findByEmail, listUsers, publicUser, hashPassword, verifyPassword } = require('./src/users');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');
const SESSION_MS = 30 * 60 * 1000;
const secureCookie = process.env.COOKIE_SECURE === '1'; // HTTPS em produção
const sessions = new Map(); // Armazenamento em memória: somente para demonstração local.
const failures = new Map();

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(JSON.stringify(data));
}

function cookieHeader(id, maxAge = 1800) {
  return `acessolab_session=${encodeURIComponent(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`;
}

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  const pair = cookies.find((part) => part.trim().startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.trim().slice(name.length + 1)) : null;
}

function currentSession(req) {
  const id = readCookie(req, 'acessolab_session');
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) { sessions.delete(id); return null; }
  session.expiresAt = Date.now() + SESSION_MS;
  return { id, session };
}

function establishSession(req, res, userId = null) {
  const existing = currentSession(req);
  if (existing) sessions.delete(existing.id); // troca o ID ao autenticar (anti-fixação)
  const id = randomBytes(32).toString('base64url');
  const session = { userId, csrf: randomBytes(32).toString('hex'), expiresAt: Date.now() + SESSION_MS };
  sessions.set(id, session);
  res.setHeader('Set-Cookie', cookieHeader(id));
  return session;
}

function getUser(req) {
  const entry = currentSession(req);
  return entry?.session.userId ? findById(entry.session.userId) : null;
}

function requireLogin(req) {
  const user = getUser(req);
  if (!user) throw new HttpError(401, 'Faça login para acessar este recurso.');
  return user;
}

function requireRole(req, papel) {
  const user = requireLogin(req);
  if (user.papel !== papel) throw new HttpError(403, 'Acesso negado: sua conta não possui esta permissão.');
  return user;
}

function checkCsrf(req) {
  const entry = currentSession(req);
  const got = String(req.headers['x-csrf-token'] || '');
  const expected = entry?.session.csrf;
  if (!expected || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    throw new HttpError(403, 'Token de proteção inválido. Atualize a página.');
  }
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) {
    throw new HttpError(403, 'Origem não permitida.');
  }
}

async function parseBody(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    throw new HttpError(415, 'Envie os dados em JSON.');
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 16 * 1024) throw new HttpError(413, 'Dados muito grandes.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Formato inválido');
    return value;
  } catch { throw new HttpError(400, 'JSON inválido.'); }
}

function validateUserInput(nome, email, senha) {
  if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 60) {
    throw new HttpError(400, 'O nome deve ter entre 2 e 60 caracteres.');
  }
  if (typeof email !== 'string' || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new HttpError(400, 'Informe um e-mail válido.');
  }
  if (typeof senha !== 'string' || senha.length < 10 || senha.length > 128) {
    throw new HttpError(400, 'A senha deve ter entre 10 e 128 caracteres.');
  }
}

function rateLimitKey(req, email) { return `${req.socket.remoteAddress || ''}|${email}`; }
function checkRateLimit(req, email) {
  const key = rateLimitKey(req, email);
  const entry = failures.get(key);
  if (entry && entry.until > Date.now() && entry.count >= 5) {
    throw new HttpError(429, 'Muitas tentativas. Tente novamente em 15 minutos.');
  }
  if (entry?.until <= Date.now()) failures.delete(key);
  return key;
}
function loginFailure(key) {
  const prev = failures.get(key);
  failures.set(key, { count: (prev?.count || 0) + 1, until: Date.now() + 15 * 60 * 1000 });
}

function serveStatic(res, filename) {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
  const extension = path.extname(filename);
  const type = types[extension];
  if (!type) throw new HttpError(404, 'Arquivo não encontrado.');
  const file = path.join(PUBLIC, filename);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new HttpError(404, 'Arquivo não encontrado.');
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

async function handler(req, res) {
  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const route = url.pathname;
    const method = req.method;

    if (method === 'GET' && ['/', '/index.html', '/styles.css', '/app.js'].includes(route)) {
      return serveStatic(res, route === '/' ? 'index.html' : route.slice(1));
    }
    if (!route.startsWith('/api/')) throw new HttpError(404, 'Página não encontrada.');

    if (method === 'GET' && route === '/api/csrf') {
      const entry = currentSession(req);
      const session = entry?.session || establishSession(req, res);
      return json(res, 200, { csrfToken: session.csrf });
    }
    if (method === 'GET' && route === '/api/publico') {
      return json(res, 200, { mensagem: 'Recurso público: qualquer pessoa pode consultar.', nivel: 'PÚBLICO' });
    }
    if (method === 'GET' && route === '/api/me') {
      return json(res, 200, { usuario: publicUser(getUser(req)) });
    }
    if (method === 'GET' && route === '/api/painel') {
      const user = requireLogin(req);
      return json(res, 200, { mensagem: `Bem-vindo(a), ${user.nome}! Esta rota exige autenticação.`, nivel: 'AUTENTICADO', usuario: publicUser(user) });
    }
    if (method === 'GET' && route === '/api/admin/usuarios') {
      const admin = requireRole(req, 'admin');
      const usuarios = listUsers();
      return json(res, 200, { mensagem: `Permissão concedida para ${admin.nome}.`, nivel: 'ADMINISTRADOR', usuarios, total: usuarios.length });
    }
    if (method === 'POST' && ['/api/cadastro', '/api/login', '/api/logout'].includes(route)) {
      checkCsrf(req);
      const body = await parseBody(req);

      if (route === '/api/cadastro') {
        const { nome, email, senha } = body;
        validateUserInput(nome, email, senha);
        if (findByEmail(email.trim().toLowerCase())) throw new HttpError(409, 'E-mail já cadastrado.');
        const senhaHash = await hashPassword(senha);
        let user;
        try { user = createUser({ nome, email, senhaHash, papel: 'aluno' }); }
        catch (error) { if (error.code === 'EMAIL_EXISTE') throw new HttpError(409, 'E-mail já cadastrado.'); throw error; }
        // Cadastro público sempre cria aluno; nunca aceita o papel enviado pelo navegador.
        const session = establishSession(req, res, user.id);
        return json(res, 201, { mensagem: 'Cadastro realizado.', usuario: publicUser(user), csrfToken: session.csrf });
      }

      if (route === '/api/login') {
        const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
        const senha = typeof body.senha === 'string' ? body.senha : '';
        if (email.length > 160 || senha.length > 128) throw new HttpError(400, 'Entrada inválida.');
        const key = checkRateLimit(req, email);
        const user = findByEmail(email);
        const valid = user && await verifyPassword(senha, user.senhaHash);
        if (!valid) {
          loginFailure(key);
          throw new HttpError(401, 'E-mail ou senha incorretos.');
        }
        failures.delete(key);
        const session = establishSession(req, res, user.id);
        return json(res, 200, { mensagem: 'Login realizado.', usuario: publicUser(user), csrfToken: session.csrf });
      }

      if (route === '/api/logout') {
        const entry = currentSession(req);
        if (entry) sessions.delete(entry.id);
        res.setHeader('Set-Cookie', cookieHeader('', 0));
        return json(res, 200, { mensagem: 'Sessão encerrada com sucesso.' });
      }
    }

    throw new HttpError(404, 'Rota não encontrada.');
  } catch (error) {
    if (!(error instanceof HttpError)) console.error('Erro interno:', error);
    const status = error instanceof HttpError ? error.status : 500;
    if (!res.headersSent) json(res, status, { erro: status === 500 ? 'Erro interno no servidor.' : error.message });
  }
}

const server = http.createServer(handler);
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`\n✓ AcessoLab no ar: http://${HOST}:${PORT}`);
    console.log('  Para criar um administrador: npm run criar-admin\n');
  });
}
module.exports = { server };
