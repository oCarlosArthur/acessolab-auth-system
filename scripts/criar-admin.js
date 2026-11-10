'use strict';
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { createUser, findByEmail, hashPassword } = require('../src/users');

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    console.log('\n=== Criar administrador do AcessoLab ===');
    console.log('Esta operação ocorre no terminal, nunca no cadastro público.\n');
    const nome = (await rl.question('Nome: ')).trim();
    const email = (await rl.question('E-mail: ')).trim().toLowerCase();
    const senha = await rl.question('Senha (mínimo 10 caracteres; visível no terminal): ');
    if (nome.length < 2 || nome.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || senha.length < 10 || senha.length > 128) {
      throw new Error('Dados inválidos. Confira nome, e-mail e senha (10 a 128 caracteres).');
    }
    if (findByEmail(email)) throw new Error('Este e-mail já está cadastrado. Escolha outro.');
    const senhaHash = await hashPassword(senha);
    createUser({ nome, email, senhaHash, papel: 'admin' });
    console.log(`\n✓ Administrador ${email} criado! Já pode entrar no site.`);
  } finally { rl.close(); }
}
main().catch((error) => { console.error(`\n✗ ${error.message}`); process.exitCode = 1; });
