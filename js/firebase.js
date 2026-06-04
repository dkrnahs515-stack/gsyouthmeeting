/* Firebase Realtime Database 연동 + 보조 기능 로더 */
import './print-layout.js';
import './copy-prev-to-next.js';
import './import-meeting.js';
import './pdf-preview-fix.js';
import './month-calendar.js';
import './calendar-jump.js';
import './program-item-extensions.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, remove, onValue, child } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfXblNiQcJbaXdmHWZWK-mp30vCLubMuw",
  authDomain: "gsyouthmeeting.firebaseapp.com",
  projectId: "gsyouthmeeting",
  storageBucket: "gsyouthmeeting.firebasestorage.app",
  messagingSenderId: "489440162330",
  appId: "1:489440162330:web:68f26ac56735d5b9a797a3",
  databaseURL: "https://gsyouthmeeting-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);
let saveTimer = null;

onValue(ref(db, '.info/connected'), snap => updateSyncBadge(snap.val() ? 'connected' : 'offline'));

const safe = obj => JSON.parse(JSON.stringify(obj, (k, v) => v === undefined ? null : v));
const esc = v => typeof escHtml === 'function' ? escHtml(v || '') : String(v || '').replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
const getLS = key => { try { return localStorage.getItem(key) || ''; } catch(e) { return ''; } };
const setLS = (key, val) => { try { localStorage.setItem(key, val || ''); } catch(e) {} };

