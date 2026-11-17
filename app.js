/* ═══════════════════════════════════════════════════════════════════
   Compras — listas de compras partilhadas lá de casa.
   Sem build, sem dependências. Supabase por REST (schema `shoppinglist`).
   Secções: Utilitários · Supabase (sessão, fetch) · Login & acesso ·
   Categorias · Dados (carregar, refresco) · Render · Artigos · Catálogo · Listas · Folhas ·
   Definições & admin · Arranque
   ═══════════════════════════════════════════════════════════════════ */

const SB_URL = 'https://gjweqwfbnkgnibhajldc.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdqd2Vxd2ZibmtnbmliaGFqbGRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDk4NzUsImV4cCI6MjA5NjY4NTg3NX0.h6st-RayGhQdsqH7E2Ko-rPWk2QZUpTevO6cbjvlSnk';
const SCHEMA = 'shoppinglist';
const ADMIN_EMAIL = 'diogo.andre.f.silva@gmail.com';
const SESSION_KEY = 'compras_session';
const CACHE_KEY = 'compras_dados';
const REFRESCO_MS = 15000;
const EMOJIS = ['🛒', '🍽️', '🎉', '🎂', '🍷', '🥩', '🏖️', '🎄', '🧺', '🧹', '🐶', '💊'];

const estado = {
    listas: [],        // todas (abertas e concluídas)
    artigos: [],
    perfis: {},        // email → nome
    filtro: 'tudo',    // 'tudo' ou id da lista
    destino: null,     // id da lista onde a barra de adicionar escreve
    tratadosAbertos: {},  // id da lista → mostrar os tratados
    pedidos: [],       // pedidos de acesso (só admin)
    categorias: [],    // dicionário [{id,nome}], por ordem alfabética
    artCats: {},       // memória artigo→categoria: artKey(nome) → id da categoria
    catalogo: [],      // artigos conhecidos [{artigo_key,nome}] — a folha "Adicionar artigos"
};

/* ── UTILITÁRIOS ─────────────────────────────── */
const $ = (id) => document.getElementById(id);
function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
let _toastT = null;
function toast(msg, erro) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('erro', !!erro);
    t.hidden = false;
    clearTimeout(_toastT);
    _toastT = setTimeout(() => { t.hidden = true; }, erro ? 4200 : 2200);
}
function nomeDe(email) {
    if (!email) return '';
    const e = String(email).toLowerCase();
    if (estado.perfis[e]) return estado.perfis[e];
    const p = e.split('@')[0].split(/[._-]/)[0] || e;
    return p.charAt(0).toUpperCase() + p.slice(1);
}
function dataCurta(iso) {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
}
// "2 leite", "500g fiambre", "leite x2" → { nome, qtd }
function separarQtd(texto) {
    let t = texto.trim().replace(/\s+/g, ' ');
    let m = t.match(/^(\d+(?:[.,]\d+)?\s?(?:kg|g|gr|l|lt|ml|cl|dl|un|uds?|x|pacotes?|latas?|garrafas?|cx|caixas?|dz|dúzias?)?)\s+(.+)$/i);
    if (m && /[a-zà-ú]/i.test(m[2])) return { nome: m[2], qtd: m[1].replace(/x$/i, '').trim() };
    m = t.match(/^(.+?)\s+x\s?(\d+)$/i);
    if (m) return { nome: m[1], qtd: m[2] };
    return { nome: t, qtd: null };
}
function maiuscula(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* ── CATEGORIAS DE ARTIGOS ───────────────────── */
// Como no FestasBV: um dicionário (estado.categorias) e uma memória
// artigo→categoria (estado.artCats) com chave = nome normalizado. A categoria
// NÃO se guarda no artigo: lê-se da memória a cada render, por isso classificar
// "Leite" uma vez vale para todas as listas, de agora em diante.
function artKey(s) { return (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' '); }
function singular(p) { return p.length > 3 ? p.replace(/(oes|aes)$/, 'ao').replace(/s$/, '') : p; }
function catPorId(id) { return estado.categorias.find((c) => c.id === id) || null; }
function catEmoji(nome) {
    const k = artKey(nome);
    const MAPA = [[/(nao alcool|sumo|refriger|agua)/, '🥤'], [/(branca|espirituos|whisky|gin|licor)/, '🥃'], [/(cerveja|sidra|vinho)/, '🍺'],
        [/churrasc/, '🔥'], [/(utensilios cozinha)/, '🔪'], [/(refeicao|descart)/, '🍽️'], [/(talho|carne)/, '🥩'], [/(peix|marisc)/, '🐟'],
        [/charcut/, '🥓'], [/(latic|leite)/, '🥛'], [/(padaria|pao)/, '🥖'], [/fruta/, '🍎'], [/(legume|vegeta)/, '🥕'],
        [/(molho|tempero)/, '🧂'], [/conserva/, '🥫'], [/(acompanh|batata|snack)/, '🍚'], [/(sobremesa|doce)/, '🍰'],
        [/(entrada|petisco|queijo)/, '🧀'], [/cafe/, '☕'], [/congelad/, '🧊'], [/mercearia/, '🥣'], [/higiene/, '🧴'],
        [/limpeza/, '🧽'], [/(bricolagem|obra|ferrament)/, '🛠️'], [/(animal|animais)/, '🐾'], [/(farmacia|saude)/, '💊'], [/bebe/, '🍼']];
    for (const [re, e] of MAPA) if (re.test(k)) return e;
    return '🏷️';
}
// Índices para adivinhar a categoria de um artigo que ainda não está na memória:
// pelo nome no singular ("cebola" ↔ "cebolas") e, à falta disso, pela primeira
// palavra ("batata doce" → onde está a maioria das "batata …").
let _catIdx = null;
function catIndices() {
    if (_catIdx) return _catIdx;
    const sing = {}, prim = {};
    Object.keys(estado.artCats).forEach((k) => {
        const cid = estado.artCats[k], pal = k.split(' ').map(singular);
        if (!(pal.join(' ') in sing)) sing[pal.join(' ')] = cid;
        if (pal[0].length >= 3) { (prim[pal[0]] = prim[pal[0]] || {})[cid] = (prim[pal[0]][cid] || 0) + 1; }
    });
    return (_catIdx = { sing, prim });
}
// → { cat, certa }: certa=false quando é um palpite (ainda não está na memória)
function catDe(nome) {
    const k = artKey(nome);
    if (!k || !estado.categorias.length) return { cat: null, certa: false };
    if (estado.artCats[k] != null) return { cat: catPorId(estado.artCats[k]), certa: true };
    const { sing, prim } = catIndices();
    const pal = k.split(' ').map(singular);
    let cid = sing[pal.join(' ')];
    if (cid == null && prim[pal[0]]) cid = Number(Object.keys(prim[pal[0]]).sort((a, b) => prim[pal[0]][b] - prim[pal[0]][a])[0]);
    return { cat: cid != null ? catPorId(cid) : null, certa: false };
}
async function definirCategoria(nome, catId) {
    const k = artKey(nome);
    if (!k) return;
    const antes = estado.artCats[k];
    if ((antes == null ? null : antes) === (catId || null)) return;
    if (catId) estado.artCats[k] = catId; else delete estado.artCats[k];
    _catIdx = null;
    try {
        if (catId) await api('artigo_categorias?on_conflict=artigo_key', { method: 'POST', body: { artigo_key: k, categoria_id: catId, origem: 'manual', atualizado_em: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=minimal' });
        else await api(`artigo_categorias?artigo_key=eq.${encodeURIComponent(k)}`, { method: 'DELETE', prefer: 'return=minimal' });
        guardarCache();
    } catch (e) {
        if (antes == null) delete estado.artCats[k]; else estado.artCats[k] = antes;
        _catIdx = null;
        toast('Categoria não guardada: ' + e.message, true);
    }
}

/* ── SUPABASE: sessão e fetch ────────────────── */
let _sessao = null;
let _refreshing = null;
let _escritas = 0;   // escritas em curso — o refresco em segundo plano espera por elas

function guardarSessao(s) {
    _sessao = s;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
}
function tokenQuaseExpirado() {
    if (!_sessao) return false;
    if (!_sessao.expires_at) return true;
    return (_sessao.expires_at - Date.now() / 1000) < 120;
}
async function sbRefresh() {
    if (!_sessao || !_sessao.refresh_token) return false;
    if (_refreshing) return _refreshing;   // o refresh_token é de uso único
    _refreshing = (async () => {
        try {
            const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: _sessao.refresh_token })
            });
            if (!r.ok) return false;
            const d = await r.json();
            guardarSessao({
                access_token: d.access_token,
                refresh_token: d.refresh_token || _sessao.refresh_token,
                expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
                user: d.user || _sessao.user
            });
            return true;
        } catch (e) { return false; }
    })();
    const ok = await _refreshing;
    _refreshing = null;
    return ok;
}
async function sbEnsureFresh() {
    if (_sessao && _sessao.refresh_token && tokenQuaseExpirado()) await sbRefresh();
}
// REST do PostgREST. Devolve o JSON (ou null); lança Error com mensagem legível.
async function api(caminho, opt) {
    opt = opt || {};
    const metodo = (opt.method || 'GET').toUpperCase();
    const escrita = metodo !== 'GET';
    if (escrita) _escritas++;
    try {
        await sbEnsureFresh();
        const cab = () => {
            const h = {
                'apikey': SB_KEY,
                'Authorization': `Bearer ${_sessao ? _sessao.access_token : SB_KEY}`,
                'Accept': 'application/json',
                'Accept-Profile': SCHEMA,
                'Content-Profile': SCHEMA,
            };
            if (opt.body !== undefined) h['Content-Type'] = 'application/json';
            if (opt.prefer) h['Prefer'] = opt.prefer;
            return h;
        };
        const pedido = () => fetch(`${SB_URL}/rest/v1/${caminho}`, {
            method: metodo,
            headers: cab(),
            body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined,
            cache: 'no-store',
        });
        let r = await pedido();
        if (r.status === 401 && _sessao && _sessao.refresh_token && await sbRefresh()) r = await pedido();
        const txt = await r.text();
        let j = null;
        try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
        if (!r.ok) {
            const err = new Error((j && (j.message || j.msg)) || `HTTP ${r.status}`);
            err.status = r.status;
            throw err;
        }
        return j;
    } finally {
        if (escrita) _escritas--;
    }
}
function emailAtual() {
    return (_sessao && _sessao.user && _sessao.user.email) ? _sessao.user.email.toLowerCase() : null;
}
function isAdmin() { return emailAtual() === ADMIN_EMAIL; }

