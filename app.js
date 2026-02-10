// SNS MultiPost v2.3 - Strategic Hardening Edition

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: '📸', color: '#e1306c', url: 'https://www.instagram.com/' },
  { id: 'youtube', name: 'YouTube Shorts', icon: '▶️', color: '#ff0000', url: 'https://www.youtube.com/upload' },
  { id: 'line', name: 'LINE VOOM', icon: '💬', color: '#06c755', url: 'https://linevoom.line.me/' },
  { id: 'twitter', name: 'X (Twitter)', icon: '𝕏', color: '#000000', url: 'https://x.com/compose/post' },
  { id: 'facebook', name: 'Facebook', icon: '📘', color: '#1877f2', url: 'https://www.facebook.com/' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#00f2ea', url: 'https://www.tiktok.com/upload' },
  { id: 'gmb', name: 'Google Business', icon: '🏢', color: '#4285f4', url: 'https://business.google.com/locations' },
];

/**
 * STRATEGIC STORAGE: IndexedDB Wrapper
 * localStorage is for toys. Professional data needs IndexedDB for durability.
 */
const DB_NAME = 'SNS_MP_V3';
const DB_VERSION = 1;

const DB = {
  db: null,
  init() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('posts')) db.createObjectStore('posts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('config')) db.createObjectStore('config', { keyPath: 'id' });
      };
      req.onsuccess = e => { this.db = e.target.result; res(); };
      req.onerror = e => rej(e);
    });
  },
  op(store, mode) { return this.db.transaction(store, mode).objectStore(store); },
  all(store) {
    return new Promise(res => {
      const req = this.op(store, 'readonly').getAll();
      req.onsuccess = () => res(req.result);
    });
  },
  get(store, id) {
    return new Promise(res => {
      const req = this.op(store, 'readonly').get(id);
      req.onsuccess = () => res(req.result);
    });
  },
  put(store, data) {
    return new Promise((res, rej) => {
      const req = this.op(store, 'readwrite').put(data);
      req.onsuccess = () => res();
      req.onerror = () => rej();
    });
  },
  del(store, id) {
    return new Promise(res => {
      const req = this.op(store, 'readwrite').delete(id);
      req.onsuccess = () => res();
    });
  },
  async clearAll() {
    await this.op('posts', 'readwrite').clear();
    await this.op('templates', 'readwrite').clear();
    await this.op('media', 'readwrite').clear();
    await this.op('config', 'readwrite').clear();
  }
};

const S = {
  async posts() { return await DB.all('posts'); },
  async post(id) { return await DB.get('posts', id); },
  async savePost(p) { await DB.put('posts', p); },
  async delPost(id) { await DB.del('posts', id); },
  async tpls() { return await DB.all('templates'); },
  async tpl(id) { return await DB.get('templates', id); },
  async saveTpl(t) { await DB.put('templates', t); },
  async delTpl(id) { await DB.del('templates', id); },
  async media() { return await DB.all('media'); },
  async addMedia(m) { await DB.put('media', m); },
  async delMedia(id) { await DB.del('media', id); },
  async settings() {
    const s = await DB.get('config', 'settings');
    return s || { id: 'settings', notif: true, defPlat: ['instagram', 'twitter'] };
  },
  async saveSets(s) { s.id = 'settings'; await DB.put('config', s); },
  async migrateFromLocal() {
    const old = localStorage.getItem('sns_mp2');
    if (!old) return;
    try {
      const d = JSON.parse(old);
      for (const p of d.posts || []) await this.savePost(p);
      for (const t of d.templates || []) await this.saveTpl(t);
      for (const m of d.media || []) await this.addMedia(m);
      if (d.set) await this.saveSets(d.set);
      localStorage.removeItem('sns_mp2');
      console.log('Migration to IndexedDB complete.');
    } catch (e) { console.error('Migration failed', e); }
  }
};

// --- STRATEGIC ANALYTICS ---
function calcROI(p) {
  if (!p.analytics || !p.analytics.views) return 0;
  const eng = (p.analytics.likes || 0) + (p.analytics.comments || 0);
  return ((eng / p.analytics.views) * 100).toFixed(2);
}

