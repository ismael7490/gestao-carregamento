/* Gestão de Carregamento — conexão com o Supabase (login, banco, arquivos).
   Faz o app funcionar fora do Claude com o mesmo código das telas. */
{
const CFG = window.APP_CONFIG || {};
const AV = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#2f5d3a"/><circle cx="20" cy="16" r="7" fill="#fff"/><path d="M7 34c3-7 9-10 13-10s10 3 13 10" fill="#fff"/></svg>');
let sb = null, session = null, isAdmin = false, readyRes;
const ready = new Promise(r => readyRes = r);
const q = s => document.querySelector(s);

/* ---------- tela de login ---------- */
const css = document.createElement("style");
css.textContent = `
#auth{position:fixed;inset:0;z-index:60;background:var(--bg);overflow:auto;display:grid;place-items:center;padding:20px}
#auth .box{border:0;background:var(--card);border-radius:14px;padding:clamp(20px,4vw,34px);width:min(420px,100%);box-shadow:0 10px 30px rgba(0,0,0,.1)}
#auth img{display:block;width:min(260px,80%);margin:0 auto 6px}
#auth h1{font-size:22px;margin:4px 0 2px;text-align:center}
#auth p.s{margin:0 0 16px;text-align:center;color:var(--muted);font-size:14px}
#auth .tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--green2);padding:4px;border-radius:10px;margin-bottom:14px}
#auth .tabs button{min-height:40px;border:0;border-radius:8px;background:transparent;font:600 15px Archivo,sans-serif;color:var(--ink);cursor:pointer}
#auth .tabs button[aria-pressed=true]{background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.12)}
#auth label{display:block;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:10px}
#auth input{border:1.5px solid var(--muted);border-radius:8px;color:var(--ink);margin-top:3px}
#auth .go{width:100%;margin-top:4px}
#auth .lnk{background:none;border:0;color:var(--green);font:600 14px Archivo,sans-serif;cursor:pointer;padding:10px 0;min-height:40px}
#auth .msg{min-height:20px;font-size:14px;margin:8px 0 0;text-align:center}
#auth .msg.err{color:var(--red)}#auth .msg.ok{color:var(--green)}
#sairBtn{position:absolute;top:16px;right:max(4vw,14px);background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:8px 14px;font:600 14px Archivo,sans-serif;cursor:pointer;min-height:40px}
header{position:relative}`;
document.head.appendChild(css);

const auth = document.createElement("div");
auth.id = "auth";
document.body.appendChild(auth);
let mode = "entrar";
function msg(t, ok) { const m = q("#a_msg"); if (m) { m.textContent = t || ""; m.className = "msg " + (ok ? "ok" : "err"); } }
function drawAuth() {
  const logo = window.__LOGO || "";
  if (!CFG.supabaseUrl || !CFG.supabaseKey) {
    auth.innerHTML = `<div class="box"><h1>Falta configurar</h1><p class="s">Abra o arquivo <b>config.js</b> e preencha o endereço e a chave pública (anon) do seu projeto Supabase.</p></div>`;
    return;
  }
  const rec = mode === "nova";
  auth.innerHTML = `<div class="box">${logo ? `<img alt="Produtiva Sementes" src="${logo}">` : ""}
    <h1>Gestão de Carregamento</h1><p class="s">${rec ? "Crie sua nova senha" : "Entre ou crie sua conta"}</p>
    ${rec ? "" : `<div class="tabs"><button data-m="entrar" aria-pressed="${mode === "entrar"}">Entrar</button><button data-m="criar" aria-pressed="${mode === "criar"}">Criar conta</button></div>`}
    <form id="a_form" autocomplete="on">
      ${rec ? "" : `<label>E-mail<input id="a_email" type="email" autocomplete="username" required></label>`}
      ${mode === "esqueci" ? "" : `<label>${rec ? "Nova senha" : "Senha"}<input id="a_pass" type="password" autocomplete="${mode === "entrar" ? "current-password" : "new-password"}" minlength="8" required></label>`}
      ${mode === "criar" || rec ? `<label>Confirmar senha<input id="a_pass2" type="password" autocomplete="new-password" minlength="8" required></label>` : ""}
      <button class="btn p go" type="submit" id="a_go">${{ entrar: "Entrar", criar: "Criar conta", esqueci: "Enviar link para redefinir", nova: "Salvar nova senha" }[mode]}</button>
    </form>
    ${mode === "entrar" ? `<button class="lnk" id="a_forgot">Esqueci minha senha</button>` : mode === "esqueci" ? `<button class="lnk" id="a_back">Voltar para entrar</button>` : ""}
    <p class="msg" id="a_msg" role="status"></p></div>`;
  auth.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { mode = b.dataset.m; drawAuth(); });
  if (q("#a_forgot")) q("#a_forgot").onclick = () => { mode = "esqueci"; drawAuth(); };
  if (q("#a_back")) q("#a_back").onclick = () => { mode = "entrar"; drawAuth(); };
  q("#a_form").onsubmit = async e => {
    e.preventDefault();
    const btn = q("#a_go"); btn.disabled = true; msg("");
    const email = q("#a_email")?.value.trim(), pass = q("#a_pass")?.value, pass2 = q("#a_pass2")?.value;
    try {
      if ((mode === "criar" || mode === "nova") && pass !== pass2) { msg("As senhas não conferem."); return; }
      if (mode === "entrar") {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) msg(/confirm/i.test(error.message) ? "Confirme seu e-mail pelo link que enviamos e tente de novo." : "E-mail ou senha incorretos.");
      } else if (mode === "criar") {
        const { data, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) msg(/registered|exists/i.test(error.message) ? "Este e-mail já tem conta. Use Entrar." : "Não foi possível criar a conta: " + error.message);
        else if (!data.session) msg("Conta criada! Abra o e-mail que enviamos para confirmar e depois entre.", true);
      } else if (mode === "esqueci") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        msg(error ? "Não foi possível enviar: " + error.message : "Se o e-mail tiver conta, enviamos um link para criar uma nova senha.", !error);
      } else if (mode === "nova") {
        const { error } = await sb.auth.updateUser({ password: pass });
        if (error) msg("Não foi possível salvar: " + error.message);
        else { mode = "entrar"; if (started) location.reload(); else await startApp(); }
      }
    } finally { if (btn.isConnected) btn.disabled = false; }
  };
}

