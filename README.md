# AcessoLab — Sistema de Autenticação e Autorização

Projeto acadêmico desenvolvido por **Carlos Abe** para o **TDE 04**, demonstrando autenticação e autorização em uma aplicação web com **Node.js, JavaScript, HTML e CSS**.

## Funcionalidades

- Cadastro de usuário com perfil `aluno`;
- Login e logout com controle de sessões;
- Senhas protegidas por hash **scrypt** com salt;
- Área de usuário protegida por autenticação;
- Área administrativa com controle de acesso por papel (**RBAC**);
- Proteção CSRF e testes automatizados;
- Respostas HTTP **200**, **201**, **401** e **403** para demonstrar permissões.

## Requisitos

Node.js **20 ou superior**. O projeto usa módulos nativos do Node.js e não precisa instalar dependências externas.

## Executar localmente

```bash
npm start
```

Abra **http://127.0.0.1:3000** no navegador.

Cadastre um usuário pela interface. Para criar um administrador, execute em outro terminal:

```bash
npm run criar-admin
```

Para executar os testes:

```bash
npm test
```

## Estrutura

- `server.js` — servidor, rotas, sessões e permissões;
- `src/users.js` — usuários e hash de senha;
- `public/` — interface HTML, CSS e JavaScript;
- `scripts/criar-admin.js` — criação de administrador;
- `tests/acesso.test.js` — testes de integração.

## Demonstração de permissões

| Usuário | Área pública | Painel | Administração |
|---|---|---|---|
| Visitante | 200 | 401 | 401 |
| Aluno | 200 | 200 | 403 |
| Administrador | 200 | 200 | 200 |

**Autenticação** verifica quem é o usuário; **autorização** determina quais recursos ele pode acessar. As permissões são verificadas no servidor, não apenas na interface.

## Segurança e finalidade

Este é um projeto **educacional para execução local**, não uma aplicação pronta para hospedar na internet. Os usuários de teste são armazenados em `data/users.json`, que **não deve ser versionado**. Não utilize senhas reais durante os testes.

## Referências

- [OWASP — Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [Node.js — Crypto](https://nodejs.org/api/crypto.html)

Desenvolvido como atividade acadêmica para demonstrar conceitos de segurança em aplicações web.