setInterval(sbEnsureFresh, 10 * 60 * 1000);

/* ── LOGIN & ACESSO ──────────────────────────── */
function esconderSplash() {
    const s = $('splash');
    if (!s || s.hidden) return;
    s.classList.add('sair');
    setTimeout(() => { s.hidden = true; }, 280);
}
function mostrarEcra(id) {
    ['page-login', 'page-sem-acesso', 'app'].forEach((e) => { $(e).hidden = e !== id; });
    esconderSplash();
}
function estadoLogin(msg, tipo) {
    const s = $('login-status');
    s.hidden = !msg;
    s.textContent = msg || '';
    s.className = 'estado' + (tipo ? ' ' + tipo : '');
}

function loginGoogle() {
    const volta = window.location.href.split('#')[0].split('?')[0];
    window.location.href = `${SB_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(volta)}`;
}
async function loginEmail() {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    if (!email || !password) return;
    estadoLogin('A entrar…');
    try {
        const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST', headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const d = await r.json();
        if (!r.ok) { estadoLogin(d.error_description || d.msg || 'Email ou password errados.', 'erro'); return; }
        guardarSessao({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), user: d.user });
        estadoLogin('');
        await aposLogin();
    } catch (e) { estadoLogin('Erro de ligação.', 'erro'); }
}
async function registarEmail() {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    if (!email || password.length < 6) { estadoLogin('Escreve o email e uma password com 6 ou mais caracteres.', 'erro'); return; }
    estadoLogin('A criar conta…');
    try {
        const r = await fetch(`${SB_URL}/auth/v1/signup`, {
            method: 'POST', headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const d = await r.json();
        if (!r.ok) { estadoLogin(d.error_description || d.msg || 'Erro ao criar conta.', 'erro'); return; }
        if (d.access_token) {   // projeto sem confirmação de email: entra logo
            guardarSessao({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), user: d.user });
            estadoLogin('');
            await aposLogin();
            return;
        }
        estadoLogin('Conta criada! Confirma o email e volta a entrar.', 'ok');
    } catch (e) { estadoLogin('Erro de ligação.', 'erro'); }
}
function logout() {
    try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(CACHE_KEY); } catch (e) {}
    _sessao = null;
    window.location.reload();
}

