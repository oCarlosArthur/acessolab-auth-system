'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { promisify } = require('node:util');
const { scrypt, randomBytes, timingSafeEqual } = require('node:crypto');
const scryptAsync = promisify(scrypt);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'users.json');

function loadUsers() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]\n', { flag: 'wx' });
  const users = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!Array.isArray(users)) throw new Error('Banco local inválido');
  return users;
}

function saveUsers(users) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, nome: user.nome, email: user.email, papel: user.papel, criadoEm: user.criadoEm };
}

function findByEmail(email) {
  return loadUsers().find((user) => user.email === email.toLowerCase()) || null;
}

function findById(id) {
  return loadUsers().find((user) => user.id === id) || null;
}

function listUsers() {
  return loadUsers().map(publicUser).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function createUser({ nome, email, senhaHash, papel = 'aluno' }) {
  if (!['aluno', 'admin'].includes(papel)) throw new Error('Papel não permitido');
  const users = loadUsers();
  const normalizedEmail = email.toLowerCase().trim();
  if (users.some((user) => user.email === normalizedEmail)) {
    const error = new Error('E-mail já cadastrado');
    error.code = 'EMAIL_EXISTE';
    throw error;
  }
  const user = {
    id: randomUUID(), nome: nome.trim(), email: normalizedEmail,
    senhaHash, papel, criadoEm: new Date().toISOString()
  };
  users.push(user);
  saveUsers(users);
  return user;
}

// Senhas nunca são salvas em texto puro. scrypt é uma função de derivação lenta.
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  if (typeof encoded !== 'string') return false;
  const parts = encoded.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const actual = await scryptAsync(password, parts[1], 64);
  return timingSafeEqual(actual, Buffer.from(parts[2], 'hex'));
}

module.exports = { createUser, findById, findByEmail, listUsers, publicUser, hashPassword, verifyPassword };
