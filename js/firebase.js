/* ============================================================
   강서청소년회관 전체회의 시스템 - Firebase Realtime Database 연동
   ============================================================
   - 자동저장(draft) → Firebase RTDB /draft 경로
   - 회의 이력(history) → Firebase RTDB /history 경로
   - 회의 이력은 저장 시점별 고유 ID로 누적 저장
   - 작성자명을 입력·저장하고 회의 이력에서 확인 가능
   - localStorage를 완전히 대체 (오프라인 fallback 포함)
   ============================================================ */

import './print-layout.js';
import './copy-prev-to-next.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, remove, onValue, child }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

/* ── Firebase 설정 ── */
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
const db    = getDatabase(fbApp);

/* ── 상태 ── */
let fbReady   = false;   // DB 연결 여부
let saveTimer = null;    // debounce 타이머

/* ── 연결 상태 감지 ── */
onValue(ref(db, '.info/connected'), snap => {
  fbReady = !!snap.val();
  updateSyncBadge(fbReady ? 'connected' : 'offline');
});

/* ─────────────────────────────────────────
   헬퍼: Firebase 저장에 안전한 객체 변환
   (undefined → null, 배열 키는 그대로)
──────────────────────────────────────────*/
function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => v === undefined ? null : v));
}

function createHistoryId(year, month) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return `history_${year}_${String(month).padStart(2, '0')}_${ts}_${rand}`;
}

function getStoredAuthorName() {
  try { return localStorage.getItem('kgyc_author_name') || ''; }
  catch(e) { return ''; }
}

function setStoredAuthorName(name) {
  try { localStorage.setItem('kgyc_author_name', name || ''); } catch(e) {}
}

function injectAuthorInput() {
  const actions = document.querySelector('.preview-actions');
  if (!actions || document.getElementById('meeting-author')) return;

  const wrap = document.createElement('label');
  wrap.className = 'author-input-wrap';
  wrap.innerHTML = `
    <span class="author-input-label"><i class="fas fa-user-pen"></i> 작성자</span>
    <input type="text" id="meeting-author" class="author-input" placeholder="작성자명" value="${escHtml(getStoredAuthorName())}">
  `;

  const saveBtn = actions.querySelector('.btn-save-meeting');
  if (saveBtn) actions.insertBefore(wrap, saveBtn);
  else actions.prepend(wrap);

  const input = wrap.querySelector('#meeting-author');
  input.addEventListener('input', () => setStoredAuthorName(input.value.trim()));
}