async function obterUser(token) {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${token}` } });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return r.json();
}

async function iniciar() {
    // Regresso do login com Google
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
        const p = new URLSearchParams(hash.substring(1));
        const access_token = p.get('access_token');
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
            const u = await obterUser(access_token);
            guardarSessao({
                access_token,
                refresh_token: p.get('refresh_token'),
                expires_at: parseInt(p.get('expires_at')) || Math.floor(Date.now() / 1000) + (parseInt(p.get('expires_in')) || 3600),
                user: u
            });
            await aposLogin();
            return;
        } catch (e) { /* cai para a sessão guardada / login */ }
    }

    let guardada = null;
    try { guardada = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) {}
    if (guardada && guardada.access_token) {
        _sessao = guardada;
        // Sem rede: mostra o que ficou em cache em vez de pedir login outra vez.
        if (!navigator.onLine && carregarCache()) { mostrarEcra('app'); render(); return; }
        try {
            if (tokenQuaseExpirado()) await sbRefresh();
            let u;
            try { u = await obterUser(_sessao.access_token); }
            catch (e) {
                if (e.status && await sbRefresh()) u = await obterUser(_sessao.access_token);
                else throw e;
            }
            guardarSessao({ ..._sessao, user: u });
            await aposLogin();
            return;
        } catch (e) {
            if (!e.status && carregarCache()) {   // falha de rede, não de sessão
                mostrarEcra('app'); render(); return;
            }
            _sessao = null;
            try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
        }
    }
    mostrarEcra('page-login');
}

async function aposLogin() {
    const email = emailAtual();
    let acesso = null, detalhe = '';
    try {
        acesso = await api(`allowed_users?email=ilike.${encodeURIComponent(email)}&select=email`);
    } catch (e) { detalhe = e.message; }

    if (!Array.isArray(acesso) || acesso.length === 0) {
        $('sem-acesso-email').textContent = `Sessão iniciada como ${email}. Esta conta ainda não tem acesso à app.` + (detalhe ? ` (${detalhe})` : '');
        mostrarEcra('page-sem-acesso');
        return;
    }

    carregarCache();
    mostrarEcra('app');
    render();
    await carregarDados();
    garantirPerfil();
    if (isAdmin()) carregarPedidos();
}

async function solicitarAcesso() {
    const btn = $('btn-solicitar'), st = $('solicitar-status');
    btn.disabled = true;
    try {
        await api('access_requests', { method: 'POST', body: { email: emailAtual() }, prefer: 'return=minimal' });
        st.textContent = '✓ Pedido enviado! Aguarda aprovação.';
    } catch (e) {
        if (e.status !== 409) {
            st.hidden = false; st.className = 'estado erro';
            st.textContent = 'Erro ao enviar o pedido: ' + e.message;
            btn.disabled = false;
            return;
        }
        st.textContent = '✓ O pedido já estava registado. Aguarda aprovação.';
    }
    st.hidden = false; st.className = 'estado ok';
    btn.hidden = true;
    $('btn-verificar').hidden = false;
}
async function verificarAcesso() {
    const btn = $('btn-verificar'), st = $('solicitar-status');
    btn.disabled = true;
    await aposLogin();
    btn.disabled = false;
    if (!$('page-sem-acesso').hidden) {
        st.hidden = false; st.className = 'estado';
        st.textContent = 'Acesso ainda não aprovado. Tenta mais tarde.';
    }
}

/* ── DADOS ───────────────────────────────────── */
function guardarCache() {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            listas: estado.listas, artigos: estado.artigos.filter((a) => a.id > 0), perfis: estado.perfis,
            destino: estado.destino, filtro: estado.filtro, categorias: estado.categorias, artCats: estado.artCats, catalogo: estado.catalogo
        }));
    } catch (e) {}
}
function carregarCache() {
    try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (!c || !Array.isArray(c.listas)) return false;
        estado.listas = c.listas; estado.artigos = c.artigos || []; estado.perfis = c.perfis || {};
        estado.destino = c.destino || null; estado.filtro = c.filtro || 'tudo';
        estado.categorias = c.categorias || []; estado.artCats = c.artCats || {}; estado.catalogo = c.catalogo || []; _catIdx = null;
        return true;
    } catch (e) { return false; }
}
function sinalSync(txt) { $('sync').textContent = txt || ''; }

let _aCarregar = false;
async function carregarDados(silencioso) {
    if (_aCarregar) return;
    _aCarregar = true;
    try {
        // As categorias são tolerantes: se falharem, a lista aparece na mesma (sem grupos).
        const [listas, artigos, perfis, cats, artCats, catalogo] = await Promise.all([
            api('listas?select=*&order=fixa.desc,criado_em.asc'),
            api('artigos?select=*&order=criado_em.asc'),
            api('perfis?select=email,nome'),
            api('categorias?select=id,nome').catch(() => null),
            api('artigo_categorias?select=artigo_key,categoria_id&limit=5000').catch(() => null),
            api('catalogo?select=artigo_key,nome&limit=5000').catch(() => null),
        ]);
        // Uma escrita que começou entretanto ganha: o que veio do servidor é de antes dela.
        if (_escritas > 0) return;
        estado.listas = listas || [];
        estado.artigos = artigos || [];
        estado.perfis = {};
        (perfis || []).forEach((p) => { estado.perfis[p.email.toLowerCase()] = p.nome; });
        if (cats && artCats) {
            estado.categorias = cats.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
            estado.artCats = {};
            artCats.forEach((r) => { estado.artCats[r.artigo_key] = r.categoria_id; });
            _catIdx = null;
        }
        if (catalogo) estado.catalogo = catalogo;
        sinalSync('');
        guardarCache();
        render();
        if (_catAberto) renderCatalogo();
    } catch (e) {
        sinalSync('sem ligação');
        if (!silencioso) toast('Não foi possível carregar: ' + e.message, true);
    } finally {
        _aCarregar = false;
    }
}
function refrescoTick() {
    if (document.hidden || $('app').hidden || _escritas > 0) return;
    // A meio de editar numa folha não se redesenha por baixo
    carregarDados(true);
}
setInterval(refrescoTick, REFRESCO_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { sbEnsureFresh(); refrescoTick(); } });
window.addEventListener('online', refrescoTick);

async function garantirPerfil() {
    const email = emailAtual();
    if (!email || estado.perfis[email]) return;
    const meta = (_sessao.user && _sessao.user.user_metadata) || {};
    const nome = ((meta.full_name || meta.name || '').trim().split(/\s+/)[0] || nomeDe(email)).slice(0, 40);
    try {
        await api('perfis', { method: 'POST', body: { email, nome }, prefer: 'resolution=ignore-duplicates,return=minimal' });
        estado.perfis[email] = nome;
        render();
    } catch (e) { /* fica o nome tirado do email */ }
}

/* ── RENDER ──────────────────────────────────── */
function listasAbertas() { return estado.listas.filter((l) => !l.concluida_em); }
function listasConcluidas() {
    return estado.listas.filter((l) => l.concluida_em).sort((a, b) => (a.concluida_em < b.concluida_em ? 1 : -1));
}
function artigosDe(listaId) { return estado.artigos.filter((a) => a.lista_id === listaId); }
function listaPorId(id) { return estado.listas.find((l) => l.id === id); }
function corDe(lista) {
    if (lista.fixa) return 'c0';
    return 'c' + (1 + (Math.abs(lista.id) % 5));
}
function destinoAtual() {
    const abertas = listasAbertas();
    if (!abertas.length) return null;
    if (estado.filtro !== 'tudo') {
        const f = abertas.find((l) => l.id === estado.filtro);
        if (f) return f;
    }
    return abertas.find((l) => l.id === estado.destino) || abertas.find((l) => l.fixa) || abertas[0];
}

function render() {
    const abertas = listasAbertas();
    if (estado.filtro !== 'tudo' && !abertas.some((l) => l.id === estado.filtro)) estado.filtro = 'tudo';

    // Chips
    const totalFalta = abertas.reduce((n, l) => n + artigosDe(l.id).filter((a) => !a.tratado).length, 0);
    let c = `<button class="chip ${estado.filtro === 'tudo' ? 'ativo' : ''}" onclick="filtrar('tudo')">Tudo${totalFalta ? `<b>${totalFalta}</b>` : ''}</button>`;
    abertas.forEach((l) => {
        const n = artigosDe(l.id).filter((a) => !a.tratado).length;
        c += `<button class="chip ${corDe(l)} ${estado.filtro === l.id ? 'ativo' : ''}" onclick="filtrar(${l.id})"><span class="chip-e">${esc(l.emoji)}</span>${esc(l.nome)}${n ? `<b>${n}</b>` : ''}</button>`;
    });
    c += `<button class="chip chip-nova" onclick="abrirNovaLista()">+ Nova lista</button>`;
    $('chips').innerHTML = c;

    // Secções
    const visiveis = estado.filtro === 'tudo' ? abertas : abertas.filter((l) => l.id === estado.filtro);
    $('conteudo').innerHTML = visiveis.map(renderLista).join('') ||
        '<p class="vazio-geral">Ainda não há listas. Assim que a base de dados estiver pronta, a lista da Casa aparece aqui.</p>';

    // Barra de adicionar
    const d = destinoAtual();
    const bd = $('add-destino');
    if (d) {
        bd.className = 'add-destino ' + corDe(d);
        bd.innerHTML = `<span>${esc(d.emoji)}</span>`;
        bd.title = d.nome;
        $('add-nome').placeholder = `Adicionar a ${d.nome}…`;
    }
    $('barra-add').hidden = !d;

    const bp = $('badge-pedidos');
    bp.hidden = !estado.pedidos.length;
    bp.textContent = estado.pedidos.length || '';
}

function renderLista(l) {
    const arts = artigosDe(l.id);
    const falta = arts.filter((a) => !a.tratado);
    const tratados = arts.filter((a) => a.tratado).sort((a, b) => ((a.tratado_em || '') < (b.tratado_em || '') ? 1 : -1));
    const aberto = !!estado.tratadosAbertos[l.id];
    const sub = [];
    if (l.data) sub.push(dataCurta(l.data));
    sub.push(falta.length ? `${falta.length} por tratar` : (arts.length ? 'tudo tratado' : 'vazia'));

    let h = `<section class="lista ${corDe(l)}" id="lista-${l.id}">
        <div class="lista-topo">
            <span class="lista-emoji">${esc(l.emoji)}</span>
            <div class="lista-tit"><h2>${esc(l.nome)}</h2><p>${esc(sub.join(' · '))}</p></div>
            <button class="icone-btn" onclick="abrirMenuLista(${l.id})" aria-label="Opções da lista ${esc(l.nome)}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
        </div>`;

    if (!arts.length) {
        h += `<p class="lista-vazia">${l.fixa ? 'Não falta nada em casa. Quando faltar, escreve em baixo.' : 'Lista vazia. Escreve em baixo o que é preciso comprar.'}</p>`;
    } else {
        h += `<ul class="artigos">${renderPorCategoria(falta)}</ul>`;
        if (!falta.length && !l.fixa) {
            h += `<div class="tudo-ok"><span>Está tudo comprado 🎉</span><button class="btn-mini" onclick="concluirLista(${l.id})">Concluir lista</button></div>`;
        } else if (!falta.length) {
            h += `<p class="lista-vazia">Tudo tratado 🎉</p>`;
        }
    }
    if (tratados.length) {
        h += `<div class="tratados-topo">
                <button class="tratados-btn" onclick="alternarTratados(${l.id})" aria-expanded="${aberto}">
                    <svg class="seta ${aberto ? 'aberta' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                    Tratados (${tratados.length})
                </button>
                ${aberto ? `<button class="btn-mini discreto" onclick="limparTratados(${l.id})">Limpar</button>` : ''}
              </div>`;
        if (aberto) h += `<ul class="artigos tratados">${tratados.map(renderArtigo).join('')}</ul>`;
    }
    return h + '</section>';
}

// Por tratar, agrupados por categoria (ordem alfabética; sem categoria no fim).
// Sem nenhum artigo classificado não há cabeçalhos: fica a lista simples.
function renderPorCategoria(arts) {
    const grupos = new Map();
    arts.forEach((a) => {
        const c = catDe(a.nome).cat;
        const k = c ? c.id : 0;
        if (!grupos.has(k)) grupos.set(k, { cat: c, arts: [] });
        grupos.get(k).arts.push(a);
    });
    if (grupos.size === 1 && grupos.has(0)) return arts.map(renderArtigo).join('');
    return [...grupos.values()]
        .sort((x, y) => (!x.cat) - (!y.cat) || (x.cat && y.cat ? x.cat.nome.localeCompare(y.cat.nome, 'pt') : 0))
        .map((g) => `<li class="grupo"><span>${g.cat ? catEmoji(g.cat.nome) : '📦'}</span>${esc(g.cat ? g.cat.nome : 'Sem categoria')}</li>` + g.arts.map(renderArtigo).join(''))
        .join('');
}

function renderArtigo(a) {
    const quem = a.tratado
        ? (a.tratado_por ? `tratado por ${nomeDe(a.tratado_por)}` : 'tratado')
        : nomeDe(a.criado_por);
    return `<li class="artigo ${a.tratado ? 'feito' : ''} ${a.id < 0 ? 'pendente' : ''}">
        <button class="art-check" onclick="alternarTratado(${a.id})" aria-label="${a.tratado ? 'Voltar a pôr na lista' : 'Marcar como tratado'}: ${esc(a.nome)}">
            <span class="bola"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
            <span class="art-txt"><span class="art-nome">${esc(a.nome)}</span><span class="art-quem">${esc(quem)}</span></span>
        </button>
        ${a.qtd ? `<span class="art-qtd">${esc(a.qtd)}</span>` : ''}
        <button class="art-mais" onclick="abrirArtigo(${a.id})" aria-label="Editar ${esc(a.nome)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
        </button>
    </li>`;
}

function filtrar(f) {
    estado.filtro = f;
    if (f !== 'tudo') estado.destino = f;
    guardarCache();
    render();
    window.scrollTo(0, 0);
}
function alternarTratados(id) {
    estado.tratadosAbertos[id] = !estado.tratadosAbertos[id];
    render();
}

/* ── ARTIGOS ─────────────────────────────────── */
let _tempId = -1;

async function adicionarDaBarra() {
    const inp = $('add-nome');
    const txt = inp.value.trim();
    const lista = destinoAtual();
    if (!lista) return;
    if (!txt) { abrirCatalogo(); return; }
    inp.value = '';
    inp.focus();
    const { nome, qtd } = separarQtd(txt);
    await adicionarArtigo(lista.id, maiuscula(nome).slice(0, 120), qtd ? qtd.slice(0, 30) : null);
}

async function adicionarArtigo(listaId, nome, qtd) {
    // Já está por tratar nesta lista? Não duplica — avisa.
    const igual = estado.artigos.find((a) => a.lista_id === listaId && !a.tratado && a.nome.toLowerCase() === nome.toLowerCase());
    if (igual) { toast(`"${igual.nome}" já está na lista.`); return; }

    // Estava tratado? Volta para a lista em vez de criar outro.
    const antigo = estado.artigos.find((a) => a.lista_id === listaId && a.tratado && a.id > 0 && a.nome.toLowerCase() === nome.toLowerCase());
    if (antigo) {
        const antes = { ...antigo };
        Object.assign(antigo, { tratado: false, tratado_por: null, tratado_em: null, qtd: qtd || null });
        render();
        try {
            const r = await api(`artigos?id=eq.${antigo.id}`, { method: 'PATCH', body: { tratado: false, qtd: qtd || null }, prefer: 'return=representation' });
            if (r && r[0]) Object.assign(antigo, r[0]);
            guardarCache();
        } catch (e) { Object.assign(antigo, antes); render(); toast('Não ficou gravado: ' + e.message, true); }
        return;
    }

    const temp = {
        id: _tempId--, lista_id: listaId, nome, qtd: qtd || null, criado_por: emailAtual(),
        criado_em: new Date().toISOString(), tratado: false, tratado_por: null, tratado_em: null
    };
    estado.artigos.push(temp);
    render();
    try {
        const r = await api('artigos', { method: 'POST', body: { lista_id: listaId, nome, qtd: qtd || null }, prefer: 'return=representation' });
        Object.assign(temp, r[0]);
        registarNoCatalogo(nome);
        guardarCache();
        render();
    } catch (e) {
        estado.artigos = estado.artigos.filter((a) => a !== temp);
        render();
        toast('Não ficou gravado: ' + e.message, true);
    }
}

async function alternarTratado(id) {
    const a = estado.artigos.find((x) => x.id === id);
    if (!a) return;
    if (a.id < 0) { toast('Ainda a gravar… tenta daqui a um segundo.'); return; }
    const antes = { ...a };
    a.tratado = !a.tratado;
    a.tratado_por = a.tratado ? emailAtual() : null;
    a.tratado_em = a.tratado ? new Date().toISOString() : null;
    render();
    try {
        const r = await api(`artigos?id=eq.${a.id}`, { method: 'PATCH', body: { tratado: a.tratado }, prefer: 'return=representation' });
        if (!r || !r.length) throw new Error('o artigo já não existe');
        Object.assign(a, r[0]);
        guardarCache();
    } catch (e) {
        Object.assign(a, antes);
        render();
        toast('Não ficou gravado: ' + e.message, true);
        carregarDados(true);
    }
}

function abrirArtigo(id) {
    const a = estado.artigos.find((x) => x.id === id);
    if (!a || a.id < 0) return;
    const outras = listasAbertas();
    const { cat, certa } = catDe(a.nome);
    abrirFolha('Artigo', `
        <form onsubmit="guardarArtigo(${a.id}); return false;">
            <label class="rotulo" for="ea-nome">Nome</label>
            <input id="ea-nome" class="campo" type="text" maxlength="120" value="${esc(a.nome)}" required autocomplete="off">
            <label class="rotulo" for="ea-qtd">Quantidade <span>(opcional)</span></label>
            <input id="ea-qtd" class="campo" type="text" maxlength="30" value="${esc(a.qtd || '')}" placeholder="ex.: 2, 500 g, 1 pacote" autocomplete="off">
            ${estado.categorias.length ? `<label class="rotulo" for="ea-cat">Categoria ${cat && !certa ? '<span>(palpite — guarda para confirmar)</span>' : ''}</label>
            <select id="ea-cat" class="campo">
                <option value="">— sem categoria —</option>
                ${estado.categorias.map((c) => `<option value="${c.id}" ${cat && cat.id === c.id ? 'selected' : ''}>${catEmoji(c.nome)} ${esc(c.nome)}</option>`).join('')}
            </select>` : ''}
            <label class="rotulo" for="ea-lista">Lista</label>
            <select id="ea-lista" class="campo">
                ${outras.map((l) => `<option value="${l.id}" ${l.id === a.lista_id ? 'selected' : ''}>${esc(l.emoji)} ${esc(l.nome)}</option>`).join('')}
            </select>
            <p class="nota">Adicionado por ${esc(nomeDe(a.criado_por))}${a.criado_em ? ' · ' + esc(dataCurta(a.criado_em)) : ''}${a.tratado && a.tratado_por ? `<br>Tratado por ${esc(nomeDe(a.tratado_por))}${a.tratado_em ? ' · ' + esc(dataCurta(a.tratado_em)) : ''}` : ''}</p>
            <button class="btn btn-primario" type="submit">Guardar</button>
        </form>
        <button class="btn btn-perigo" onclick="apagarArtigo(${a.id})">Apagar artigo</button>`);
}
async function guardarArtigo(id) {
    const a = estado.artigos.find((x) => x.id === id);
    if (!a) return fecharFolha();
    const nome = $('ea-nome').value.trim();
    if (!nome) return;
    const corpo = { nome, qtd: $('ea-qtd').value.trim() || null, lista_id: Number($('ea-lista').value) };
    const sc = $('ea-cat');
    const catId = sc ? (Number(sc.value) || null) : undefined;
    const antes = { ...a };
    Object.assign(a, corpo);
    fecharFolha();
    // A categoria fica na memória pelo nome (novo, se mudou): vale para todas as listas.
    if (catId !== undefined) definirCategoria(nome, catId);
    render();
    try {
        await api(`artigos?id=eq.${id}`, { method: 'PATCH', body: corpo, prefer: 'return=minimal' });
        guardarCache();
    } catch (e) { Object.assign(a, antes); render(); toast('Não ficou gravado: ' + e.message, true); }
}
async function apagarArtigo(id) {
    const antes = estado.artigos.slice();
    estado.artigos = estado.artigos.filter((x) => x.id !== id);
    fecharFolha();
    render();
    try {
        await api(`artigos?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
        guardarCache();
    } catch (e) { estado.artigos = antes; render(); toast('Não foi apagado: ' + e.message, true); }
}
async function limparTratados(listaId) {
    const l = listaPorId(listaId);
    const n = artigosDe(listaId).filter((a) => a.tratado).length;
    if (!l || !n) return;
    if (!await confirmar(`Limpar os ${n} tratados de "${l.nome}"?`, 'Saem da lista de vez. Os que ainda faltam ficam.', 'Limpar')) return;
    const antes = estado.artigos.slice();
    estado.artigos = estado.artigos.filter((a) => !(a.lista_id === listaId && a.tratado));
    render();
    try {
        await api(`artigos?lista_id=eq.${listaId}&tratado=is.true`, { method: 'DELETE', prefer: 'return=minimal' });
        guardarCache();
    } catch (e) { estado.artigos = antes; render(); toast('Não foi limpo: ' + e.message, true); }
}

