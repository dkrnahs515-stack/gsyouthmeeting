/* ============================================================
   강서청소년회관 전체회의 시스템 - Firebase Realtime Database 연동
   ============================================================
   - 자동저장(draft) → Firebase RTDB /draft 경로
   - 회의 이력(history) → Firebase RTDB /history 경로
   - 회의 이력은 저장 시점별 고유 ID로 누적 저장
   - 작성자명과 수정 메모를 입력·저장하고 회의 이력에서 확인 가능
   - 회의 이력에서 작성자명 검색/필터링 가능
   - localStorage를 완전히 대체 (오프라인 fallback 포함)
   ============================================================ */

import './print-layout.js';
import './copy-prev-to-next.js';
import './import-meeting.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, remove, onValue, child }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCfXblNiQcJbaXdmHWZWK-mp30vCLubMuw",
  authDomain:        "gsyouthmeeting.firebaseapp.com",
  projectId:         "gsyouthmeeting",
  storageBucket:     "gsyouthmeeting.firebasestorage.app",
  messagingSenderId: "489440162330",
  appId:             "1:489440162330:web:68f26ac56735d5b9a797a3",
  databaseURL:       "https://gsyouthmeeting-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);
let fbReady = false;
let saveTimer = null;

onValue(ref(db, '.info/connected'), snap => {
  fbReady = !!snap.val();
  updateSyncBadge(fbReady ? 'connected' : 'offline');
});

function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => v === undefined ? null : v));
}

function createHistoryId(year, month) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return `history_${year}_${String(month).padStart(2, '0')}_${ts}_${rand}`;
}

function getStoredAuthorName() {
  try { return localStorage.getItem('kgyc_author_name') || ''; } catch(e) { return ''; }
}
function setStoredAuthorName(name) {
  try { localStorage.setItem('kgyc_author_name', name || ''); } catch(e) {}
}
function getStoredRevisionMemo() {
  try { return localStorage.getItem('kgyc_revision_memo') || ''; } catch(e) { return ''; }
}
function setStoredRevisionMemo(memo) {
  try { localStorage.setItem('kgyc_revision_memo', memo || ''); } catch(e) {}
}
function clearStoredRevisionMemo() {
  try { localStorage.removeItem('kgyc_revision_memo'); } catch(e) {}
}