function historyId(year, month) {
  return `history_${year}_${String(month).padStart(2, '0')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function injectHistoryStyle() {
  if (document.getElementById('author-history-style')) return;
  const style = document.createElement('style');
  style.id = 'author-history-style';
  style.textContent = `
    .author-input-wrap{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:10px;background:#f8fafc;border:1.5px solid #e2e8f0;margin-right:6px;white-space:nowrap}.revision-memo-wrap{min-width:260px}.author-input-label{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:#475569}.author-input{width:96px;border:none;outline:none;background:transparent;font-family:inherit;font-size:13px;font-weight:700;color:#1e293b}.revision-memo-input{width:180px;font-weight:600}.author-input::placeholder{color:#94a3b8;font-weight:500}.history-author-badge,.history-memo-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;margin-right:6px;margin-bottom:3px}.history-author-badge{background:#eef6ff;color:#1a4a8a}.history-memo-badge{background:#fff7ed;color:#c2410c;border:1px solid rgba(217,119,6,.18);max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}.history-filter-box{background:#fff;border:1.5px solid #e2e8f0;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);padding:16px 20px;margin:16px 0 14px}.history-filter-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.history-filter-field{display:flex;align-items:center;gap:10px;flex:1;min-width:260px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:9px 12px}.history-filter-field span{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:800;color:#1a4a8a;white-space:nowrap}.history-filter-field input{flex:1;min-width:120px;border:none;outline:none;background:transparent;font-family:inherit;font-size:14px;font-weight:600;color:#1e293b}.btn-history-filter-reset{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:10px;padding:10px 16px;background:#f1f5f9;color:#475569;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer}.btn-history-filter-reset:hover{background:#1a4a8a;color:#fff}.history-filter-count{margin-top:9px;font-size:12px;font-weight:600;color:#64748b}@media(max-width:900px){.preview-actions{flex-wrap:wrap;justify-content:flex-end}.author-input-wrap,.revision-memo-wrap{width:100%;justify-content:flex-start;margin-right:0}.author-input,.revision-memo-input{width:100%}}
  `;
  document.head.appendChild(style);
}

function injectSaveInputs() {
  const actions = document.querySelector('.preview-actions');
  if (!actions) return;
  const saveBtn = actions.querySelector('.btn-save-meeting');
  if (!document.getElementById('meeting-author')) {
    const wrap = document.createElement('label');
    wrap.className = 'author-input-wrap';
    wrap.innerHTML = `<span class="author-input-label"><i class="fas fa-user-pen"></i> 작성자</span><input type="text" id="meeting-author" class="author-input" placeholder="작성자명" value="${esc(getLS('kgyc_author_name'))}">`;
    saveBtn ? actions.insertBefore(wrap, saveBtn) : actions.prepend(wrap);
    wrap.querySelector('input').addEventListener('input', e => setLS('kgyc_author_name', e.target.value.trim()));
  }
  if (!document.getElementById('meeting-revision-memo')) {
    const wrap = document.createElement('label');
    wrap.className = 'author-input-wrap revision-memo-wrap';
    wrap.innerHTML = `<span class="author-input-label"><i class="fas fa-pen-to-square"></i> 수정 메모</span><input type="text" id="meeting-revision-memo" class="author-input revision-memo-input" placeholder="예: 6월 일정 수정" value="${esc(getLS('kgyc_revision_memo'))}">`;
    saveBtn ? actions.insertBefore(wrap, saveBtn) : actions.appendChild(wrap);
    wrap.querySelector('input').addEventListener('input', e => setLS('kgyc_revision_memo', e.target.value.trim()));
  }
}

function injectHistoryFilter() {
  const header = document.querySelector('#page-history .history-header');
  if (!header || document.getElementById('history-filter-box')) return;
  const box = document.createElement('div');
  box.id = 'history-filter-box';
  box.className = 'history-filter-box';
  box.innerHTML = `<div class="history-filter-main"><label class="history-filter-field"><span><i class="fas fa-user-magnifying-glass"></i> 작성자 검색</span><input type="text" id="history-author-filter" placeholder="작성자명을 입력하세요"></label><button type="button" class="btn-history-filter-reset" id="history-filter-reset"><i class="fas fa-rotate-left"></i> 초기화</button></div><div class="history-filter-count" id="history-filter-count">전체 회의 이력을 불러오는 중입니다.</div>`;
  header.insertAdjacentElement('afterend', box);
  box.querySelector('#history-author-filter').addEventListener('input', renderHistoryList);
  box.querySelector('#history-filter-reset').addEventListener('click', () => { box.querySelector('#history-author-filter').value = ''; renderHistoryList(); });
}

function initHistoryUI() { injectHistoryStyle(); injectSaveInputs(); injectHistoryFilter(); }

function getAuthor() {
  initHistoryUI();
  let author = document.getElementById('meeting-author')?.value.trim() || getLS('kgyc_author_name').trim();
  if (!author) author = prompt('작성자명을 입력해주세요.', '')?.trim() || '';
  if (!author) { showToast?.('⚠️ 작성자명을 입력해야 저장할 수 있습니다.'); document.getElementById('meeting-author')?.focus(); return null; }
  document.getElementById('meeting-author').value = author;
  setLS('kgyc_author_name', author);
  return author;
}

function autoSave() {
  try { localStorage.setItem('kgyc_draft', JSON.stringify(collectData())); } catch(e) {}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    updateSyncBadge('saving');
    try { await set(ref(db, 'draft'), safe(collectData())); updateSyncBadge('saved'); }
    catch(e) { console.warn('[Firebase] 자동저장 실패:', e); updateSyncBadge('error'); }
  }, 1000);
}

async function loadFromLocalStorage() {
  initHistoryUI();
  try {
    const snap = await get(child(ref(db), 'draft'));
    if (snap.exists()) { restoreData(snap.val()); initHistoryUI(); showToast?.('☁️ 클라우드에서 최신 데이터를 불러왔습니다.'); return; }
  } catch(e) { console.warn('[Firebase] 초기 로드 실패, localStorage fallback:', e); }
  try { const raw = localStorage.getItem('kgyc_draft'); if (raw) { restoreData(JSON.parse(raw)); initHistoryUI(); showToast?.('💾 로컬 저장 데이터를 불러왔습니다.'); } } catch(e) {}
}

function addLocal(record) {
  try { const list = JSON.parse(localStorage.getItem('kgyc_history') || '[]'); if (!list.some(x => x.id === record.id)) list.unshift(record); localStorage.setItem('kgyc_history', JSON.stringify(list)); } catch(e) {}
}
function removeLocal(record) {
  try { const list = JSON.parse(localStorage.getItem('kgyc_history') || '[]').filter(x => x.id !== record.id); localStorage.setItem('kgyc_history', JSON.stringify(list)); } catch(e) {}
}

async function saveMeeting() {
  const author = getAuthor(); if (!author) return;
  const revisionMemo = document.getElementById('meeting-revision-memo')?.value.trim() || '';
  setLS('kgyc_revision_memo', revisionMemo);
  const d = collectData(); const now = new Date(); const key = historyId(d.year, d.month);
  const record = { id:key, title:`${d.year}년 ${d.month}월 전체회의`, author, revisionMemo, year:d.year, month:d.month, savedAt:now.toLocaleString('ko-KR'), savedAtMs:now.getTime(), data:d };
  updateSyncBadge('saving');
  try { await set(ref(db, `history/${key}`), safe(record)); updateSyncBadge('saved'); showToast?.(`✅ ${author} 작성자로 회의자료가 누적 저장되었습니다!`); }
  catch(e) { console.warn('[Firebase] 회의 저장 실패:', e); updateSyncBadge('error'); showToast?.('💾 로컬에 저장되었습니다 (클라우드 동기화 실패).'); }
  addLocal(record);
  try { localStorage.removeItem('kgyc_revision_memo'); } catch(e) {}
  const memo = document.getElementById('meeting-revision-memo'); if (memo) memo.value = '';
  refreshHistory();
}

async function refreshHistory() {
  initHistoryUI();
  const list = document.getElementById('history-list'); if (!list) return;
  list.innerHTML = `<div class="empty-state sync-loading"><i class="fas fa-circle-notch fa-spin"></i><p>회의 이력을 불러오는 중…</p></div>`;
  let records = [];
  try { const snap = await get(ref(db, 'history')); if (snap.exists()) records = Object.values(snap.val()); }
  catch(e) { try { records = JSON.parse(localStorage.getItem('kgyc_history') || '[]'); } catch(_) {} }
  records.sort((a,b) => (Number(b.savedAtMs)||0) - (Number(a.savedAtMs)||0));
  window._fbHistoryAllRecords = records;
  renderHistoryList();
}

function renderHistoryList() {
  const list = document.getElementById('history-list'); if (!list) return;
  initHistoryUI();
  const all = window._fbHistoryAllRecords || [];
  const keyword = (document.getElementById('history-author-filter')?.value || '').trim().toLowerCase();
  const records = keyword ? all.filter(x => String(x.author || '').toLowerCase().includes(keyword)) : all;
  window._fbHistoryCache = records;
  const count = document.getElementById('history-filter-count');
  if (count) count.textContent = keyword ? `작성자 “${document.getElementById('history-author-filter').value.trim()}” 검색 결과 ${records.length}건 / 전체 ${all.length}건` : `전체 회의 이력 ${all.length}건`;
  if (!all.length) { list.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>저장된 회의 자료가 없습니다.</p></div>`; return; }
  if (!records.length) { list.innerHTML = `<div class="empty-state"><i class="fas fa-user-magnifying-glass"></i><p>해당 작성자의 저장 이력이 없습니다.</p></div>`; return; }
  list.innerHTML = records.map((s,i) => `<div class="history-card"><div class="history-card-icon"><i class="fas fa-file-alt"></i></div><div class="history-card-body"><div class="history-card-title">${esc(s.title)}</div><div class="history-card-meta"><span class="history-author-badge"><i class="fas fa-user-pen"></i> 작성자: ${esc(s.author || '미입력')}</span><span class="history-memo-badge" title="${esc(s.revisionMemo || '')}"><i class="fas fa-pen-to-square"></i> 수정 메모: ${esc(s.revisionMemo || '없음')}</span><i class="fas fa-cloud" style="color:#2a67c0;margin-right:4px;font-size:10px;"></i>저장일시: ${esc(s.savedAt || '-')} · 장소: ${esc(s.data?.place || '-')}</div></div><div class="history-card-actions"><button class="btn-hist-load" onclick="loadHistRecord(${i})"><i class="fas fa-folder-open"></i> 불러오기</button><button class="btn-hist-del" onclick="deleteHistRecord(${i})"><i class="fas fa-trash"></i></button></div></div>`).join('');
}