/* ---------- banco: mesma interface que o app usa ---------- */
const T = "docs";
const err = e => ({ code: (e && (e.code === "42501" || /row-level|permiss/i.test(e.message || ""))) ? "invalid_argument" : "unavailable", message: (e && e.message) || "erro" });
const snap = (id, data) => ({ id, exists: data != null, data: () => (data == null ? undefined : data), metadata: { fromCache: false, hasPendingWrites: false } });
const watchers = new Map(), timers = new Map(), channels = new Map();
function refresh(col) {
  clearTimeout(timers.get(col));
  timers.set(col, setTimeout(() => (watchers.get(col) || new Set()).forEach(fn => fn()), 120));
}
function watch(col, fn) {
  if (!watchers.has(col)) watchers.set(col, new Set());
  watchers.get(col).add(fn);
  if (!channels.has(col)) {
    const ch = sb.channel("docs-" + col)
      .on("postgres_changes", { event: "*", schema: "public", table: T, filter: "col=eq." + col }, () => refresh(col))
      .subscribe();
    channels.set(col, ch);
  }
  fn();
  return () => watchers.get(col)?.delete(fn);
}
setInterval(() => { if (session) watchers.forEach((_, col) => refresh(col)); }, 25000);
function docRef(col, id) {
  const ref = {
    id, path: col + "/" + id,
    async get() {
      const { data, error } = await sb.from(T).select("data").eq("col", col).eq("id", id).maybeSingle();
      if (error) throw err(error);
      return snap(id, data ? data.data : null);
    },
    async set(d) {
      const { error } = await sb.from(T).upsert({ col, id, data: d, updated_at: new Date().toISOString() });
      if (error) throw err(error);
      refresh(col);
    },
    async update(d) {
      const s = await ref.get();
      if (!s.exists) throw { code: "invalid_argument", message: "não existe" };
      await ref.set({ ...s.data(), ...d });
    },
    async delete() {
      const { error } = await sb.from(T).delete().eq("col", col).eq("id", id);
      if (error) throw err(error);
      refresh(col);
    },
    async acquire() { return { acquired: true }; },
    onSnapshot(next, onErr) { let last; return watch(col, async () => { try { const s = await ref.get(), k = JSON.stringify(s.exists ? s.data() : null); if (k === last) return; last = k; next(s); } catch (e) { onErr && onErr(e); } }); }
  };
  return ref;
}
function colRef(col) {
  const c = {
    path: col,
    doc: id => docRef(col, id || crypto.randomUUID()),
    async add(d) { const r = docRef(col, crypto.randomUUID()); await r.set(d); return r; },
    async get() {
      const { data, error } = await sb.from(T).select("id,data").eq("col", col);
      if (error) throw err(error);
      const docs = (data || []).map(r => snap(r.id, r.data));
      return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] };
    },
    onSnapshot(next, onErr) { let last; return watch(col, async () => { try { const s = await c.get(), k = JSON.stringify(s.docs.map(d => [d.id, d.data()])); if (k === last) return; last = k; next(s); } catch (e) { onErr && onErr(e); } }); }
  };
  return c;
}
const DB = {
  doc: p => { const [col, id] = p.split("/"); return docRef(col, id); },
  collection: col => colRef(col),
  async emitir(body) {
    const { data, error } = await sb.rpc("emitir_ordem", { body });
    if (error) throw err(error);
    refresh("ordens");
    return data;
  }
};
const me = () => ({ id: session.user.id, name: "", email: session.user.email || null, avatarUrl: AV, color: "#2f5d3a", isOwner: false, canEdit: isAdmin });
const USER = {
  isOwner: async () => false, canEdit: async () => isAdmin, can: async () => null,
  id: async () => session.user.id, me: async () => me(), name: async () => "", email: async () => session.user.email || null, avatarUrl: async () => AV,
  profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: "", email: null, avatarUrl: AV, color: "#888", isMe: i === session.user.id, guest: false, roles: null }])),
  search: async () => []
};
const DL = {
  async save({ filename, data }) {
    const ext = (filename.split(".").pop() || "").toLowerCase();
    const type = { pdf: "application/pdf", csv: "text/csv;charset=utf-8" }[ext] || "application/octet-stream";
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { status: "saved" };
  }
};
window.claude = { use: async n => { await ready; return n === "db" ? DB : n === "user" ? USER : n === "downloads" ? DL : null; } };

/* ---------- início ---------- */
let started = false;
async function startApp() {
  if (started) return;
  started = true;
  try { const { data } = await sb.rpc("entrar"); isAdmin = !!data; } catch (e) { isAdmin = false; }
  auth.remove();
  const h = q("header");
  if (h && !q("#sairBtn")) {
    const b = document.createElement("button"); b.id = "sairBtn"; b.textContent = "Sair";
    b.title = session.user.email || ""; b.onclick = async () => { await sb.auth.signOut(); location.reload(); };
    h.appendChild(b);
  }
  readyRes();
}
if (!window.supabase || !CFG.supabaseUrl || !CFG.supabaseKey) { drawAuth(); }
else {
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
  sb.auth.onAuthStateChange((ev, s) => {
    session = s;
    if (ev === "PASSWORD_RECOVERY") { mode = "nova"; drawAuth(); return; }
    if (ev === "SIGNED_OUT") { location.reload(); return; }
    if (s && !started && mode !== "nova") setTimeout(startApp, 0);
  });
  sb.auth.getSession().then(({ data }) => { session = data.session; if (!session) drawAuth(); else if (mode !== "nova") startApp(); });
}
}