// --- UTILS ---
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' }) : ''; }
function fmtTime(d) { return d ? new Date(d).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : ''; }
function fmtDT(d) { return d ? fmtDate(d) + ' ' + fmtTime(d) : ''; }
function esc(s) { const e = document.createElement('div'); e.textContent = s; return e.innerHTML; }
function toast(msg, type = 'info') { const c = document.getElementById('toast-container'), t = document.createElement('div'); t.className = `toast ${type} fade-in`; t.innerHTML = `<span class="toast-msg">${esc(msg)}</span><span class="toast-x" onclick="this.parentElement.remove()">✕</span>`; c.appendChild(t); setTimeout(() => t.remove(), 3500); }
function badges(pids) { return (pids || []).map(id => { const p = PLATFORMS.find(x => x.id === id); return p ? `<span class="badge ${p.id}">${p.icon} ${p.name}</span>` : '' }).join(''); }
function stBadge(s) { return `<span class="st ${s}">${{ draft: '下書き', scheduled: '予約済み', posted: '投稿済み' }[s] || s}</span>`; }

let page = 'dashboard', editing = null, selMedia = null, calDate = new Date(), qpTpl = null, qpMedia = null;

async function nav(p) { page = p; document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === p)); await render(); document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('active'); }
async function render() {
  const m = document.getElementById('main-content'); m.innerHTML = '<div style="display:flex;justify-content:center;padding:100px"><div class="stat-icon" style="animation: bounce 1s infinite">🚀</div></div>';
  m.className = 'main-content fade-in';
  const renderFn = { dashboard: pgDash, quickpost: pgQuick, create: pgCreate, media: pgMedia, posts: pgPosts, calendar: pgCal, templates: pgTpls, settings: pgSets }[page] || pgDash;
  await renderFn(m);
}

// === PAGES ===
async function pgDash(el) {
  const ps = await S.posts(), ms = await S.media();
  const sc = ps.filter(p => p.status === 'scheduled'), po = ps.filter(p => p.status === 'posted');
  const poSorted = po.sort((a, b) => parseFloat(calcROI(b)) - parseFloat(calcROI(a)));

  el.innerHTML = `
  <div class="page-hdr"><div><h1 class="page-title">🏠 ホーム</h1><p class="page-sub">堅牢な投稿管理システム</p></div><button class="btn btn-p" onclick="nav('quickpost')">⚡ クイック投稿</button></div>
  <div class="stats">
    <div class="stat"><div class="stat-icon">📋</div><div class="stat-val">${ps.length}</div><div class="stat-lbl">総投稿</div></div>
    <div class="stat"><div class="stat-icon">⏰</div><div class="stat-val">${sc.length}</div><div class="stat-lbl">予約中</div></div>
    <div class="stat"><div class="stat-icon">📁</div><div class="stat-val">${ms.length}</div><div class="stat-lbl">メディア</div></div>
    <div class="stat"><div class="stat-icon">🔥</div><div class="stat-val">${poSorted[0] ? calcROI(poSorted[0]) + '%' : '0%'}</div><div class="stat-lbl">最高反応率</div></div></div>
  <div class="dash-grid">
    <div><h2 class="sec-title">📅 本日の予定</h2><div class="card">${sc.length === 0 ? '<div class="empty"><p class="empty-d">予定はありません</p></div>' :
      sc.slice(0, 5).map(p => `<div class="dash-item" onclick="assist('${p.id}')"><span class="dash-time">${fmtTime(p.scheduledAt)}</span><div style="flex:1"><div class="ptitle">${esc(p.title)}</div></div>${stBadge(p.status)}</div>`).join('')}</div></div>
    <div><h2 class="sec-title">🏆 パフォーマンスTOP</h2><div class="card">${poSorted.length === 0 ? '<div class="empty"><p class="empty-d">分析データなし</p></div>' :
      poSorted.slice(0, 3).map(p => `<div class="dash-item"><div style="flex:1"><div class="ptitle" style="font-size:13px">${esc(p.title)}</div><div style="margin-top:2px">${badges(p.platforms)}</div></div><div style="text-align:right"><div style="font-size:16px;font-weight:800;color:var(--accent)">${calcROI(p)}%</div><div style="font-size:10px;color:var(--text3)">反応率</div></div></div>`).join('')}</div></div></div>`;
}