function loadHistRecord(idx) {
  const records = window._fbHistoryCache || []; if (!records[idx]) return;
  restoreData(records[idx].data); autoSave(); showPage('input'); goStep('info'); showToast?.(`📂 "${records[idx].title}" 자료를 불러왔습니다. 작성자: ${records[idx].author || '미입력'}`);
}
async function deleteHistRecord(idx) {
  const records = window._fbHistoryCache || []; const record = records[idx]; if (!record) return;
  if (!confirm(`"${record.title}"을 삭제할까요?\n작성자: ${record.author || '미입력'}\n수정 메모: ${record.revisionMemo || '없음'}\n저장일시: ${record.savedAt || '-'}`)) return;
  try { await remove(ref(db, `history/${record.id}`)); } catch(e) { console.warn('[Firebase] 이력 삭제 실패:', e); }
  removeLocal(record); refreshHistory(); showToast?.('🗑️ 삭제되었습니다.');
}

function updateSyncBadge(state) {
  const badge = document.getElementById('sync-badge'); if (!badge) return;
  const map = { connected:['fa-cloud-arrow-up','클라우드 연결됨','sync-ok'], saving:['fa-circle-notch fa-spin','저장 중…','sync-saving'], saved:['fa-circle-check','☁️ 저장됨','sync-ok'], offline:['fa-cloud-slash','오프라인','sync-offline'], error:['fa-triangle-exclamation','동기화 오류','sync-error'] };
  const cfg = map[state] || map.offline;
  badge.className = `sync-badge ${cfg[2]}`; badge.innerHTML = `<i class="fas ${cfg[0]}"></i> ${cfg[1]}`;
}

document.addEventListener('DOMContentLoaded', initHistoryUI);
window.addEventListener('load', initHistoryUI);
window.autoSave = autoSave;
window.loadFromLocalStorage = loadFromLocalStorage;
window.saveMeeting = saveMeeting;
window.refreshHistory = refreshHistory;
window.loadHistRecord = loadHistRecord;
window.deleteHistRecord = deleteHistRecord;