/* ── CATÁLOGO: adicionar sem escrever ────────── */
// Folha com os artigos conhecidos, por categoria. Tocar só ESCOLHE (marca e
// desmarca, nada é gravado); o botão do fundo adiciona os escolhidos todos de
// uma vez à lista de destino. Fechar a folha sem carregar nele desiste.
// O catálogo cresce sozinho — tudo o que se escreve na barra entra cá.
let _catAberto = false, _catGerir = false;
let _catSel = new Set();   // artigo_key dos escolhidos nesta abertura da folha

function registarNoCatalogo(nome) {
    const k = artKey(nome);
    if (!k || estado.catalogo.some((c) => c.artigo_key === k)) return;
    estado.catalogo.push({ artigo_key: k, nome });
    api('catalogo?on_conflict=artigo_key', { method: 'POST', body: { artigo_key: k, nome }, prefer: 'resolution=ignore-duplicates,return=minimal' }).catch(() => {});
}
function abrirCatalogo() {
    _catGerir = false;
    _catSel = new Set();
    abrirFolha('Adicionar artigos', `
        <div id="cg-destinos" class="cg-destinos"></div>
        <input id="cg-busca" class="campo cg-busca" type="search" placeholder="Procurar…" autocomplete="off" autocapitalize="off" oninput="renderCatalogo()" aria-label="Procurar artigo">
        <div id="cg-grupos"></div>
        <div class="cg-fundo">
            <button id="cg-ok" class="btn btn-primario" onclick="confirmarCatalogo()"></button>
        </div>
        <button id="cg-gerir" class="btn btn-discreto" onclick="alternarGerirCatalogo()"></button>`);
    _catAberto = true;
    renderCatalogo();
}
function alternarGerirCatalogo() { _catGerir = !_catGerir; renderCatalogo(); }
function escolherDestinoCatalogo(id) {
    estado.destino = id;
    if (estado.filtro !== 'tudo') estado.filtro = id;
    guardarCache();
    render();
    renderCatalogo();
}
function renderCatalogo() {
    const gr = $('cg-grupos');
    if (!gr || $('folha-fundo').hidden) { _catAberto = false; return; }
    const dest = destinoAtual();
    if (!dest) return;
    const abertas = listasAbertas();
    $('cg-destinos').innerHTML = abertas.length > 1
        ? abertas.map((l) => `<button class="cg-dest ${corDe(l)} ${l.id === dest.id ? 'ativo' : ''}" onclick="escolherDestinoCatalogo(${l.id})">${esc(l.emoji)} ${esc(l.nome)}</button>`).join('')
        : `<p class="nota topo-nota">Escolhe os artigos e adiciona-os de uma vez a ${esc(dest.emoji)} ${esc(dest.nome)}.</p>`;
    $('cg-gerir').textContent = _catGerir ? 'Voltar a escolher' : 'Tirar artigos desta folha';

    const naLista = new Set(artigosDe(dest.id).filter((a) => !a.tratado).map((a) => artKey(a.nome)));
    const busca = artKey($('cg-busca').value);
    const grupos = new Map();
    estado.catalogo.forEach((c) => {
        if (busca && !c.artigo_key.includes(busca)) return;
        const cat = catDe(c.nome).cat, k = cat ? cat.id : 0;
        if (!grupos.has(k)) grupos.set(k, { cat, itens: [] });
        grupos.get(k).itens.push(c);
    });
    let h = [...grupos.values()]
        .sort((x, y) => (!x.cat) - (!y.cat) || (x.cat && y.cat ? x.cat.nome.localeCompare(y.cat.nome, 'pt') : 0))
        .map((g) => `<h3 class="cg-cat"><span>${g.cat ? catEmoji(g.cat.nome) : '📦'}</span>${esc(g.cat ? g.cat.nome : 'Sem categoria')}</h3>
            <div class="cg-itens">${g.itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).map((c) => {
                const ja = naLista.has(c.artigo_key), on = !ja && _catSel.has(c.artigo_key);
                if (_catGerir) return `<button class="cg-item gerir" data-k="${esc(c.artigo_key)}" onclick="tocarCatalogo(this.dataset.k)" aria-label="Tirar ${esc(c.nome)} dos artigos conhecidos"><i>×</i>${esc(c.nome)}</button>`;
                if (ja) return `<button class="cg-item ja" disabled><i>✓</i>${esc(c.nome)}<small>na lista</small></button>`;
                return `<button class="cg-item ${corDe(dest)} ${on ? 'on' : ''}" data-k="${esc(c.artigo_key)}" onclick="tocarCatalogo(this.dataset.k)" aria-pressed="${on}">${on ? '<i>✓</i>' : ''}${esc(c.nome)}</button>`;
            }).join('')}</div>`).join('');
    const escrito = $('cg-busca').value.trim();
    if (escrito && !estado.catalogo.some((c) => c.artigo_key === busca)) {
        h += `<button class="btn btn-contorno" onclick="adicionarDaBusca()">Adicionar «${esc(escrito)}»</button>`;
    } else if (!h) {
        h = '<p class="nota">Ainda não há artigos conhecidos. Escreve na barra de baixo e eles aparecem aqui.</p>';
    }
    gr.innerHTML = h;

    // Botão do fundo: conta só os escolhidos que ainda não estão na lista de destino
    const n = [..._catSel].filter((k) => !naLista.has(k)).length;
    const ok = $('cg-ok');
    ok.hidden = _catGerir;
    ok.disabled = !n;
    ok.textContent = n ? `Adicionar ${n} ${n === 1 ? 'artigo' : 'artigos'} a ${dest.nome}` : 'Toca nos artigos para escolher';
}
async function confirmarCatalogo() {
    const dest = destinoAtual();
    if (!dest) return;
    const naLista = new Set(artigosDe(dest.id).filter((a) => !a.tratado).map((a) => artKey(a.nome)));
    const nomes = estado.catalogo.filter((c) => _catSel.has(c.artigo_key) && !naLista.has(c.artigo_key)).map((c) => c.nome);
    if (!nomes.length) return;
    _catSel = new Set();
    fecharFolha();
    toast(nomes.length === 1 ? `"${nomes[0]}" adicionado a ${dest.nome}.` : `${nomes.length} artigos adicionados a ${dest.nome}.`);
    await Promise.all(nomes.map((n) => adicionarArtigo(dest.id, n, null)));
}
async function tocarCatalogo(k) {
    const c = estado.catalogo.find((x) => x.artigo_key === k);
    const dest = destinoAtual();
    if (!c || !dest) return;
    if (_catGerir) {
        estado.catalogo = estado.catalogo.filter((x) => x !== c);
        renderCatalogo();
        try { await api(`catalogo?artigo_key=eq.${encodeURIComponent(k)}`, { method: 'DELETE', prefer: 'return=minimal' }); guardarCache(); }
        catch (e) { estado.catalogo.push(c); renderCatalogo(); toast('Não foi retirado: ' + e.message, true); }
        return;
    }
    if (_catSel.has(k)) _catSel.delete(k); else _catSel.add(k);
    renderCatalogo();
}
async function adicionarDaBusca() {
    const inp = $('cg-busca'), dest = destinoAtual();
    const txt = inp.value.trim();
    if (!txt || !dest) return;
    inp.value = '';
    const { nome, qtd } = separarQtd(txt);
    const p = adicionarArtigo(dest.id, maiuscula(nome).slice(0, 120), qtd ? qtd.slice(0, 30) : null);
    renderCatalogo();
    await p;
    renderCatalogo();
}

