# Compras (ShoppingList) — guia para o assistente

Listas de compras partilhadas lá de casa. **Sem build, sem npm, sem dependências.**
Servida estática no GitHub Pages; backend **Supabase por REST** (schema `shoppinglist`,
no mesmo projeto das outras apps). PWA, sem zoom.

## Ficheiros
- `index.html` — só markup (login, sem-acesso, app, folha genérica).
- `app.js` — toda a lógica, em secções `/* ── TÍTULO ── */`: Utilitários · Supabase ·
  Login & acesso · Dados · Render · Artigos · Listas · Folhas · Definições & admin · Arranque.
- `style.css` — todo o CSS; cores em variáveis (`:root`), modo escuro automático.
- `sw.js` — service worker (rede primeiro, cache sem rede). **Sobe `CACHE_VERSION`** quando mudares a app.
- `db/schema.sql` — schema completo, idempotente, para o SQL Editor do Supabase.

## Modelo
- `listas`: a da **Casa** (`fixa=true`, sempre aberta, não se apaga) e as de **ocasião**
  (jantar, festa…), que se concluem (`concluida_em`) e ficam no histórico das Definições.
  Todas as abertas aparecem ao mesmo tempo no ecrã "Tudo"; os chips filtram por lista.
- `artigos`: `nome`, `qtd` (texto livre), `tratado`. Quem criou / quem tratou é carimbado
  por trigger no servidor (`artigos_carimbo`), nunca pelo cliente.
- `perfis`: email → nome que aparece ao lado dos artigos.
- `allowed_users` / `access_requests`: acesso como nas outras apps; o admin aprova nas Definições.
- RLS: quem está em `allowed_users` vê e edita tudo (a casa é partilhada).

## Notas
- Escritas são otimistas (o ecrã muda logo, desfaz se o servidor recusar); há refresco
  a cada 15 s e ao voltar à app, que espera pelas escritas em curso (`_escritas`).
- Tudo o que vem do utilizador passa por `esc()` antes de ir para `innerHTML`.