async function pgCreate(el) {
  const sets = await S.settings();
  const p = editing || { title: '', content: '', hashtags: '', platforms: sets.defPlat || [], status: 'draft', scheduledAt: '', driveLink: '', analytics: { views: 0, likes: 0, comments: 0 } };
  const isE = !!editing;
  el.innerHTML = `
  <div class="page-hdr"><div><h1 class="page-title">${isE ? '✏️ 編集' : '✏️ 新規作成'}</h1></div></div>
  <div class="cr-layout"><div class="cr-main">
    <div class="card"><div class="card-t">📱 投稿先</div><div class="plat-sel">${PLATFORMS.map(pl => `<div class="plat-btn ${p.platforms.includes(pl.id) ? 'on' : ''}" data-p="${pl.id}" onclick="this.classList.toggle('on')">${pl.icon} ${pl.name}</div>`).join('')}</div></div>
    <div class="card"><div class="card-t">✏️ 投稿内容</div>
      <div class="fg"><label class="fl">タイトル</label><input class="fi" id="f-title" value="${esc(p.title)}" placeholder="タイトル…"></div>
      <div class="fg"><label class="fl">テキスト</label><textarea class="ft" id="f-content" placeholder="投稿文…" oninput="updPrev()">${esc(p.content).trim()}</textarea></div>
      <div class="fg"><label class="fl">ハッシュタグ</label><input class="fi" id="f-hash" value="${esc(p.hashtags)}" placeholder="#example" oninput="updPrev()"></div></div>
    <div class="card"><div class="card-t">🎬 メディア</div>
      <div class="media-drop ${selMedia ? 'has' : ''}" onclick="document.getElementById('f-file').click()">
        <input type="file" id="f-file" accept="image/*,video/*" style="display:none" onchange="onFile(event)">
        ${selMedia ? `<div style="display:flex;align-items:center;gap:12px"><div class="pthumb">${selMedia.type === 'video' ? '🎬' : (selMedia.type === 'url' ? '🔗' : `<img src="${selMedia.url}">`)}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${esc(selMedia.name)}</div></div><button onclick="event.stopPropagation();selMedia=null;render()" style="color:var(--red);font-size:18px">✕</button></div>` :
      `<div style="font-size:32px">📤</div><p style="font-size:13px">アップロードまたはライブラリ選択 ↓</p>`}</div>
      <button class="btn btn-s btn-sm" style="margin-top:8px;width:100%" onclick="pickMedia()">📁 ライブラリから選択</button></div>
    <div class="card"><div class="card-t">⏰ スケジュール</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap"><div class="fg" style="flex:1"><label class="fl">日時</label><input type="datetime-local" class="fi" id="f-sched" value="${p.scheduledAt ? new Date(p.scheduledAt).toISOString().slice(0, 16) : ''}"></div>
        <div class="fg" style="flex:1"><label class="fl">状態</label><select class="fs" id="f-status"><option value="draft" ${p.status === 'draft' ? 'selected' : ''}>下書き</option><option value="scheduled" ${p.status === 'scheduled' ? 'selected' : ''}>予約</option><option value="posted" ${p.status === 'posted' ? 'selected' : ''}>完了</option></select></div></div></div>
    ${isE ? `<div class="card"><div class="card-t">📊 分析 / リンク</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px"><div class="fg"><label class="fl">👀 View</label><input type="number" class="fi" id="f-views" value="${p.analytics?.views || 0}"></div><div class="fg"><label class="fl">❤️ Like</label><input type="number" class="fi" id="f-likes" value="${p.analytics?.likes || 0}"></div><div class="fg"><label class="fl">💬 Comm</label><input type="number" class="fi" id="f-comments" value="${p.analytics?.comments || 0}"></div></div>
      <div class="fg"><label class="fl">🔗 Google Drive URL</label><input class="fi" id="f-drive" value="${esc(p.driveLink || '')}"></div></div>` : ''}
    <div style="display:flex;gap:10px">
      <button class="btn btn-p" onclick="saveP()">💾 ${isE ? '更新' : '保存'}</button>
      ${isE ? `<button class="btn btn-g" onclick="saveP().then(()=>assist('${editing.id}'))">🚀 保存→投稿</button>` : ''}
      <button class="btn btn-s" onclick="editing=null;selMedia=null;nav('posts')">戻る</button></div>
  </div>
  <div class="cr-side"><div class="prev-panel"><div class="prev-title">👁 プレビュー</div><div class="prev-frame">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div class="prev-avatar"></div><div class="prev-user">Your Name</div></div>
    <div class="prev-media" id="pv-media">${selMedia ? (selMedia.type === 'video' ? '🎬' : (selMedia.type === 'url' ? '🔗' : `<img src="${selMedia.url}">`)) : '📷'}</div>
    <div class="prev-text" id="pv-text">${esc(p.content) || 'Text here...'}</div><div class="prev-hash" id="pv-hash">${esc(p.hashtags)}</div>
  </div></div></div></div>`;
}

