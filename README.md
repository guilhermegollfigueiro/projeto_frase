# Frase do dia

Site com histórico persistente em PostgreSQL. O servidor cria a tabela e a frase inicial automaticamente ao iniciar.

## Rodar localmente

1. Instale Node.js 20 ou mais recente e PostgreSQL.
2. Crie um banco PostgreSQL e copie `.env.example` para `.env`.
3. Configure `DATABASE_URL`, `ADMIN_PASSWORD`, `SITE_PASSWORD` e `SESSION_SECRET` no `.env`.
   `SESSION_SECRET` deve ter pelo menos 32 caracteres aleatórios.
4. Execute `npm install` e `npm start`; o site estará em `http://localhost:3000`.

## Publicar no Render

1. Crie um banco PostgreSQL no Render e um Web Service para este repositório, na mesma região.
2. Configure o comando de build como `npm install` e o comando de inicialização como `npm start`.
3. Cadastre no Web Service as variáveis `DATABASE_URL` (Internal Database URL do PostgreSQL), `ADMIN_PASSWORD`, `SITE_PASSWORD` e `SESSION_SECRET` (um valor aleatório de pelo menos 32 caracteres).
4. Não configure um disco SQLite local: a aplicação usa o PostgreSQL para preservar os dados entre implantações.

A senha configurada em `SITE_PASSWORD` protege as páginas e APIs do site; `ADMIN_PASSWORD` continua protegendo a edição. Mantenha ambas somente nas variáveis de ambiente, nunca no código. Cada login é limitado a cinco tentativas a cada 15 minutos; as sessões expiram após oito horas.

Na tela de edição, use “Adicionar frase antiga ao histórico” para registrar uma frase com sua data original sem alterar a frase atual. O histórico é ordenado pela data informada.

As três frases recuperadas dos arquivos antigos (14, 15 e 16 de novembro de 2026) são importadas automaticamente no primeiro deploy com esta versão. A importação verifica texto e data para não duplicar frases já cadastradas.
