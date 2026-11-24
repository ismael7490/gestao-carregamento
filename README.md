# Gestão de Carregamento — Produtiva Sementes

App de ordens de carregamento, pátio (fila de caminhões), contratos e cadastros.

- **App:** publicado pelo GitHub Pages a partir deste repositório.
- **Banco de dados:** Supabase (projeto `gestao-carregamento`). As regras de segurança estão em `supabase.sql`.
- **Acesso:** cada pessoa cria a conta com e-mail e senha; um administrador libera na aba Usuários.

`config.js` contém só a chave **pública** (anon) do Supabase, feita para ficar no navegador.
Os dados são protegidos pelas regras do banco (Row Level Security).