async function saveP() {
  const plats = Array.from(document.querySelectorAll('.plat-btn.on')).map(el => el.dataset.p);
  if (!plats.length) { toast('投稿先を選んでください', 'warning'); return; }
  const sched = document.getElementById('f-sched').value ? new Date(document.getElementById('f-sched').value).toISOString() : '';
  const an = { views: parseInt(document.getElementById('f-views')?.value) || 0, likes: parseInt(document.getElementById('f-likes')?.value) || 0, comments: parseInt(document.getElementById('f-comments')?.value) || 0 };
  const post = { id: editing?.id || uid(), title: document.getElementById('f-title').value || '無題', content: document.getElementById('f-content').value, hashtags: document.getElementById('f-hash').value, platforms: plats, status: document.getElementById('f-status').value, scheduledAt: sched, driveLink: document.getElementById('f-drive')?.value || '', mediaData: selMedia, analytics: an, updatedAt: new Date().toISOString(), createdAt: editing?.createdAt || new Date().toISOString() };
  await S.savePost(post); toast('保存完了', 'success'); editing = null; selMedia = null; await nav('posts');
}

async function pgPosts(el) {
  const ps = await S.posts();
  el.innerHTML = `<div class="page-hdr"><h1 class="page-title">📋 投稿一覧</h1><div style="display:flex;gap:8px"><button class="btn btn-s" onclick="exportCSV()">📊 CSV</button><button class="btn btn-p" onclick="nav('create')">✏️ 新規</button></div></div>
  <div class="filters"><div class="search-wrap"><input class="search-i" id="s-q" placeholder="検索…" oninput="filterP()"></div><select class="filter-sel" id="s-st" onchange="filterP()"><option value="">すべて</option><option value="draft">下書き</option><option value="scheduled">予約中</option><option value="posted">完了</option></select></div>
  <div class="plist" id="plist"></div>`;
  await filterP();
}

async function filterP() {
  const q = document.getElementById('s-q')?.value.toLowerCase() || '', st = document.getElementById('s-st')?.value || '';
  let ps = await S.posts();
  if (q) ps = ps.filter(p => (p.title + p.content + p.hashtags).toLowerCase().includes(q));
  if (st) ps = ps.filter(p => p.status === st);
  const list = document.getElementById('plist');
  if (!ps.length) { list.innerHTML = '<div class="empty">投稿なし</div>'; return; }
  list.innerHTML = ps.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(p => `
    <div class="pitem" onclick="editP('${p.id}')">
      <div class="pthumb">${p.mediaData ? (p.mediaData.type === 'video' ? '🎬' : (p.mediaData.type === 'url' ? '🔗' : `<img src="${p.mediaData.url}">`)) : '📄'}</div>
      <div class="pinfo"><div class="ptitle">${esc(p.title)}</div><div class="pexcerpt">${esc(p.content)}</div><div class="pmeta">${stBadge(p.status)}<span class="pdate">${fmtDT(p.scheduledAt) || '未設定'}</span></div><div style="margin-top:4px">${badges(p.platforms)}</div></div>
      <div class="pacts"><button class="btn btn-sm btn-p" onclick="event.stopPropagation();assist('${p.id}')">🚀</button><button class="btn btn-sm btn-d" onclick="event.stopPropagation();delP('${p.id}')">🗑</button></div></div>`).join('');
}
async function delP(id) { if (confirm('削除しますか？')) { await S.delPost(id); toast('削除しました', 'success'); await render(); } }
async function editP(id) { editing = await S.post(id); selMedia = editing?.mediaData; await nav('create'); }

