// ===== AppScroll — feed vertical de contenido curado =====
const CATS = {
  rubro: { label: 'Mi rubro', subs: { mealprep: '🍱 Meal prep', edicion: '🎬 Edición con IA', repos: '🐙 Repos GitHub', tools: '🧰 Herramientas' } },
  amigos: { label: 'Amigos', subs: { retos: '🔥 Retos', cartas: '🃏 Juegos de cartas', virales: '😂 Virales' } },
};
const DEFAULT_PERFIL = `Soy editor de video (DaVinci Resolve, After Effects, CapCut). Construyo mi marca personal enseñando edición, animación, flujo de trabajo y uso de IA. Mi perfil es mi portafolio para conseguir clientes y empresas. Busco herramientas que acorten el tiempo de edición de videos sencillos para mí y mis clientes, y alimentar mi "cerebro de edición" (base de conocimiento de técnicas, plantillas y automatizaciones).`;
// ---------- estado ----------
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} };
let videos = load('as_videos', null);
if (!videos) videos = [];
videos = videos.filter(v => !/^d\d+$/.test(v.id)); // limpia demos viejos
let feedInfo = load('as_feedinfo', null);
// Videos curados por Claude: se sincronizan desde feed.json en cada carga
async function syncCurated() {
  try {
    const r = await fetch('feed.json?t=' + Date.now()); if (!r.ok) return;
    const data = await r.json(), ids = new Set(data.videos.map(v => v.id));
    videos = videos.filter(v => !v.curated || ids.has(v.id) || v.idea || v.claude);
    const base = Date.parse(data.updated) || Date.now();
    data.videos.forEach((c, i) => {
      const old = videos.find(v => v.id === c.id);
      if (old) Object.assign(old, c, { curated: true });
      else videos.push({ ...c, curated: true, added: base - i * 1000, idea: false, claude: false });
    });
    feedInfo = { updated: data.updated, source: data.source, count: data.videos.length }; save('as_feedinfo', feedInfo);
    persist();
  } catch {}
}
let settings = load('as_settings', { apiKey: '', model: 'claude-sonnet-5-5', perfil: DEFAULT_PERFIL });
let state = { feed: 'rubro', sub: 'all', view: 'feed', muted: true };
const persist = () => save('as_videos', videos);
const feedOf = cat => Object.keys(CATS).find(f => cat in CATS[f].subs);
const catLabel = cat => CATS[feedOf(cat)]?.subs[cat] || cat;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800); };

// ---------- embeds ----------
function parse(url) {
  let m;
  if ((m = url.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)))
    return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}&playsinline=1&controls=0&rel=0` };
  if ((m = url.match(/tiktok\.com\/.*video\/(\d+)/)))
    return { kind: 'iframe', src: `https://www.tiktok.com/player/v1/${m[1]}?autoplay=1&loop=1&music_info=0&description=0` };
  if ((m = url.match(/instagram\.com\/(?:reel|reels|p)\/([\w-]+)/)))
    return { kind: 'iframe', src: `https://www.instagram.com/reel/${m[1]}/embed/` };
  return { kind: 'video', src: url };
}
const repoUrl = r => !r ? '' : r.startsWith('http') ? r : `https://github.com/${r}`;
const repoSlug = r => (r || '').replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '').split('/').slice(0, 2).join('/');