function injectHistoryStyle() {
  if (document.getElementById('author-history-style')) return;
  const style = document.createElement('style');
  style.id = 'author-history-style';
  style.textContent = `
    .author-input-wrap {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 10px;
      border-radius: 10px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      margin-right: 6px;
      white-space: nowrap;
    }
    .revision-memo-wrap { min-width: 260px; }
    .author-input-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
    }
    .author-input {
      width: 96px;
      border: none;
      outline: none;
      background: transparent;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }
    .revision-memo-input { width: 180px; font-weight: 600; }
    .author-input::placeholder { color: #94a3b8; font-weight: 500; }
    .history-author-badge,
    .history-memo-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 700;
      margin-right: 6px;
      margin-bottom: 3px;
    }
    .history-author-badge { background: #eef6ff; color: #1a4a8a; }
    .history-memo-badge {
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid rgba(217,119,6,.18);
      max-width: 420px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }
    .history-filter-box {
      background: #fff;
      border: 1.5px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      padding: 16px 20px;
      margin: 16px 0 14px;
    }
    .history-filter-main {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .history-filter-field {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 260px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 9px 12px;
    }
    .history-filter-field span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      font-weight: 800;
      color: #1a4a8a;
      white-space: nowrap;
    }
    .history-filter-field input {
      flex: 1;
      min-width: 120px;
      border: none;
      outline: none;
      background: transparent;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
    .history-filter-field input::placeholder { color: #94a3b8; font-weight: 500; }
    .btn-history-filter-reset {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: none;
      border-radius: 10px;
      padding: 10px 16px;
      background: #f1f5f9;
      color: #475569;
      font-family: inherit;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      transition: background .15s, color .15s;
    }
    .btn-history-filter-reset:hover { background: #1a4a8a; color: #fff; }
    .history-filter-count {
      margin-top: 9px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }
    @media (max-width: 900px) {
      .preview-actions { flex-wrap: wrap; justify-content: flex-end; }
      .author-input-wrap, .revision-memo-wrap {
        width: 100%;
        justify-content: flex-start;
        margin-right: 0;
      }
      .author-input, .revision-memo-input { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

function injectSaveMetaInputs() {
  const actions = document.querySelector('.preview-actions');
  if (!actions) return;
  const saveBtn = actions.querySelector('.btn-save-meeting');

  if (!document.getElementById('meeting-author')) {
    const authorWrap = document.createElement('label');
    authorWrap.className = 'author-input-wrap';
    authorWrap.innerHTML = `
      <span class="author-input-label"><i class="fas fa-user-pen"></i> 작성자</span>
      <input type="text" id="meeting-author" class="author-input" placeholder="작성자명" value="${escHtml(getStoredAuthorName())}">
    `;
    if (saveBtn) actions.insertBefore(authorWrap, saveBtn); else actions.prepend(authorWrap);
    const authorInput = authorWrap.querySelector('#meeting-author');
    authorInput.addEventListener('input', () => setStoredAuthorName(authorInput.value.trim()));
  }

  if (!document.getElementById('meeting-revision-memo')) {
    const memoWrap = document.createElement('label');
    memoWrap.className = 'author-input-wrap revision-memo-wrap';
    memoWrap.innerHTML = `
      <span class="author-input-label"><i class="fas fa-pen-to-square"></i> 수정 메모</span>
      <input type="text" id="meeting-revision-memo" class="author-input revision-memo-input" placeholder="예: 6월 일정 수정" value="${escHtml(getStoredRevisionMemo())}">
    `;
    if (saveBtn) actions.insertBefore(memoWrap, saveBtn); else actions.appendChild(memoWrap);
    const memoInput = memoWrap.querySelector('#meeting-revision-memo');
    memoInput.addEventListener('input', () => setStoredRevisionMemo(memoInput.value.trim()));
  }
}

function injectHistoryFilter() {
  const historyHeader = document.querySelector('#page-history .history-header');
  if (!historyHeader || document.getElementById('history-filter-box')) return;
  const box = document.createElement('div');
  box.id = 'history-filter-box';
  box.className = 'history-filter-box';
  box.innerHTML = `
    <div class="history-filter-main">
      <label class="history-filter-field">
        <span><i class="fas fa-user-magnifying-glass"></i> 작성자 검색</span>
        <input type="text" id="history-author-filter" placeholder="작성자명을 입력하세요">
      </label>
      <button type="button" class="btn-history-filter-reset" id="history-filter-reset">
        <i class="fas fa-rotate-left"></i> 초기화
      </button>
    </div>
    <div class="history-filter-count" id="history-filter-count">전체 회의 이력을 불러오는 중입니다.</div>
  `;
  historyHeader.insertAdjacentElement('afterend', box);
  box.querySelector('#history-author-filter').addEventListener('input', renderHistoryList);
  box.querySelector('#history-filter-reset').addEventListener('click', () => {
    const input = document.getElementById('history-author-filter');
    input.value = '';
    renderHistoryList();
    input.focus();
  });
}

function initHistoryUI() {
  injectHistoryStyle();
  injectSaveMetaInputs();
  injectHistoryFilter();
}

function getAuthorNameForSave() {
  initHistoryUI();
  let author = document.getElementById('meeting-author')?.value.trim() || getStoredAuthorName().trim();
  if (!author) author = prompt('작성자명을 입력해주세요.', '')?.trim() || '';
  if (!author) {
    showToast('⚠️ 작성자명을 입력해야 저장할 수 있습니다.');
    document.getElementById('meeting-author')?.focus();
    return null;
  }
  const input = document.getElementById('meeting-author');
  if (input) input.value = author;
  setStoredAuthorName(author);
  return author;
}

function getRevisionMemoForSave() {
  initHistoryUI();
  const memo = document.getElementById('meeting-revision-memo')?.value.trim() || '';
  setStoredRevisionMemo(memo);
  return memo;
}

function addLocalHistoryRecord(record) {
  try {
    const saved = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
    const exists = saved.some(s => s.id === record.id);
    if (!exists) saved.unshift(record);
    localStorage.setItem('kgyc_history', JSON.stringify(saved));
  } catch(e) {}
}

function removeLocalHistoryRecord(record) {
  try {
    const saved = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
    const filtered = saved.filter(s => {
      if (record.id && s.id) return s.id !== record.id;
      return !(s.year === record.year && s.month === record.month && s.savedAt === record.savedAt);
    });
    localStorage.setItem('kgyc_history', JSON.stringify(filtered));
  } catch(e) {}
}

function getHistoryFilterAuthor() {
  return (document.getElementById('history-author-filter')?.value || '').trim().toLowerCase();
}

function renderHistoryList() {
  const list = document.getElementById('history-list');
  if (!list) return;
  initHistoryUI();
  const allRecords = window._fbHistoryAllRecords || [];
  const keyword = getHistoryFilterAuthor();
  const filteredRecords = keyword
    ? allRecords.filter(s => String(s.author || '').toLowerCase().includes(keyword))
    : allRecords;
  window._fbHistoryCache = filteredRecords;

  const countEl = document.getElementById('history-filter-count');
  if (countEl) {
    const rawKeyword = document.getElementById('history-author-filter')?.value.trim() || '';
    countEl.textContent = keyword
      ? `작성자 “${rawKeyword}” 검색 결과 ${filteredRecords.length}건 / 전체 ${allRecords.length}건`
      : `전체 회의 이력 ${allRecords.length}건`;
  }

  if (!allRecords.length) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>저장된 회의 자료가 없습니다.</p></div>`;
    return;
  }
  if (!filteredRecords.length) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-user-magnifying-glass"></i><p>해당 작성자의 저장 이력이 없습니다.</p></div>`;
    return;
  }

  list.innerHTML = filteredRecords.map((s, i) => {
    const memo = s.revisionMemo || s.memo || '';
    return `
      <div class="history-card">
        <div class="history-card-icon"><i class="fas fa-file-alt"></i></div>
        <div class="history-card-body">
          <div class="history-card-title">${escHtml(s.title)}</div>
          <div class="history-card-meta">
            <span class="history-author-badge"><i class="fas fa-user-pen"></i> 작성자: ${escHtml(s.author || '미입력')}</span>
            ${memo ? `<span class="history-memo-badge" title="${escHtml(memo)}"><i class="fas fa-pen-to-square"></i> 수정 메모: ${escHtml(memo)}</span>` : `<span class="history-memo-badge"><i class="fas fa-pen-to-square"></i> 수정 메모: 없음</span>`}
            <i class="fas fa-cloud" style="color:#2a67c0;margin-right:4px;font-size:10px;"></i>
            저장일시: ${escHtml(s.savedAt || '-')} · 장소: ${escHtml(s.data?.place || '-')}
          </div>
        </div>
        <div class="history-card-actions">
          <button class="btn-hist-load" onclick="loadHistRecord(${i})"><i class="fas fa-folder-open"></i> 불러오기</button>
          <button class="btn-hist-del" onclick="deleteHistRecord(${i})"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');
}

function autoSave() {
  try { localStorage.setItem('kgyc_draft', JSON.stringify(collectData())); } catch(e) {}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    updateSyncBadge('saving');
    try {
      await set(ref(db, 'draft'), sanitize(collectData()));
      updateSyncBadge('saved');
    } catch(err) {
      console.warn('[Firebase] 자동저장 실패:', err);
      updateSyncBadge('error');
    }
  }, 1000);
}

async function loadFromLocalStorage() {
  initHistoryUI();
  try {
    const snap = await get(child(ref(db), 'draft'));
    if (snap.exists()) {
      restoreData(snap.val());
      initHistoryUI();
      showToast('☁️ 클라우드에서 최신 데이터를 불러왔습니다.');
      return;
    }
  } catch(err) {
    console.warn('[Firebase] 초기 로드 실패, localStorage fallback:', err);
  }
  try {
    const raw = localStorage.getItem('kgyc_draft');
    if (!raw) return;
    restoreData(JSON.parse(raw));
    initHistoryUI();
    showToast('💾 로컬 저장 데이터를 불러왔습니다.');
  } catch(e) {}
}

async function saveMeeting() {
  const author = getAuthorNameForSave();
  if (!author) return;
  const revisionMemo = getRevisionMemoForSave();
  const d = collectData();
  const title = `${d.year}년 ${d.month}월 전체회의`;
  const key = createHistoryId(d.year, d.month);
  const now = new Date();
  const record = {
    id: key,
    title,
    author,
    revisionMemo,
    year: d.year,
    month: d.month,
    savedAt: now.toLocaleString('ko-KR'),
    savedAtMs: now.getTime(),
    data: d
  };

  updateSyncBadge('saving');
  try {
    await set(ref(db, `history/${key}`), sanitize(record));
    updateSyncBadge('saved');
    showToast(`✅ ${author} 작성자로 회의자료가 누적 저장되었습니다!`);
  } catch(err) {
    console.warn('[Firebase] 회의 저장 실패, localStorage fallback:', err);
    updateSyncBadge('error');
    showToast('💾 로컬에 저장되었습니다 (클라우드 동기화 실패).');
  }
  addLocalHistoryRecord(record);
  clearStoredRevisionMemo();
  const memoInput = document.getElementById('meeting-revision-memo');
  if (memoInput) memoInput.value = '';
  refreshHistory();
}

async function refreshHistory() {
  initHistoryUI();
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = `
    <div class="empty-state sync-loading">
      <i class="fas fa-circle-notch fa-spin"></i>
      <p>회의 이력을 불러오는 중…</p>
    </div>`;
  let records = [];
  try {
    const snap = await get(ref(db, 'history'));
    if (snap.exists()) records = Object.values(snap.val());
  } catch(err) {
    console.warn('[Firebase] 이력 로드 실패, localStorage fallback:', err);
    try { records = JSON.parse(localStorage.getItem('kgyc_history') || '[]'); } catch(e) {}
  }
  records = records.sort((a, b) => {
    const bt = Number(b.savedAtMs) || 0;
    const at = Number(a.savedAtMs) || 0;
    if (bt !== at) return bt - at;
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    return (b.month || 0) - (a.month || 0);
  });
  window._fbHistoryAllRecords = records;
  renderHistoryList();
}

function loadHistRecord(idx) {
  const records = window._fbHistoryCache || [];
  if (!records[idx]) return;
  restoreData(records[idx].data);
  autoSave();
  showPage('input');
  goStep('info');
  showToast(`📂 "${records[idx].title}" 자료를 불러왔습니다. 작성자: ${records[idx].author || '미입력'}`);
}

async function deleteHistRecord(idx) {
  const records = window._fbHistoryCache || [];
  const record = records[idx];
  if (!record) return;
  if (!confirm(`"${record.title}"을 삭제할까요?\n작성자: ${record.author || '미입력'}\n수정 메모: ${record.revisionMemo || record.memo || '없음'}\n저장일시: ${record.savedAt || '-'}`)) return;
  const key = record.id || `${record.year}_${String(record.month).padStart(2,'0')}`;
  try { await remove(ref(db, `history/${key}`)); } catch(err) { console.warn('[Firebase] 이력 삭제 실패:', err); }
  removeLocalHistoryRecord(record);
  refreshHistory();
  showToast('🗑️ 삭제되었습니다.');
}

function updateSyncBadge(state) {
  const badge = document.getElementById('sync-badge');
  if (!badge) return;
  const map = {
    connected: { icon: 'fa-cloud-arrow-up',        text: '클라우드 연결됨', cls: 'sync-ok'      },
    saving:    { icon: 'fa-circle-notch fa-spin',  text: '저장 중…',       cls: 'sync-saving'  },
    saved:     { icon: 'fa-circle-check',          text: '☁️ 저장됨',      cls: 'sync-ok'      },
    offline:   { icon: 'fa-cloud-slash',           text: '오프라인',        cls: 'sync-offline' },
    error:     { icon: 'fa-triangle-exclamation',  text: '동기화 오류',     cls: 'sync-error'   }
  };
  const cfg = map[state] || map.offline;
  badge.className = `sync-badge ${cfg.cls}`;
  badge.innerHTML = `<i class="fas ${cfg.icon}"></i> ${cfg.text}`;
}

document.addEventListener('DOMContentLoaded', initHistoryUI);
window.addEventListener('load', initHistoryUI);

window.autoSave = autoSave;
window.loadFromLocalStorage = loadFromLocalStorage;
window.saveMeeting = saveMeeting;
window.refreshHistory = refreshHistory;
window.loadHistRecord = loadHistRecord;
window.deleteHistRecord = deleteHistRecord;
