/* ============================================================
   강서청소년회관 전체회의 시스템 - Firebase Realtime Database 연동
   ============================================================
   - 자동저장(draft) → Firebase RTDB /draft 경로
   - 회의 이력(history) → Firebase RTDB /history 경로
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
  /* Firebase에서 먼저 시도 */
  try {
    const snap = await get(child(ref(db), 'draft'));
    if (snap.exists()) {
      restoreData(snap.val());
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
    showToast('💾 로컬 저장 데이터를 불러왔습니다.');
  } catch(e) {}
}

/* ─────────────────────────────────────────
   회의 저장 (saveMeeting)
──────────────────────────────────────────*/
async function saveMeeting() {
  const d     = collectData();
  const title = `${d.year}년 ${d.month}월 전체회의`;
  const key   = `${d.year}_${String(d.month).padStart(2,'0')}`;  // e.g. "2026_05"
  const record = {
    id:      key,
    title,
    year:    d.year,
    month:   d.month,
    savedAt: new Date().toLocaleString('ko-KR'),
    data:    d
  };

  /* Firebase 저장 */
  updateSyncBadge('saving');
  try {
    await set(ref(db, `history/${key}`), sanitize(record));
    updateSyncBadge('saved');
    showToast('✅ Firebase에 저장되었습니다!');
  } catch(err) {
    console.warn('[Firebase] 회의 저장 실패, localStorage fallback:', err);
    updateSyncBadge('error');
    /* fallback: localStorage */
    try {
      const saved = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
      const ei = saved.findIndex(s => s.year===d.year && s.month===d.month);
      if (ei >= 0) saved[ei] = record; else saved.unshift(record);
      localStorage.setItem('kgyc_history', JSON.stringify(saved));
      showToast('💾 로컬에 저장되었습니다 (클라우드 동기화 실패).');
    } catch(e) {}
  }

  /* localStorage 백업도 유지 */
  try {
    const saved = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
    const ei = saved.findIndex(s => s.year===d.year && s.month===d.month);
    if (ei >= 0) saved[ei] = record; else saved.unshift(record);
    localStorage.setItem('kgyc_history', JSON.stringify(saved));
  } catch(e) {}

  refreshHistory();
}

/* ─────────────────────────────────────────
   회의 이력 갱신 (refreshHistory)
──────────────────────────────────────────*/
async function refreshHistory() {
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
      records = Object.values(val).sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.month - a.month;
      });
    }
  } catch(err) {
    console.warn('[Firebase] 이력 로드 실패, localStorage fallback:', err);
    /* fallback */
    try {
      records = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
    } catch(e) {}
  }

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
          <i class="fas fa-cloud" style="color:#2a67c0;margin-right:4px;font-size:10px;"></i>
          저장일시: ${s.savedAt} · 장소: ${escHtml(s.data?.place||'-')}
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
  showToast(`📂 "${records[idx].title}" 불러왔습니다.`);
}

/* ─────────────────────────────────────────
   회의 이력 삭제
──────────────────────────────────────────*/
async function deleteHistRecord(idx) {
  const records = window._fbHistoryCache || [];
  if (!records[idx]) return;
  if (!confirm(`"${records[idx].title}"을 삭제할까요?`)) return;

  const key = records[idx].id || `${records[idx].year}_${String(records[idx].month).padStart(2,'0')}`;

  /* Firebase 삭제 */
  try {
    await remove(ref(db, `history/${key}`));
  } catch(err) {
    console.warn('[Firebase] 이력 삭제 실패:', err);
  }

  /* localStorage에서도 삭제 */
  try {
    const saved = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
    const ei = saved.findIndex(s => s.year===records[idx].year && s.month===records[idx].month);
    if (ei >= 0) { saved.splice(ei, 1); localStorage.setItem('kgyc_history', JSON.stringify(saved)); }
  } catch(e) {}

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

/* ── 전역 노출 (app.js에서 호출 가능하도록) ── */
window.autoSave          = autoSave;
window.loadFromLocalStorage = loadFromLocalStorage;
window.saveMeeting       = saveMeeting;
window.refreshHistory    = refreshHistory;
window.loadHistRecord    = loadHistRecord;
window.deleteHistRecord  = deleteHistRecord;
