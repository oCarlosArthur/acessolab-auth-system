# AcessoLab — Sistema de Autenticação e Autorização

Projeto web desenvolvido por **Carlos Abe** como atividade acadêmica (TDE 04), para demonstrar na prática a diferença entre **autenticar um usuário** e **autorizar o acesso a um recurso**.

**Tecnologias:** Node.js, JavaScript, HTML e CSS.

> **Escopo:** demonstração local e educacional. Não publicar este servidor na internet nem utilizá-lo com dados de usuários reais sem reforçar a segurança.

## 1. O que será demonstrado

- Cadastro de aluno com nome, e-mail e senha.
- Login por e-mail e senha (**autenticação**).
- Sessão no servidor identificada por cookie HttpOnly.
- Painel restrito a quem fez login.
- Área administrativa com acesso exclusivo ao perfil `admin` (**autorização baseada em papéis, RBAC**).
- Retorno HTTP **200** (permitido), **401** (não autenticado) e **403** (sem permissão).
- Encerramento de sessão pelo botão **Sair**.

## 2. Requisitos

- **Node.js 20 ou superior**. Verifique no terminal com `node -v`.
- Um navegador (Chrome, Edge, Firefox etc.).
- Editor opcional: Visual Studio Code.

**Não é necessário instalar pacotes npm!** O projeto utiliza apenas recursos internos do Node.js e JavaScript/HTML/CSS.

## 3. Como iniciar (Windows, macOS ou Linux)

1. Extraia a pasta `AcessoLab_TDE` do arquivo ZIP.
2. Abra essa pasta no VS Code.
3. Abra **Terminal → Novo Terminal**.
4. Execute:

   ```bash
   npm start
   ```

5. Abra **http://127.0.0.1:3000** no navegador.
6. Para interromper, use `Ctrl + C` no terminal.

> Se `npm` não for reconhecido, instale o Node.js e abra outro terminal.
> Se a porta 3000 estiver ocupada, ajuste a variável de ambiente `PORT` antes de iniciar.

## 4. Criar os dois perfis

### Aluno (pelo site)

1. Clique em **Criar conta**.
2. Preencha nome, e-mail e senha de **10 ou mais caracteres**.
3. A conta será criada com papel `aluno` (automaticamente).
4. Teste a rota administrativa: você receberá **403**, porque o usuário está autenticado, mas não tem permissão.

### Administrador (pelo terminal)

1. Deixe o site aberto e o servidor executando.
2. No VS Code, abra **outro terminal na mesma pasta**.
3. Execute:

   ```bash
   npm run criar-admin
   ```

4. Informe um **nome**, um **e-mail diferente do aluno** e uma **senha com 10 ou mais caracteres**.
5. Atenção: por simplicidade didática, a senha digitada nesse comando aparece no terminal. Utilize uma senha de teste, nunca uma senha pessoal.
6. No site, clique em **Sair da conta** e entre com o e-mail e senha do administrador.
7. A aba **Administração** mostrará a lista de usuários.

**Não permita que usuários escolham o papel `admin` na tela de cadastro.** O servidor sempre define `aluno` no cadastro público, independentemente do que for enviado pelo navegador.

## 5. Roteiro de apresentação (3 a 5 minutos)

| Situação | Rota real | Resultado esperado | Conceito |
|---|---|---|---|
| Visitante acessa recurso público | `GET /api/publico` | **200** | Acesso público |
| Visitante tenta acessar painel | `GET /api/painel` | **401** | Autenticação necessária |
| Aluno autenticado acessa painel | `GET /api/painel` | **200** | Autenticação válida |
| Aluno autenticado tenta acessar administração | `GET /api/admin/usuarios` | **403** | Autorização negada |
| Administrador autenticado acessa administração | `GET /api/admin/usuarios` | **200** | Autorização concedida |
| Usuário sai e tenta acessar painel | `GET /api/painel` | **401** | Sessão encerrada |

Fala sugerida:

> "A autenticação responde: quem é você? O login verifica a identidade do usuário. Já a autorização responde: o que você tem permissão para fazer? Um aluno autenticado entra no próprio painel, mas não na administração. Esse controle é feito no servidor, então esconder um botão não seria suficiente para proteger os dados."

## 6. Estrutura dos arquivos

```text
AcessoLab_TDE/
├── server.js               # Servidor HTTP, sessão e rotas protegidas
├── src/
│   └── users.js            # Contas, papéis e hash de senha com scrypt
├── scripts/
│   └── criar-admin.js      # Cadastro administrativo por terminal
├── public/
│   ├── index.html          # Interface do site
│   ├── styles.css          # Layout e responsividade
│   └── app.js              # Requisições, formulários e resultado HTTP
├── tests/
│   └── acesso.test.js      # Testes de autenticação e autorização
├── data/
│   └── users.json          # Criado automaticamente; não compartilhar
├── package.json
└── README.md
```

### Onde estão os métodos?

- **Autenticação:** `POST /api/login` em `server.js`, com `verifyPassword()` de `src/users.js`.
- **Sessões:** `establishSession()` e `currentSession()` em `server.js`.
- **Autorização:** `requireLogin()` e `requireRole()` em `server.js`.
- **Restrição efetiva:** antes de listar usuários, a rota `GET /api/admin/usuarios` chama `requireRole(req, 'admin')`.
- **Senhas:** `hashPassword()` usa **scrypt** com salt aleatório, nunca senha em texto puro.
- **Cadastro:** `POST /api/cadastro` fixa explicitamente o papel `aluno`.
- **Logout:** `POST /api/logout` invalida a sessão no servidor.

## 7. Executar os testes automáticos

```bash
npm test
```

Os testes verificam permissões, ausência de login, cadastro, sessão, CSRF, impedimento de atribuir administrador via cadastro, logout, login incorreto e privacidade do hash de senha.

## 8. Avisos de segurança

Este é um **projeto didático, para executar localmente**, não uma solução pronta para uso público com dados reais. Ele utiliza hash `scrypt`, cookies `HttpOnly` e `SameSite=Strict`, proteção CSRF, duração limitada de sessão, limite básico de tentativas de login e validação de permissões no servidor.

Antes de publicar um sistema real, implemente banco de dados robusto, armazenamento persistente/compartilhado de sessões, HTTPS com cookie `Secure`, tratamento de logs e backups, testes adicionais de segurança, validação de e-mails e políticas fortes de credenciais. Neste exemplo, os usuários são salvos em `data/users.json` e as sessões ficam apenas na memória (desaparecem quando o servidor reinicia). **Não utilize senhas pessoais reais nos testes.**

## 9. Referências técnicas

- OWASP — [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- OWASP — [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- OWASP — [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- Node.js — [Crypto / scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)

---
**Projeto para fins educacionais.** Desenvolvido com Node.js, HTML, CSS e JavaScript sem bibliotecas externas.