// ---------- feed ----------
function visible() {
  const hidden = new Set(load('as_hidden', []));
  return videos.filter(v => !hidden.has(v.id) && feedOf(v.cat) === state.feed && (state.sub === 'all' || v.cat === state.sub)).sort((a, b) => b.added - a.added);
}
function renderChips() {
  const subs = CATS[state.feed].subs;
  $('#chips').innerHTML = [['all', 'Todo'], ...Object.entries(subs)]
    .map(([k, l]) => `<button data-sub="${k}" class="${state.sub === k ? 'active' : ''}">${l}</button>`).join('');
}
let io;
function renderFeed() {
  renderChips();
  const list = visible();
  const feed = $('#feed');
  if (!list.length) { feed.innerHTML = `<div class="slide"><p class="empty">No hay videos acá todavía.<br>Tocá ＋ para agregar uno.</p></div>`; return; }
  feed.innerHTML = list.map(v => {
    const e = parse(v.url);
    const media = e.kind === 'video'
      ? `<video src="${esc(e.src)}" loop muted playsinline preload="metadata"></video><div class="tap"></div>`
      : `<iframe data-src="${esc(e.src)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    return `<article class="slide" data-id="${v.id}">${media}
      <div class="meta"><span class="cat">${esc(catLabel(v.cat))}</span>${v.curated ? `<span class="cat viral">🔥 ${esc(v.views)} · ${esc(v.x)}x</span>` : ''}${v.creator ? `<p class="by">@${esc(v.creator)} · ${v.platform === 'tiktok' ? 'TikTok' : 'Instagram'} · ${esc(v.date)}</p>` : ''}<h3>${esc(v.title || 'Sin título')}</h3>
        ${v.repo ? `<p>🐙 <a href="${esc(repoUrl(v.repo))}" target="_blank" rel="noopener">${esc(repoSlug(v.repo))}</a></p>` : ''}
        ${v.notes ? `<p>${esc(v.notes)}</p>` : ''}${v.why ? `<p class="why">🎬 ${esc(v.why)}</p>` : ''}</div>
      <div class="actions">
        <button data-act="idea" class="${v.idea ? 'on' : ''}">💡<span>Idea</span></button>
        <button data-act="claude" class="${v.claude ? 'on' : ''}">🧠<span>${v.analysis ? 'Analizado' : 'Claude'}</span></button>
        <button data-act="sound">${state.muted ? '🔇' : '🔊'}<span>Sonido</span></button>
        <button data-act="open">↗<span>Abrir</span></button>
        <button data-act="del">🗑<span>Quitar</span></button>
      </div></article>`;
  }).join('');
  feed.scrollTop = 0;
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(en => activate(en.target, en.isIntersecting)), { root: feed, threshold: 0.6 });
  feed.querySelectorAll('.slide[data-id]').forEach(s => io.observe(s));
}
function activate(slide, on) {
  const vid = slide.querySelector('video'), ifr = slide.querySelector('iframe');
  if (vid) {
    if (on) { vid.muted = state.muted; vid.currentTime = 0; vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}) }); slide.classList.remove('paused'); }
    else vid.pause();
  }
  if (ifr) {
    let src = ifr.dataset.src;
    if (!state.muted) src = src.replace('mute=1', 'mute=0');
    if (on) { if (ifr.src !== src) ifr.src = src; } else ifr.removeAttribute('src'); // corta la reproducción
  }
}

// ---------- acciones ----------
document.addEventListener('click', e => {
  const t = e.target.closest('button,.tap'); if (!t) return;
  if (t.dataset.feed) { state.feed = t.dataset.feed; state.sub = 'all'; document.querySelectorAll('.feeds button').forEach(b => b.classList.toggle('active', b === t)); renderFeed(); }
  else if (t.dataset.sub) { state.sub = t.dataset.sub; renderFeed(); }
  else if (t.dataset.view) setView(t.dataset.view);
  else if (t.id === 'addBtn') openAdd();
  else if (t.classList.contains('tap')) { const s = t.closest('.slide'), v = s.querySelector('video'); if (v.paused) { v.play(); s.classList.remove('paused') } else { v.pause(); s.classList.add('paused') } }
  else if (t.dataset.act) slideAction(t);
  else if (t.dataset.do) panelAction(t);
});
function slideAction(btn) {
  const slide = btn.closest('.slide'), v = videos.find(x => x.id === slide.dataset.id); if (!v) return;
  const a = btn.dataset.act;
  if (a === 'idea') { v.idea = !v.idea; btn.classList.toggle('on', v.idea); toast(v.idea ? '💡 Guardado en Ideas' : 'Quitado de Ideas'); }
  if (a === 'claude') { v.claude = !v.claude; btn.classList.toggle('on', v.claude); toast(v.claude ? '🧠 En cola para que Claude lo analice' : 'Quitado de la cola'); }
  if (a === 'sound') { state.muted = !state.muted; document.querySelectorAll('[data-act=sound]').forEach(b => b.firstChild.textContent = state.muted ? '🔇' : '🔊'); const vid = slide.querySelector('video'); if (vid) vid.muted = state.muted; const f = slide.querySelector('iframe'); if (f) { f.removeAttribute('src'); activate(slide, true); } }
  if (a === 'open') window.open(v.url, '_blank', 'noopener');
  if (a === 'del' && confirm('¿Quitar este video?')) { if (v.curated) { const h = load('as_hidden', []); h.push(v.id); save('as_hidden', h); } videos = videos.filter(x => x !== v); persist(); renderFeed(); return; }
  persist();
}

// ---------- agregar ----------
function openAdd(prefill = {}) {
  const sel = $('#addForm [name=cat]');
  sel.innerHTML = Object.values(CATS).map(f => `<optgroup label="${f.label}">${Object.entries(f.subs).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</optgroup>`).join('');
  sel.value = state.sub !== 'all' ? state.sub : Object.keys(CATS[state.feed].subs)[0];
  const f = $('#addForm'); f.reset(); sel.value = prefill.cat || sel.value;
  if (prefill.url) f.url.value = prefill.url;
  $('#addDialog').showModal();
}
$('#addDialog').addEventListener('close', () => {
  if ($('#addDialog').returnValue !== 'ok') return;
  const f = $('#addForm');
  const v = { id: 'v' + Date.now(), added: Date.now(), url: f.url.value.trim(), title: f.title.value.trim(), cat: f.cat.value, repo: f.repo.value.trim(), notes: f.notes.value.trim(), idea: false, claude: false };
  if (!v.repo) { const m = v.url.match(/github\.com\/([\w.-]+\/[\w.-]+)/); if (m) v.repo = m[1]; }
  videos.push(v); persist(); state.feed = feedOf(v.cat); state.sub = 'all';
  document.querySelectorAll('.feeds button').forEach(b => b.classList.toggle('active', b.dataset.feed === state.feed));
  setView('feed'); renderFeed(); toast('Video agregado');
});
// Compartir desde otra app (PWA instalada) o ?url=
const qs = new URLSearchParams(location.search); const shared = qs.get('url') || (qs.get('text') || '').match(/https?:\S+/)?.[0];

// ---------- paneles ----------
function setView(view) {
  state.view = view;
  document.querySelectorAll('.bottom [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const p = $('#panel');
  if (view === 'feed') { p.classList.add('hidden'); document.querySelectorAll('.slide').forEach(s => { const r = s.getBoundingClientRect(); if (Math.abs(r.top) < 50) activate(s, true) }); return; }
  document.querySelectorAll('.slide').forEach(s => activate(s, false));
  p.classList.remove('hidden');
  ({ ideas: renderIdeas, claude: renderClaude, ajustes: renderAjustes })[view]();
}
const item = (v, extra = '') => `<div class="card" data-id="${v.id}"><h4>${esc(v.title || 'Sin título')}</h4>
  <div class="small">${esc(catLabel(v.cat))} · <a href="${esc(v.url)}" target="_blank" rel="noopener" style="color:var(--acc2)">ver video</a>${v.repo ? ` · 🐙 <a href="${esc(repoUrl(v.repo))}" target="_blank" rel="noopener" style="color:var(--acc2)">${esc(repoSlug(v.repo))}</a>` : ''}</div>${extra}</div>`;

function renderIdeas() {
  const list = videos.filter(v => v.idea);
  $('#panel').innerHTML = `<h2>💡 Ideas a tener en cuenta</h2><p class="sub">Videos que marcaste. Anotá cómo usarlos en tu contenido.</p>` +
    (list.length ? list.map(v => item(v, `<textarea data-note="${v.id}" rows="2" placeholder="¿Cómo lo uso? (ej: tutorial, reel, plantilla para cliente)">${esc(v.ideaNote || '')}</textarea>
      <div class="row"><button class="btn" data-do="toClaude">${v.claude ? '✓ En cola Claude' : '🧠 Mandar a Claude'}</button><button class="btn" data-do="unIdea">Quitar</button></div>`)).join('')
      + `<div class="row"><button class="btn primary" data-do="exportIdeas">⬇ Exportar ideas (.md)</button></div>`
      : `<p class="empty">Todavía no marcaste ideas. Tocá 💡 en un video.</p>`);
  $('#panel').querySelectorAll('[data-note]').forEach(t => t.oninput = () => { videos.find(v => v.id === t.dataset.note).ideaNote = t.value; persist(); });
}

function renderClaude() {
  const list = videos.filter(v => v.claude);
  $('#panel').innerHTML = `<h2>🧠 Cola de análisis</h2><p class="sub">Claude evalúa si cada repo/info es relevante para vos o para tu cerebro de edición.
    ${settings.apiKey ? '' : '<br>⚠︎ Sin API key: usá “Exportar para Claude” y pegalo en Claude / Claude Code, o cargá tu key en Ajustes.'}</p>` +
    (list.length ? list.map(v => item(v, `${v.analysis ? verdictHtml(v.analysis) : ''}
      <div class="row"><button class="btn primary" data-do="analyze">${v.analysis ? '↻ Re-analizar' : '▶ Analizar'}</button>
      ${v.analysis?.cerebro ? `<button class="btn" data-do="brain">${v.brain ? '✓ En cerebro' : '＋ Cerebro de edición'}</button>` : ''}
      <button class="btn" data-do="unClaude">Quitar</button></div>`)).join('')
      + `<div class="row"><button class="btn primary" data-do="analyzeAll">Analizar todo</button><button class="btn" data-do="exportClaude">⬇ Exportar para Claude</button><button class="btn" data-do="copyClaude">📋 Copiar prompt</button><button class="btn" data-do="exportBrain">⬇ Cerebro (.md)</button></div>`
      : `<p class="empty">Nada en cola. Tocá 🧠 en un video para que Claude lo analice.</p>`);
}
function verdictHtml(a) {
  if (a.error) return `<div class="verdict no">Error: ${esc(a.error)}</div>`;
  const low = a.relevancia === 'baja';
  return `<div class="verdict ${low ? 'no' : ''}"><b>Relevancia: ${esc(a.relevancia)} (${esc(a.puntaje)}/10)</b>${a.cerebro ? ' · 🧠 apto para cerebro de edición' : ''}
${esc(a.resumen)}

<b>Por qué:</b> ${esc(a.por_que)}
<b>Cómo usarlo:</b> ${esc(a.como_usarlo)}${a.idea_contenido ? `\n<b>Idea de contenido:</b> ${esc(a.idea_contenido)}` : ''}</div>`;
}

function renderAjustes() {
  $('#panel').innerHTML = `<h2>⚙︎ Ajustes</h2><p class="sub">Todo se guarda solo en este dispositivo.</p>
    <div class="card"><label>Tu perfil (contexto que usa Claude para decidir relevancia)<textarea id="sPerfil" rows="6">${esc(settings.perfil)}</textarea></label>
    <label>API key de Anthropic (opcional, para analizar desde la app)<input id="sKey" type="password" value="${esc(settings.apiKey)}" placeholder="sk-ant-..."></label>
    <label>Modelo<input id="sModel" value="${esc(settings.model)}"></label>
    <div class="row"><button class="btn primary" data-do="saveSettings">Guardar</button></div></div>
    <div class="card"><h4>Respaldo</h4><p class="small">Pasá tu biblioteca entre celular y compu.</p>
    ${feedInfo ? `<p class="small">Feed curado por Claude: ${feedInfo.count} videos · actualizado ${esc(feedInfo.updated)}</p>` : ''}<div class="row"><button class="btn" data-do="backup">⬇ Exportar JSON</button><button class="btn" data-do="restore">⬆ Importar JSON</button><button class="btn" data-do="resync">↻ Recargar feed</button></div></div>`;
}

async function panelAction(btn) {
  const id = btn.closest('[data-id]')?.dataset.id, v = videos.find(x => x.id === id), d = btn.dataset.do;
  if (d === 'unIdea') { v.idea = false; persist(); renderIdeas(); }
  if (d === 'toClaude') { v.claude = true; persist(); renderIdeas(); toast('🧠 En cola'); }
  if (d === 'unClaude') { v.claude = false; persist(); renderClaude(); }
  if (d === 'brain') { v.brain = !v.brain; persist(); renderClaude(); }
  if (d === 'analyze') { btn.textContent = 'Analizando…'; btn.disabled = true; await analyze(v); renderClaude(); }
  if (d === 'analyzeAll') { btn.textContent = 'Analizando…'; for (const x of videos.filter(x => x.claude && !x.analysis)) await analyze(x); renderClaude(); }
  if (d === 'exportClaude') download('para-claude.md', await claudePrompt());
  if (d === 'copyClaude') { await navigator.clipboard.writeText(await claudePrompt()); toast('Prompt copiado'); }
  if (d === 'exportIdeas') download('ideas.md', '# Ideas a tener en cuenta\n\n' + videos.filter(v => v.idea).map(v => `## ${v.title}\n- Categoría: ${catLabel(v.cat)}\n- Video: ${v.url}${v.repo ? `\n- Repo: ${repoUrl(v.repo)}` : ''}\n- Nota: ${v.ideaNote || v.notes || '-'}\n`).join('\n'));
  if (d === 'exportBrain') download('cerebro-edicion.md', '# Cerebro de edición\n\n' + videos.filter(v => v.brain || v.analysis?.cerebro).map(v => `## ${v.title}\n${repoUrl(v.repo) || v.url}\n\n${v.analysis?.resumen || ''}\n\n**Cómo usarlo:** ${v.analysis?.como_usarlo || ''}\n`).join('\n'));
  if (d === 'saveSettings') { settings = { perfil: $('#sPerfil').value, apiKey: $('#sKey').value.trim(), model: $('#sModel').value.trim() || 'claude-sonnet-5-5' }; save('as_settings', settings); toast('Guardado'); }
  if (d === 'backup') download('appscroll-backup.json', JSON.stringify({ videos }, null, 2));
  if (d === 'restore') { const i = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' }); i.onchange = async () => { try { videos = JSON.parse(await i.files[0].text()).videos; persist(); renderFeed(); toast('Importado'); } catch { toast('Archivo inválido') } }; i.click(); }
  if (d === 'resync') { await syncCurated(); renderFeed(); renderAjustes(); toast('Feed actualizado'); }
}
function download(name, text) { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: name }); a.click(); }

// ---------- Claude ----------
async function repoContext(repo) {
  const slug = repoSlug(repo); if (!slug.includes('/')) return '';
  try {
    const [info, readme] = await Promise.all([
      fetch(`https://api.github.com/repos/${slug}`).then(r => r.ok ? r.json() : null),
      fetch(`https://api.github.com/repos/${slug}/readme`, { headers: { Accept: 'application/vnd.github.raw' } }).then(r => r.ok ? r.text() : ''),
    ]);
    return `Repo ${slug}: ${info?.description || ''} | ⭐ ${info?.stargazers_count ?? '?'} | lenguaje ${info?.language || '?'} | último push ${info?.pushed_at || '?'}\nREADME (recortado):\n${readme.slice(0, 6000)}`;
  } catch { return `Repo ${slug} (no se pudo leer)`; }
}
const describe = (v, ctx) => `Título: ${v.title}\n${v.creator ? `Creador: @${v.creator} (${v.platform}), ${v.views} vistas, ${v.x}x su media\nPor qué funciona: ${v.why}\n` : ''}Categoría: ${catLabel(v.cat)}\nVideo: ${v.url}\n${v.repo ? 'Repo: ' + repoUrl(v.repo) + '\n' : ''}Notas: ${v.notes || '-'}${v.ideaNote ? '\nMi idea: ' + v.ideaNote : ''}${ctx ? '\n' + ctx : ''}`;
async function analyze(v) {
  if (!settings.apiKey) { toast('Cargá tu API key en Ajustes o usá Exportar'); return; }
  const ctx = v.repo ? await repoContext(v.repo) : '';
  const prompt = `Mi perfil:\n${settings.perfil}\n\nAnalizá este contenido que guardé:\n${describe(v, ctx)}\n\nRespondé SOLO con JSON: {"relevancia":"alta|media|baja","puntaje":0-10,"resumen":"qué es en 1-2 frases","por_que":"por qué me sirve o no","como_usarlo":"pasos concretos para mi flujo (Resolve/AE/CapCut/automatización)","cerebro":true|false (si vale la pena guardarlo en mi cerebro de edición),"idea_contenido":"una idea de reel/tutorial para mi marca a partir de esto"}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: settings.model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || r.status);
    const txt = j.content.map(c => c.text || '').join('');
    v.analysis = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    v.analysis.fecha = new Date().toISOString();
  } catch (e) { v.analysis = { error: e.message }; }
  persist();
}
async function claudePrompt() {
  const list = videos.filter(v => v.claude);
  const parts = await Promise.all(list.map(async (v, i) => `### ${i + 1}. ${v.title}\n${describe(v, v.repo ? await repoContext(v.repo) : '')}`));
  return `# Análisis de contenido guardado en AppScroll\n\n## Mi perfil\n${settings.perfil}\n\n## Tarea\nPara cada ítem decime: relevancia (alta/media/baja, 0-10), qué es, por qué me sirve o no, cómo integrarlo a mi flujo (DaVinci/AE/CapCut/automatización), si va a mi "cerebro de edición", y una idea de contenido para mi marca. Al final, un top 3 priorizado.\n\n## Ítems\n\n${parts.join('\n\n')}\n`;
}

// ---------- init ----------
renderFeed();
syncCurated().then(renderFeed);
if (shared) openAdd({ url: shared });
document.addEventListener('keydown', e => { if (state.view !== 'feed' || $('#addDialog').open) return; const f = $('#feed'); if (e.key === 'ArrowDown') f.scrollBy(0, innerHeight); if (e.key === 'ArrowUp') f.scrollBy(0, -innerHeight); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