async function assist(id) {
  const p = await S.post(id); if (!p) return;
  const txt = [p.content, p.hashtags].filter(Boolean).join('\n\n');
  const ov = document.getElementById('modal-overlay'), mc = document.getElementById('modal-content'); ov.classList.remove('hidden');
  const er = calcROI(p);
  mc.innerHTML = `
    <div class="modal-hdr"><h2 class="modal-t">🚀 投稿アシスト</h2><button class="btn-icon" onclick="closeM()">✕</button></div>
    <div style="margin-bottom:16px;padding:12px;background:var(--bg3);border-radius:12px;border-left:4px solid var(--accent)">
      <div style="font-size:11px;color:var(--text3);font-weight:800">STRATEGIC PREVIEW</div>
      <div style="font-size:14px;font-weight:700;margin-top:4px">${p.title}</div>
      <div style="font-size:11px;color:var(--accent);margin-top:2px">過去の反応率傾向から：${er > 5 ? '🔥 好調(High)' : '🧊 標準(Normal)'} (${er}%)</div></div>
    <button class="btn btn-p" style="width:100%;padding:14px;margin-bottom:12px" onclick="copyText('${id}')">📋 全文コピーしてSNSへ</button>
    <div style="display:flex;flex-direction:column;gap:8px">${p.platforms.map(pid => {
    const pl = PLATFORMS.find(x => x.id === pid);
    return `<button class="btn btn-s" style="width:100%" onclick="window.open('${pl.url}','_blank')">${pl.icon} ${pl.name} を開く</button>`;
  }).join('')}</div>
    ${(p.driveLink || (p.mediaData && p.mediaData.type === 'url')) ? `<a href="${esc(p.driveLink || p.mediaData.url)}" target="_blank" class="btn btn-g" style="width:100%;margin-top:8px;justify-content:center">📁 Google Drive Media</a>` : ''}
    <div style="margin-top:20px;padding:14px;background:#fff9e6;border-radius:12px;border:1px solid #ffeeba">
      <div style="font-size:11px;font-weight:800;color:#856404;margin-bottom:8px">⚠️ ワークフロー防御（ヒューマンエラー防止）</div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="chk-posted"> 実際に正しく投稿したことを確認しました</label></div>
    <div class="modal-ftr"><button class="btn btn-g" onclick="confirmPosted('${id}')">✅ 投稿完了としてマーク</button></div>`;
}
async function confirmPosted(id) {
  if (!document.getElementById('chk-posted').checked) { toast('確認チェックを入れてください', 'warning'); return; }
  const p = await S.post(id); p.status = 'posted'; p.updatedAt = new Date().toISOString(); await S.savePost(p); toast('ステータスを更新しました', 'success'); closeM(); await render();
}
function closeM() { document.getElementById('modal-overlay').classList.add('hidden'); }
async function copyText(id) {
  const p = await S.post(id); const t = [p.content, p.hashtags].filter(Boolean).join('\n\n');
  navigator.clipboard.writeText(t).then(() => toast('📋 コピー完了！', 'success'));
}

async function pgMedia(el) {
  const ms = await S.media();
  el.innerHTML = `<div class="page-hdr"><h1 class="page-title">📁 メディア</h1><div style="display:flex;gap:8px"><button class="btn btn-s" onclick="addMediaURL()">🔗 URL追加</button><button class="btn btn-p" onclick="document.getElementById('m-in').click()">📤 UP</button></div><input type="file" id="m-in" style="display:none" onchange="uploadM(event)"></div>
  <div class="mgrid">${ms.map(m => `<div class="mitem"><div class="mitem-del" onclick="delM('${m.id}')">✕</div><div class="mitem-prev">${m.type === 'video' ? '🎬' : (m.type === 'url' ? '🔗' : `<img src="${m.url}">`)}</div><div class="mitem-info"><div class="mitem-name">${esc(m.name)}</div></div></div>`).join('')}</div>`;
}
async function uploadM(e) {
  for (const f of e.target.files) {
    const r = new FileReader(); r.onload = async ev => { await S.addMedia({ id: uid(), name: f.name, type: f.type.startsWith('image') ? 'image' : 'video', url: ev.target.result }); await render(); }; r.readAsDataURL(f);
  }
}
async function addMediaURL() { const u = prompt('Drive共有URLなど:'); if (u) { await S.addMedia({ id: uid(), name: 'Drive Link', type: 'url', url: u }); await render(); } }
async function delM(id) { if (confirm('削除？')) { await S.delMedia(id); await render(); } }

async function pgQuick(el) {
  const ts = await S.tpls();
  el.innerHTML = `<div class="page-hdr"><h1 class="page-title">⚡ クイック投稿</h1></div>
    <div class="qsteps"><div class="qstep"><div class="qstep-hdr"><div class="qstep-num">1</div><div class="qstep-t">テンプレ選択</div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${ts.map(t => `<button class="btn btn-s" onclick="useQ('${t.id}')">${esc(t.name)}</button>`).join('')}</div></div></div>`;
}
async function useQ(id) { const t = await S.tpl(id); editing = { ...t, id: undefined, status: 'scheduled', scheduledAt: new Date().toISOString() }; await nav('create'); }