/* ── LISTAS ──────────────────────────────────── */
function formLista(l) {
    const emoji = l ? l.emoji : '🍽️';
    const opcoes = EMOJIS.includes(emoji) ? EMOJIS : [emoji].concat(EMOJIS);
    return `
        <form onsubmit="guardarLista(${l ? l.id : 'null'}); return false;">
            <label class="rotulo" for="fl-nome">Nome</label>
            <input id="fl-nome" class="campo" type="text" maxlength="60" value="${l ? esc(l.nome) : ''}" placeholder="ex.: Jantar de sábado" required autocomplete="off">
            <span class="rotulo">Símbolo</span>
            <div class="emojis" role="radiogroup" aria-label="Símbolo">
                ${opcoes.map((e) => `<label><input type="radio" name="fl-emoji" value="${esc(e)}" ${e === emoji ? 'checked' : ''}><span>${esc(e)}</span></label>`).join('')}
            </div>
            ${l && l.fixa ? '' : `<label class="rotulo" for="fl-data">Dia <span>(opcional)</span></label>
            <input id="fl-data" class="campo" type="date" value="${l && l.data ? esc(l.data) : ''}">`}
            <button class="btn btn-primario" type="submit">${l ? 'Guardar' : 'Criar lista'}</button>
        </form>`;
}
function abrirNovaLista() {
    abrirFolha('Nova lista', `<p class="nota topo-nota">Para umas compras específicas — um jantar, uma festa, as férias. Fica aberta ao lado da lista da Casa até a concluíres.</p>` + formLista(null));
    setTimeout(() => { const i = $('fl-nome'); if (i) i.focus(); }, 60);
}
async function guardarLista(id) {
    const nome = $('fl-nome').value.trim();
    if (!nome) return;
    const sel = document.querySelector('input[name="fl-emoji"]:checked');
    const corpo = { nome, emoji: sel ? sel.value : '🛒' };
    const cd = $('fl-data');
    if (cd) corpo.data = cd.value || null;
    fecharFolha();
    try {
        if (id == null) {
            const r = await api('listas', { method: 'POST', body: corpo, prefer: 'return=representation' });
            estado.listas.push(r[0]);
            estado.filtro = r[0].id;
            estado.destino = r[0].id;
        } else {
            const l = listaPorId(id);
            const r = await api(`listas?id=eq.${id}`, { method: 'PATCH', body: corpo, prefer: 'return=representation' });
            if (l && r && r[0]) Object.assign(l, r[0]);
        }
        guardarCache();
        render();
    } catch (e) { toast('Não ficou gravado: ' + e.message, true); }
}