function injectAuthorStyle() {
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

    .author-input::placeholder {
      color: #94a3b8;
      font-weight: 500;
    }

    .history-author-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 99px;
      background: #eef6ff;
      color: #1a4a8a;
      font-size: 11px;
      font-weight: 700;
      margin-right: 6px;
    }

    @media (max-width: 700px) {
      .preview-actions {
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .author-input-wrap {
        order: -1;
        width: 100%;
        justify-content: flex-start;
        margin-right: 0;
      }
      .author-input {
        width: 140px;
      }
    }
  `;
  document.head.appendChild(style);
}

function initAuthorUI() {
  injectAuthorStyle();
  injectAuthorInput();
}

function getAuthorNameForSave() {
  initAuthorUI();

  let author = document.getElementById('meeting-author')?.value.trim() || getStoredAuthorName().trim();
  if (!author) {
    author = prompt('작성자명을 입력해주세요.', '')?.trim() || '';
  }

  if (!author) {
    showToast('⚠️ 작성자명을 입력해야 저장할 수 있습니다.');
    const input = document.getElementById('meeting-author');
    if (input) input.focus();
    return null;
  }

  const input = document.getElementById('meeting-author');
  if (input) input.value = author;
  setStoredAuthorName(author);
  return author;
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

/* ─────────────────────────────────────────
   자동 저장 (debounce 1 초)
──────────────────────────────────────────*/
function autoSave() {
  /* 1) localStorage 즉시 백업 (오프라인 대비) */
  try { localStorage.setItem('kgyc_draft', JSON.stringify(collectData())); } catch(e) {}

  /* 2) Firebase RTDB debounce 저장 */
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

/* ─────────────────────────────────────────
   초기 로드 (앱 시작 시 draft 복원)
──────────────────────────────────────────*/
async function loadFromLocalStorage() {
  initAuthorUI();

  /* Firebase에서 먼저 시도 */
  try {
    const snap = await get(child(ref(db), 'draft'));
    if (snap.exists()) {
      restoreData(snap.val());
      initAuthorUI();
      showToast('☁️ 클라우드에서 최신 데이터를 불러왔습니다.');
      return;
    }
  } catch(err) {
    console.warn('[Firebase] 초기 로드 실패, localStorage fallback:', err);
  }

  /* localStorage fallback */
  try {
    const raw = localStorage.getItem('kgyc_draft');
    if (!raw) return;
    restoreData(JSON.parse(raw));
    initAuthorUI();
    showToast('💾 로컬 저장 데이터를 불러왔습니다.');
  } catch(e) {}
}

/* ─────────────────────────────────────────
   회의 저장 (saveMeeting)
──────────────────────────────────────────*/
async function saveMeeting() {
  const author = getAuthorNameForSave();
  if (!author) return;

  const d     = collectData();
  const title = `${d.year}년 ${d.month}월 전체회의`;
  const key   = createHistoryId(d.year, d.month);
  const now   = new Date();

  const record = {
    id:        key,
    title,
    author,
    year:      d.year,
    month:     d.month,
    savedAt:   now.toLocaleString('ko-KR'),
    savedAtMs: now.getTime(),
    data:      d
  };

  /* Firebase 누적 저장 */
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

  /* localStorage 백업도 누적 유지 */
  addLocalHistoryRecord(record);
  refreshHistory();
}

/* ─────────────────────────────────────────
   회의 이력 갱신 (refreshHistory)
──────────────────────────────────────────*/
async function refreshHistory() {
  initAuthorUI();

  const list = document.getElementById('history-list');
  if (!list) return;

  list.innerHTML = `
    <div class="empty-state sync-loading">
      <i class="fas fa-circle-notch fa-spin"></i>
      <p>회의 이력을 불러오는 중…</p>
    </div>`;

  let records = [];

  /* Firebase에서 시도 */
  try {
    const snap = await get(ref(db, 'history'));
    if (snap.exists()) {
      const val = snap.val();
      records = Object.values(val);
    }
  } catch(err) {
    console.warn('[Firebase] 이력 로드 실패, localStorage fallback:', err);
    /* fallback */
    try {
      records = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
    } catch(e) {}
  }

  records = records.sort((a, b) => {
    const bt = Number(b.savedAtMs) || 0;
    const at = Number(a.savedAtMs) || 0;
    if (bt !== at) return bt - at;
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    return (b.month || 0) - (a.month || 0);
  });

  if (!records.length) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>저장된 회의 자료가 없습니다.</p></div>`;
    return;
  }

  list.innerHTML = records.map((s, i) => `
    <div class="history-card">
      <div class="history-card-icon"><i class="fas fa-file-alt"></i></div>
      <div class="history-card-body">
        <div class="history-card-title">${escHtml(s.title)}</div>
        <div class="history-card-meta">
          <span class="history-author-badge"><i class="fas fa-user-pen"></i> 작성자: ${escHtml(s.author || '미입력')}</span>
          <i class="fas fa-cloud" style="color:#2a67c0;margin-right:4px;font-size:10px;"></i>
          저장일시: ${escHtml(s.savedAt || '-')} · 장소: ${escHtml(s.data?.place || '-')}
        </div>
      </div>
      <div class="history-card-actions">
        <button class="btn-hist-load" onclick="loadHistRecord(${i})">
          <i class="fas fa-folder-open"></i> 불러오기
        </button>
        <button class="btn-hist-del" onclick="deleteHistRecord(${i})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`).join('');

  /* 전역에 캐싱 (loadHistRecord / deleteHistRecord 에서 사용) */
  window._fbHistoryCache = records;
}

/* ─────────────────────────────────────────
   회의 이력 불러오기
──────────────────────────────────────────*/
function loadHistRecord(idx) {
  const records = window._fbHistoryCache || [];
  if (!records[idx]) return;
  restoreData(records[idx].data);
  autoSave();
  showPage('input'); goStep('info');
  showToast(`📂 "${records[idx].title}" 자료를 불러왔습니다. 작성자: ${records[idx].author || '미입력'}`);
}

/* ─────────────────────────────────────────
   회의 이력 삭제
──────────────────────────────────────────*/
async function deleteHistRecord(idx) {
  const records = window._fbHistoryCache || [];
  const record = records[idx];
  if (!record) return;
  if (!confirm(`"${record.title}"을 삭제할까요?\n작성자: ${record.author || '미입력'}\n저장일시: ${record.savedAt || '-'}`)) return;

  const key = record.id || `${record.year}_${String(record.month).padStart(2,'0')}`;

  /* Firebase 삭제 */
  try {
    await remove(ref(db, `history/${key}`));
  } catch(err) {
    console.warn('[Firebase] 이력 삭제 실패:', err);
  }

  /* localStorage에서도 삭제 */
  removeLocalHistoryRecord(record);

  refreshHistory();
  showToast('🗑️ 삭제되었습니다.');
}

/* ─────────────────────────────────────────
   동기화 상태 배지 UI
──────────────────────────────────────────*/
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

/* ── 초기 UI 보정 ── */
document.addEventListener('DOMContentLoaded', initAuthorUI);
window.addEventListener('load', initAuthorUI);

/* ── 전역 노출 (app.js에서 호출 가능하도록) ── */
window.autoSave             = autoSave;
window.loadFromLocalStorage = loadFromLocalStorage;
window.saveMeeting          = saveMeeting;
window.refreshHistory       = refreshHistory;
window.loadHistRecord       = loadHistRecord;
window.deleteHistRecord     = deleteHistRecord;