async function pgCal(el) { el.innerHTML = '<div class="page-hdr"><h1 class="page-title">📅 カレンダー</h1></div><div class="cal-wrap"><p style="padding:40px;text-align:center;color:var(--text3)">堅牢性向上のため、データベース同期中...</p></div>'; setTimeout(() => renderCal(el), 300); }
async function renderCal(el) {
  const y = calDate.getFullYear(), m = calDate.getMonth(), fd = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate(), ps = await S.posts();
  let cells = Array.from({ length: fd }, (_, i) => '<div class="cal-d other"></div>').join('');
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dp = ps.filter(p => p.scheduledAt?.startsWith(ds));
    cells += `<div class="cal-d" onclick="nav('create');setTimeout(()=>document.getElementById('f-sched').value='${ds}T12:00',100)"><span class="cal-dn">${d}</span>${dp.slice(0, 2).map(p => `<div class="cal-ev ${p.status}" style="font-size:8px">${esc(p.title.slice(0, 4))}</div>`).join('')}</div>`;
  }
  el.innerHTML = `<div class="page-hdr"><h1 class="page-title">📅 カレンダー</h1></div><div class="cal-wrap"><div class="cal-hdr"><button onclick="calDate.setMonth(calDate.getMonth()-1);render()">◀</button><span>${y}年${m + 1}月</span><button onclick="calDate.setMonth(calDate.getMonth()+1);render()">▶</button></div><div class="cal-grid">${cells}</div></div>`;
}

async function pgTpls(el) {
  const ts = await S.tpls();
  el.innerHTML = `<div class="page-hdr"><h1 class="page-title">📄 テンプレート</h1></div><div class="tgrid">${ts.map(t => `<div class="tcard" onclick="editT('${t.id}')"><div class="tcard-hdr"><div class="tcard-n">${esc(t.name)}</div><button class="btn-icon" onclick="event.stopPropagation();delT('${t.id}')">🗑</button></div><div class="tcard-c">${esc(t.content)}</div></div>`).join('')}</div>`;
}
async function delT(id) { await S.delTpl(id); await render(); }
async function editT(id) { const t = await S.tpl(id); editing = { ...t, id: undefined, status: 'draft' }; await nav('create'); }

async function pgSets(el) {
  const s = await S.settings();
  el.innerHTML = `<div class="page-hdr"><h1 class="page-title">⚙️ 設定</h1></div><div class="set-card">
    <div class="set-item"><div>通知</div><label class="tog"><input type="checkbox" ${s.notif ? 'checked' : ''} onchange="updSet('notif',this.checked)"><span class="tog-s"></span></label></div>
    <div class="set-item"><div>データバックアップ</div><button class="btn btn-s btn-sm" onclick="expJSON()">JSON出力</button></div>
    <div class="set-item"><div>全削除</div><button class="btn btn-d btn-sm" onclick="clearDB()">リセット</button></div></div>`;
}
async function updSet(k, v) { const s = await S.settings(); s[k] = v; await S.saveSets(s); toast('設定を更新', 'info'); }
async function clearDB() { if (confirm('全データを完全に削除しますか？')) { await DB.clearAll(); location.reload(); } }

async function exportCSV() {
  const ps = await S.posts();
  const h = 'Title,Text,Status,ROI,EngCount\n';
  const r = ps.map(p => `${p.title},"${p.content.replace(/"/g, '""')}",${p.status},${calcROI(p)}%,${(p.analytics?.likes || 0) + (p.analytics?.comments || 0)}`).join('\n');
  const b = new Blob(['\uFEFF' + h + r], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'sns_mp_strategy.csv'; a.click();
}

async function pickMedia() {
  const ms = await S.media();
  const ov = document.getElementById('modal-overlay'), mc = document.getElementById('modal-content'); ov.classList.remove('hidden');
  mc.innerHTML = `<div class="modal-hdr"><h2 class="modal-t">メディア選択</h2><button class="btn-icon" onclick="closeM()">✕</button></div>
    <div class="mgrid">${ms.map(m => `<div class="mitem" onclick="selM('${m.id}')"><div class="mitem-prev">${m.type === 'video' ? '🎬' : (m.type === 'url' ? '🔗' : `<img src="${m.url}">`)}</div><div class="mitem-info">${esc(m.name)}</div></div>`).join('')}</div>`;
}
async function selM(id) { const m = (await S.media()).find(x => x.id === id); selMedia = m; closeM(); await render(); }

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
  await DB.init();
  await S.migrateFromLocal();
  document.querySelectorAll('.nav-item').forEach(el => el.addEventListener('click', e => { e.preventDefault(); nav(el.dataset.page); }));
  document.getElementById('menu-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.add('open'));
  document.getElementById('sidebar-close').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));
  await nav('dashboard');
});