function abrirMenuLista(id) {
    const l = listaPorId(id);
    if (!l) return;
    const nTrat = artigosDe(id).filter((a) => a.tratado).length;
    const nFalta = artigosDe(id).length - nTrat;
    let h = `<div class="menu">
        <button onclick="abrirEditarLista(${id})">✏️ Mudar nome${l.fixa ? ' ou símbolo' : ', símbolo ou dia'}</button>`;
    if (nTrat) h += `<button onclick="fecharFolha(); limparTratados(${id})">🧹 Limpar os ${nTrat} tratados</button>`;
    if (nFalta) h += `<button onclick="fecharFolha(); partilharLista(${id})">📤 Enviar a lista por mensagem</button>`;
    if (!l.fixa) {
        h += `<button onclick="fecharFolha(); concluirLista(${id})">✅ Concluir lista</button>
              <button class="perigo" onclick="fecharFolha(); apagarLista(${id})">🗑️ Apagar lista</button>`;
    }
    h += `</div>`;
    if (l.fixa) h += `<p class="nota">A lista da Casa é a do dia a dia: está sempre aberta e não se apaga.</p>`;
    else h += `<p class="nota">Criada por ${esc(nomeDe(l.criado_por))}. Concluir guarda-a no histórico (Definições); apagar elimina-a de vez.</p>`;
    abrirFolha(`${l.emoji} ${l.nome}`, h);
}
function abrirEditarLista(id) {
    const l = listaPorId(id);
    if (l) abrirFolha('Editar lista', formLista(l));
}
async function concluirLista(id) {
    const l = listaPorId(id);
    if (!l || l.fixa) return;
    const falta = artigosDe(id).filter((a) => !a.tratado).length;
    if (falta && !await confirmar(`Concluir "${l.nome}"?`, `Ainda tem ${falta} ${falta === 1 ? 'artigo' : 'artigos'} por tratar. A lista sai do ecrã principal e fica no histórico.`, 'Concluir')) return;
    const antes = l.concluida_em;
    l.concluida_em = new Date().toISOString();
    render();
    toast(`"${l.nome}" concluída.`);
    try {
        await api(`listas?id=eq.${id}`, { method: 'PATCH', body: { concluida_em: l.concluida_em }, prefer: 'return=minimal' });
        guardarCache();
    } catch (e) { l.concluida_em = antes; render(); toast('Não ficou gravado: ' + e.message, true); }
}
async function reabrirLista(id) {
    const l = listaPorId(id);
    if (!l) return;
    const antes = l.concluida_em;
    l.concluida_em = null;
    estado.filtro = id;
    fecharFolha();
    render();
    try {
        await api(`listas?id=eq.${id}`, { method: 'PATCH', body: { concluida_em: null }, prefer: 'return=minimal' });
        guardarCache();
    } catch (e) { l.concluida_em = antes; render(); toast('Não ficou gravado: ' + e.message, true); }
}
async function apagarLista(id) {
    const l = listaPorId(id);
    if (!l || l.fixa) return;
    const n = artigosDe(id).length;
    if (!await confirmar(`Apagar "${l.nome}"?`, n ? `A lista e os seus ${n} artigos são eliminados de vez.` : 'A lista é eliminada de vez.', 'Apagar', true)) return;
    const antesL = estado.listas.slice(), antesA = estado.artigos.slice();
    estado.listas = estado.listas.filter((x) => x.id !== id);
    estado.artigos = estado.artigos.filter((a) => a.lista_id !== id);
    render();
    try {
        await api(`listas?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
        guardarCache();
    } catch (e) { estado.listas = antesL; estado.artigos = antesA; render(); toast('Não foi apagada: ' + e.message, true); }
}
async function partilharLista(id) {
    const l = listaPorId(id);
    if (!l) return;
    const linhas = artigosDe(id).filter((a) => !a.tratado).map((a) => `• ${a.nome}${a.qtd ? ` (${a.qtd})` : ''}`);
    const texto = `${l.emoji} ${l.nome}\n${linhas.join('\n')}`;
    try {
        if (navigator.share) await navigator.share({ text: texto });
        else { await navigator.clipboard.writeText(texto); toast('Lista copiada.'); }
    } catch (e) { /* partilha cancelada */ }
}

function abrirEscolhaDestino() {
    const atual = destinoAtual();
    abrirFolha('Adicionar a…', `<div class="menu">
        ${listasAbertas().map((l) => `<button class="${atual && atual.id === l.id ? 'escolhido' : ''}" onclick="escolherDestino(${l.id})">${esc(l.emoji)} ${esc(l.nome)}</button>`).join('')}
        <button onclick="abrirNovaLista()">＋ Nova lista</button>
    </div>`);
}
function escolherDestino(id) {
    estado.destino = id;
    if (estado.filtro !== 'tudo') estado.filtro = id;
    guardarCache();
    fecharFolha();
    render();
    $('add-nome').focus();
}

/* ── FOLHAS (bottom sheet) e confirmação ─────── */
let _confirmar = null;
function abrirFolha(titulo, html) {
    _catAberto = false;
    if (_confirmar) { _confirmar(false); _confirmar = null; }
    $('folha-titulo').textContent = titulo;
    $('folha-corpo').innerHTML = html;
    $('folha-fundo').hidden = false;
    document.body.classList.add('com-folha');
}
function fecharFolha() {
    _catAberto = false;
    $('folha-fundo').hidden = true;
    document.body.classList.remove('com-folha');
    if (_confirmar) { const f = _confirmar; _confirmar = null; f(false); }
}
function confirmar(titulo, texto, acao, perigo) {
    return new Promise((res) => {
        abrirFolha(titulo, `<p class="confirma-txt">${esc(texto)}</p>
            <button class="btn ${perigo ? 'btn-perigo-cheio' : 'btn-primario'}" onclick="responderConfirma(true)">${esc(acao)}</button>
            <button class="btn btn-contorno" onclick="responderConfirma(false)">Cancelar</button>`);
        _confirmar = res;
    });
}
function responderConfirma(v) {
    const f = _confirmar;
    _confirmar = null;
    fecharFolha();
    if (f) f(v);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('folha-fundo').hidden) fecharFolha(); });

/* ── DEFINIÇÕES & ADMIN ──────────────────────── */
async function carregarPedidos() {
    try {
        estado.pedidos = await api('access_requests?select=email,requested_at&order=requested_at.asc') || [];
        render();
    } catch (e) {}
}
async function abrirDefinicoes() {
    const email = emailAtual();
    const conc = listasConcluidas();
    let h = `
        <form class="linha-form" onsubmit="guardarNome(); return false;">
            <div><label class="rotulo" for="df-nome">O teu nome <span>(aparece ao lado dos artigos)</span></label>
            <input id="df-nome" class="campo" type="text" maxlength="40" value="${esc(nomeDe(email))}" required autocomplete="off"></div>
            <button class="btn btn-primario btn-curto" type="submit">Guardar</button>
        </form>
        <p class="nota">Sessão: ${esc(email || '')}</p>

        <h3 class="sec">Listas concluídas</h3>
        ${conc.length ? `<ul class="hist">${conc.map((l) => {
            const n = artigosDe(l.id).length;
            return `<li><span class="hist-e">${esc(l.emoji)}</span>
                <span class="hist-t"><b>${esc(l.nome)}</b><small>${esc(dataCurta(l.concluida_em))} · ${n} ${n === 1 ? 'artigo' : 'artigos'}</small></span>
                <button class="btn-mini" onclick="reabrirLista(${l.id})">Reabrir</button>
                <button class="btn-mini discreto" onclick="apagarLista(${l.id})" aria-label="Apagar ${esc(l.nome)}">Apagar</button></li>`;
        }).join('')}</ul>` : '<p class="nota">Ainda não há listas concluídas.</p>'}`;

    if (isAdmin() && estado.categorias.length) h += `<h3 class="sec">Categorias de artigos</h3>
        <button class="btn btn-contorno sem-margem" onclick="abrirCategorias()">Gerir as ${estado.categorias.length} categorias</button>`;
    if (isAdmin()) h += `<h3 class="sec">Pedidos de acesso</h3><div id="df-pedidos"><p class="nota">A carregar…</p></div>
                         <h3 class="sec">Quem tem acesso</h3><div id="df-acessos"><p class="nota">A carregar…</p></div>`;

    h += `<button class="btn btn-contorno" onclick="window.location.reload()">Atualizar a app</button>
          <button class="btn btn-perigo" onclick="logout()">Terminar sessão</button>`;
    abrirFolha('Definições', h);
    if (isAdmin()) renderAdmin();
}
function abrirCategorias() {
    const n = {};
    Object.values(estado.artCats).forEach((cid) => { n[cid] = (n[cid] || 0) + 1; });
    abrirFolha('Categorias', `
        <p class="nota topo-nota">Agrupam os artigos nas listas. A categoria de cada artigo muda-se no próprio artigo (⋮) e fica memorizada para a próxima vez.</p>
        <ul class="hist">${estado.categorias.map((c) => `<li>
            <span class="hist-e">${catEmoji(c.nome)}</span>
            <span class="hist-t"><b>${esc(c.nome)}</b><small>${n[c.id] || 0} ${n[c.id] === 1 ? 'artigo conhecido' : 'artigos conhecidos'}</small></span>
            <button class="btn-mini" onclick="abrirCategoria(${c.id})">Editar</button></li>`).join('')}</ul>
        <button class="btn btn-primario" onclick="abrirCategoria(null)">Nova categoria</button>
        <button class="btn btn-contorno" onclick="abrirDefinicoes()">Voltar</button>`);
}
function abrirCategoria(id) {
    const c = id != null ? catPorId(id) : null;
    abrirFolha(c ? 'Editar categoria' : 'Nova categoria', `
        <form onsubmit="guardarCategoria(${c ? c.id : 'null'}); return false;">
            <label class="rotulo" for="ct-nome">Nome</label>
            <input id="ct-nome" class="campo" type="text" maxlength="40" value="${c ? esc(c.nome) : ''}" required autocomplete="off">
            <button class="btn btn-primario" type="submit">Guardar</button>
        </form>
        ${c ? `<button class="btn btn-perigo" onclick="eliminarCategoria(${c.id})">Eliminar categoria</button>` : ''}
        <button class="btn btn-contorno" onclick="abrirCategorias()">Voltar</button>`);
    if (!c) setTimeout(() => { const i = $('ct-nome'); if (i) i.focus(); }, 60);
}
async function guardarCategoria(id) {
    const nome = $('ct-nome').value.trim();
    if (!nome) return;
    if (estado.categorias.some((c) => c.id !== id && artKey(c.nome) === artKey(nome))) { toast('Já existe uma categoria com esse nome.', true); return; }
    try {
        if (id == null) {
            const r = await api('categorias', { method: 'POST', body: { nome }, prefer: 'return=representation' });
            estado.categorias.push({ id: r[0].id, nome: r[0].nome });
        } else {
            await api(`categorias?id=eq.${id}`, { method: 'PATCH', body: { nome }, prefer: 'return=minimal' });
            catPorId(id).nome = nome;
        }
        estado.categorias.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
        guardarCache();
        render();
        abrirCategorias();
    } catch (e) { toast('Não ficou gravado: ' + e.message, true); }
}
async function eliminarCategoria(id) {
    const c = catPorId(id);
    if (!c) return;
    const n = Object.values(estado.artCats).filter((x) => x === id).length;
    if (!await confirmar(`Eliminar "${c.nome}"?`, n ? `${n} ${n === 1 ? 'artigo conhecido fica' : 'artigos conhecidos ficam'} sem categoria.` : 'Nenhum artigo a usa.', 'Eliminar', true)) return;
    try {
        await api(`categorias?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
        estado.categorias = estado.categorias.filter((x) => x.id !== id);
        Object.keys(estado.artCats).forEach((k) => { if (estado.artCats[k] === id) delete estado.artCats[k]; });
        _catIdx = null;
        guardarCache();
        render();
        abrirCategorias();
    } catch (e) { toast('Não foi eliminada: ' + e.message, true); }
}
async function guardarNome() {
    const nome = $('df-nome').value.trim();
    const email = emailAtual();
    if (!nome || !email) return;
    try {
        await api('perfis?on_conflict=email', { method: 'POST', body: { email, nome }, prefer: 'resolution=merge-duplicates,return=minimal' });
        estado.perfis[email] = nome;
        guardarCache();
        render();
        toast('Nome guardado.');
    } catch (e) { toast('Não ficou gravado: ' + e.message, true); }
}
async function renderAdmin() {
    let acessos = [];
    try {
        [estado.pedidos, acessos] = await Promise.all([
            api('access_requests?select=email,requested_at&order=requested_at.asc'),
            api('allowed_users?select=email&order=email.asc'),
        ]);
    } catch (e) { toast('Erro a carregar acessos: ' + e.message, true); return; }
    const dp = $('df-pedidos'), da = $('df-acessos');
    if (!dp || !da) return;
    dp.innerHTML = estado.pedidos.length ? `<ul class="hist">${estado.pedidos.map((p, i) => `<li>
            <span class="hist-t"><b>${esc(p.email)}</b><small>${esc(dataCurta(p.requested_at))}</small></span>
            <button class="btn-mini" onclick="decidirPedido(${i}, true)">Aprovar</button>
            <button class="btn-mini discreto" onclick="decidirPedido(${i}, false)">Recusar</button></li>`).join('')}</ul>`
        : '<p class="nota">Sem pedidos pendentes.</p>';
    da.innerHTML = `<ul class="hist">${(acessos || []).map((u) => `<li>
            <span class="hist-t"><b>${esc(nomeDe(u.email))}</b><small>${esc(u.email)}</small></span>
            ${u.email.toLowerCase() === ADMIN_EMAIL ? '' : `<button class="btn-mini discreto" data-email="${esc(u.email)}" onclick="retirarAcesso(this.dataset.email)">Retirar</button>`}</li>`).join('')}</ul>
        <form class="linha-form" onsubmit="darAcesso(); return false;">
            <div><input id="df-novo" class="campo" type="email" placeholder="email@exemplo.com" required autocomplete="off" aria-label="Email a autorizar"></div>
            <button class="btn btn-primario btn-curto" type="submit">Dar acesso</button>
        </form>`;
    render();
}
async function decidirPedido(i, aprovar) {
    const p = estado.pedidos[i];
    if (!p) return;
    try {
        if (aprovar) await api('allowed_users', { method: 'POST', body: { email: p.email.toLowerCase() }, prefer: 'resolution=ignore-duplicates,return=minimal' });
        await api(`access_requests?email=eq.${encodeURIComponent(p.email)}`, { method: 'DELETE', prefer: 'return=minimal' });
        toast(aprovar ? 'Acesso aprovado.' : 'Pedido recusado.');
    } catch (e) { toast('Erro: ' + e.message, true); }
    renderAdmin();
}
async function darAcesso() {
    const email = $('df-novo').value.trim().toLowerCase();
    if (!email) return;
    try {
        await api('allowed_users', { method: 'POST', body: { email }, prefer: 'resolution=ignore-duplicates,return=minimal' });
        await api(`access_requests?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', prefer: 'return=minimal' });
        toast('Acesso dado.');
    } catch (e) { toast('Erro: ' + e.message, true); }
    renderAdmin();
}
async function retirarAcesso(email) {
    try {
        await api(`allowed_users?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE', prefer: 'return=minimal' });
        toast('Acesso retirado.');
    } catch (e) { toast('Erro: ' + e.message, true); }
    renderAdmin();
}

/* ── ARRANQUE ────────────────────────────────── */
// Sem zoom: o viewport já o pede, mas o iOS ignora — trava-se o pinch aqui
// e o duplo toque no CSS (touch-action: manipulation).
['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

iniciar();
