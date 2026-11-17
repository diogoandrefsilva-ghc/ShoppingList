# Compras (ShoppingList) — guia para o assistente

Listas de compras partilhadas lá de casa. **Sem build, sem npm, sem dependências.**
Servida estática no GitHub Pages; backend **Supabase por REST** (schema `shoppinglist`,
no mesmo projeto das outras apps). PWA, sem zoom.

## Ficheiros
- `index.html` — só markup (login, sem-acesso, app, folha genérica).
- `app.js` — toda a lógica, em secções `/* ── TÍTULO ── */`: Utilitários · Supabase ·
  Categorias · Login & acesso · Dados · Render · Artigos · Listas · Folhas · Definições & admin · Arranque.
- `style.css` — todo o CSS; cores em variáveis (`:root`), modo escuro automático.
- `sw.js` — service worker (rede primeiro, cache sem rede). **Sobe `CACHE_VERSION`** quando mudares a app.
- `db/schema.sql` — schema base; `db/categorias.sql` — categorias de artigos; `db/catalogo.sql` — artigos conhecidos. Idempotentes e
  **sem DROP/DELETE/REVOKE** (o Supabase não deixa passar migrações destrutivas).

## Modelo
- `listas`: a da **Casa** (`fixa=true`, sempre aberta, não se apaga) e as de **ocasião**
  (jantar, festa…), que se concluem (`concluida_em`) e ficam no histórico das Definições.
  Todas as abertas aparecem ao mesmo tempo no ecrã "Tudo"; os chips filtram por lista.
- `artigos`: `nome`, `qtd` (texto livre), `tratado`. Quem criou / quem tratou é carimbado
  por trigger no servidor (`artigos_carimbo`), nunca pelo cliente.
- `categorias` / `artigo_categorias`: dicionário e memória artigo→categoria, copiados do
  FestasBV (cópia, não ligação) + categorias de casa. A categoria **não vive no artigo**:
  lê-se da memória pelo nome normalizado (`artKey`) a cada render (`catDe`), com palpite
  pelo singular / primeira palavra quando o nome ainda não é conhecido. Muda-se no ⋮ do
  artigo (qualquer pessoa); o dicionário gere-o o admin nas Definições.
- `catalogo`: artigos conhecidos (nome com acentos, chave `artKey`) para a folha **Adicionar
  artigos** (botão de grelha na barra): tocar só escolhe (`_catSel`), o botão do fundo adiciona
  os escolhidos de uma vez; fechar a folha desiste. Cresce sozinho com
  o que se escreve (`registarNoCatalogo`); o modo "Tirar artigos desta folha" apaga do catálogo.
  Não há `<datalist>` de sugestões de propósito — no iOS abria um balão a cada artigo.
- **Símbolo do artigo** (`artEmoji`): um emoji escolhido à mão no ⋮ do artigo (`catalogo.emoji`),
  senão o primeiro padrão de `ART_ICO` que bater no nome (específico antes do genérico; corre
  sobre o `artKey`, sem acentos), senão o da categoria. Aparece nas linhas das listas e nos
  mosaicos do catálogo. Artigo novo sem símbolo certo → acrescenta um padrão ao `ART_ICO`.
- `perfis`: email → nome que aparece ao lado dos artigos.
- `allowed_users` / `access_requests`: acesso como nas outras apps; o admin aprova nas Definições.
- RLS: quem está em `allowed_users` vê e edita tudo (a casa é partilhada).

## Notas
- Escritas são otimistas (o ecrã muda logo, desfaz se o servidor recusar); há refresco
  a cada 15 s e ao voltar à app, que espera pelas escritas em curso (`_escritas`).
- Tudo o que vem do utilizador passa por `esc()` antes de ir para `innerHTML`.
