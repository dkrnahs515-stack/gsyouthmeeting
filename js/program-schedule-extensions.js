/* ============================================
   프로그램/일정 다중 일시 추가 기능
   - 하나의 프로그램 카드 안에 여러 일시를 추가
   - 추가 일시는 저장 시 대표 일시(dates)에 병합되어 월간 달력에 각각 반영
   ============================================ */

(function () {
  const STYLE_ID = 'program-schedule-extension-style';

  function esc(value) {
    if (typeof escHtml === 'function') return escHtml(value || '');
    return String(value || '').replace(/[&<>"]/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[s]));
  }

  function uniqueJoin(values, sep = ', ') {
    const seen = new Set();
    return values
      .map(v => String(v || '').trim())
      .filter(Boolean)
      .filter(v => {
        const key = v.replace(/\s/g, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join(sep);
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .schedule-section {
        margin-top: 14px;
        padding: 13px 14px;
        border: 1.5px solid #dbeafe;
        border-radius: 12px;
        background: #f8fbff;
      }
      .schedule-section-head {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        flex-wrap:wrap;
        margin-bottom:10px;
      }
      .schedule-section-title {
        display:flex;
        align-items:center;
        gap:6px;
        font-size:13px;
        font-weight:900;
        color:#1a4a8a;
      }
      .schedule-section-desc {
        font-size:11px;
        color:#64748b;
        line-height:1.45;
        margin-bottom:10px;
      }
      .btn-add-schedule {
        display:inline-flex;
        align-items:center;
        gap:6px;
        border:1px dashed #93c5fd;
        background:#eef6ff;
        color:#1a4a8a;
        border-radius:9px;
        padding:7px 11px;
        font-family:inherit;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
      }
      .btn-add-schedule:hover { background:#dbeafe; }
      .schedule-input-list {
        display:flex;
        flex-direction:column;
        gap:8px;
      }
      .schedule-input-row {
        display:grid;
        grid-template-columns: 1fr 1fr 1.1fr 1.2fr 32px;
        gap:8px;
        align-items:end;
        padding:9px;
        border:1px solid #e2e8f0;
        border-radius:10px;
        background:#fff;
      }
      .schedule-field label {
        display:flex;
        align-items:center;
        gap:5px;
        font-size:11px;
        font-weight:800;
        color:#475569;
        margin-bottom:5px;
      }
      .schedule-field input {
        width:100%;
        border:1.5px solid #e2e8f0;
        border-radius:8px;
        padding:8px 9px;
        font-family:inherit;
        font-size:12px;
        outline:none;
        background:#f8fafc;
      }
      .schedule-field input:focus {
        border-color:#2a67c0;
        background:#fff;
      }
      .btn-del-schedule {
        width:32px;
        height:32px;
        border:none;
        border-radius:8px;
        background:#fee2e2;
        color:#dc2626;
        cursor:pointer;
      }
      .btn-del-schedule:hover { background:#fecaca; }
      .program-card-schedules {
        margin-top:7px;
        display:flex;
        flex-direction:column;
        gap:4px;
      }
      .program-card-schedule {
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:5px 8px;
        padding:5px 7px;
        border-left:3px solid #60a5fa;
        background:#eef6ff;
        border-radius:6px;
        color:#334155;
        font-size:11px;
        line-height:1.45;
      }
      .program-card-schedule strong { color:#1a4a8a; }
      .doc-program-schedules {
        margin-top:4px;
        padding-left:8px;
      }
      .doc-program-schedule {
        display:block;
        font-size:11px;
        line-height:1.55;
        color:#475569;
      }
      @media(max-width:720px) {
        .schedule-input-row { grid-template-columns:1fr; }
        .btn-del-schedule { width:100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function getCurrentModalItem() {
    const modal = window.appState?.modal;
    if (!modal) return null;
    const { teamIdx, mIdx, type, editIdx } = modal;
    if (editIdx === null || editIdx === undefined) return null;
    return window.appState?.programs?.[teamIdx]?.[mIdx]?.[type]?.[editIdx] || null;
  }

  function normalizeSchedules(schedules) {
    return Array.isArray(schedules)
      ? schedules.map(s => ({
          date: String(s?.date || '').trim(),
          time: String(s?.time || '').trim(),
          place: String(s?.place || '').trim(),
          note: String(s?.note || s?.memo || '').trim()
        })).filter(s => s.date || s.time || s.place || s.note)
      : [];
  }

  function addScheduleRow(schedule = {}) {
    const list = document.getElementById('modal-schedule-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'schedule-input-row';
    row.innerHTML = `
      <div class="schedule-field">
        <label><i class="fas fa-calendar-day"></i> 추가 일자</label>
        <input type="text" class="schedule-date-input" placeholder="예: 9.(화)" value="${esc(schedule.date || '')}">
      </div>
      <div class="schedule-field">
        <label><i class="fas fa-clock"></i> 시간</label>
        <input type="text" class="schedule-time-input" placeholder="예: 13:30" value="${esc(schedule.time || '')}">
      </div>
      <div class="schedule-field">
        <label><i class="fas fa-location-dot"></i> 장소</label>
        <input type="text" class="schedule-place-input" placeholder="예: 어우러짐" value="${esc(schedule.place || '')}">
      </div>
      <div class="schedule-field">
        <label><i class="fas fa-note-sticky"></i> 메모</label>
        <input type="text" class="schedule-note-input" placeholder="예: 주간회의 1차" value="${esc(schedule.note || '')}">
      </div>
      <button type="button" class="btn-del-schedule" title="일시 삭제"><i class="fas fa-times"></i></button>
    `;
    row.querySelector('.btn-del-schedule').addEventListener('click', () => row.remove());
    list.appendChild(row);
    row.querySelector('.schedule-date-input')?.focus();
  }

  function collectSchedulesFromModal() {
    return [...document.querySelectorAll('#modal-schedule-list .schedule-input-row')].map(row => ({
      date: row.querySelector('.schedule-date-input')?.value.trim() || '',
      time: row.querySelector('.schedule-time-input')?.value.trim() || '',
      place: row.querySelector('.schedule-place-input')?.value.trim() || '',
      note: row.querySelector('.schedule-note-input')?.value.trim() || ''
    })).filter(s => s.date || s.time || s.place || s.note);
  }

  function injectScheduleSection(item) {
    injectStyle();
    if (document.getElementById('modal-schedule-section')) return;

    const anchor = document.getElementById('modal-sub-list')?.closest('.form-group') || document.getElementById('modal-sub-list')?.parentElement;
    if (!anchor) return;

    const section = document.createElement('div');
    section.id = 'modal-schedule-section';
    section.className = 'schedule-section';
    section.innerHTML = `
      <div class="schedule-section-head">
        <div class="schedule-section-title"><i class="fas fa-calendar-plus"></i> 일시 추가</div>
        <button type="button" class="btn-add-schedule" id="btn-add-schedule"><i class="fas fa-plus"></i> 일시 추가</button>
      </div>
      <div class="schedule-section-desc">
        하나의 프로그램이 여러 날짜에 반복되거나, 몇 주 간격으로 진행될 때 추가 일시를 입력하세요. 추가한 일자는 월간 달력에 각각 표시됩니다.
      </div>
      <div id="modal-schedule-list" class="schedule-input-list"></div>
    `;
    anchor.insertAdjacentElement('afterend', section);
    section.querySelector('#btn-add-schedule').addEventListener('click', () => addScheduleRow());

    normalizeSchedules(item?.schedules).forEach(addScheduleRow);
  }

  function mergeScheduleFields(item, baseDates) {
    const schedules = normalizeSchedules(item.schedules);
    item.baseDates = String(baseDates || '').trim();
    const scheduleDates = schedules.map(s => s.date).filter(Boolean);
    const scheduleTimes = schedules.map(s => s.time).filter(Boolean);
    const schedulePlaces = schedules.map(s => s.place).filter(Boolean);

    item.dates = uniqueJoin([item.baseDates, ...scheduleDates]);
    if (!item.time) item.time = uniqueJoin(scheduleTimes);
    if (!item.place) item.place = uniqueJoin(schedulePlaces);
    return item;
  }

  function renderScheduleCardHtml(item) {
    const schedules = normalizeSchedules(item?.schedules);
    if (!schedules.length) return '';
    return `<div class="program-card-schedules">
      ${schedules.map((s, idx) => `<div class="program-card-schedule">
        <strong>추가 일시 ${idx + 1}</strong>
        ${s.date ? `<span><i class="fas fa-calendar-day"></i> ${esc(s.date)}</span>` : ''}
        ${s.time ? `<span><i class="fas fa-clock"></i> ${esc(s.time)}</span>` : ''}
        ${s.place ? `<span><i class="fas fa-location-dot"></i> ${esc(s.place)}</span>` : ''}
        ${s.note ? `<span><i class="fas fa-note-sticky"></i> ${esc(s.note)}</span>` : ''}
      </div>`).join('')}
    </div>`;
  }

  function renderDocScheduleHtml(item) {
    const schedules = normalizeSchedules(item?.schedules);
    if (!schedules.length) return '';
    return `<div class="doc-program-schedules">
      ${schedules.map((s, idx) => `<span class="doc-program-schedule">· 추가 일시 ${idx + 1}: ${[
        s.date, s.time, s.place, s.note
      ].filter(Boolean).map(esc).join(' / ')}</span>`).join('')}
    </div>`;
  }

  function ensureScheduleMigration() {
    if (!window.appState?.programs) return;
    [0, 1, 2].forEach(teamIdx => {
      (appState.programs[teamIdx] || []).forEach(member => {
        ['prev', 'next'].forEach(type => {
          (member[type] || []).forEach(item => {
            if (!Array.isArray(item.schedules)) item.schedules = [];
            item.schedules = normalizeSchedules(item.schedules);
            if (!item.baseDates) item.baseDates = item.dates || '';
          });
        });
      });
    });
  }

  function installOpenWrapper() {
    if (typeof window.openProgramModal !== 'function' || window.openProgramModal.__scheduleWrapped) return;
    const original = window.openProgramModal;
    window.openProgramModal = function scheduleOpenProgramModal(teamIdx, mIdx, type, editIdx = null) {
      const result = original.apply(this, arguments);
      setTimeout(() => {
        const item = editIdx !== null && editIdx !== undefined
          ? window.appState?.programs?.[teamIdx]?.[mIdx]?.[type]?.[editIdx]
          : null;
        if (item?.baseDates !== undefined) {
          const datesInput = document.getElementById('modal-dates');
          if (datesInput) datesInput.value = item.baseDates || '';
        }
        injectScheduleSection(item);
      }, 30);
      return result;
    };
    window.openProgramModal.__scheduleWrapped = true;
  }

  function installConfirmWrapper() {
    if (typeof window.confirmProgram !== 'function' || window.confirmProgram.__scheduleWrapped) return;
    const original = window.confirmProgram;
    window.confirmProgram = function scheduleConfirmProgram() {
      const modal = { ...(window.appState?.modal || {}) };
      const schedules = collectSchedulesFromModal();
      const baseDates = document.getElementById('modal-dates')?.value.trim() || '';
      const member = window.appState?.programs?.[modal.teamIdx]?.[modal.mIdx];
      const beforeLength = member?.[modal.type]?.length || 0;

      const result = original.apply(this, arguments);

      setTimeout(() => {
        const targetMember = window.appState?.programs?.[modal.teamIdx]?.[modal.mIdx];
        if (!targetMember) return;
        const targetIdx = modal.editIdx !== null && modal.editIdx !== undefined ? modal.editIdx : beforeLength;
        const item = targetMember?.[modal.type]?.[targetIdx];
        if (!item) return;
        item.schedules = schedules;
        mergeScheduleFields(item, baseDates);
        if (typeof refreshProgramList === 'function') refreshProgramList(modal.teamIdx, modal.mIdx, modal.type);
        if (typeof autoSave === 'function') autoSave();
        if (typeof renderMonthCalendar === 'function') renderMonthCalendar();
      }, 40);

      return result;
    };
    window.confirmProgram.__scheduleWrapped = true;
  }

  function installCardWrapper() {
    if (typeof window.buildProgramCardHtml !== 'function' || window.buildProgramCardHtml.__scheduleWrapped) return;
    const original = window.buildProgramCardHtml;
    window.buildProgramCardHtml = function scheduleBuildProgramCardHtml(item, teamIdx, mIdx, type, pIdx) {
      const base = original.apply(this, arguments);
      const scheduleHtml = renderScheduleCardHtml(item);
      if (!scheduleHtml) return base;
      return base.replace(/(<\/div>\s*<div class="program-card-actions">)/, `${scheduleHtml}$1`);
    };
    window.buildProgramCardHtml.__scheduleWrapped = true;
  }

  function installDocWrapper() {
    if (typeof window.buildDocProgram !== 'function' || window.buildDocProgram.__scheduleWrapped) return;
    const original = window.buildDocProgram;
    window.buildDocProgram = function scheduleBuildDocProgram(prog) {
      const base = original.apply(this, arguments);
      const scheduleHtml = renderDocScheduleHtml(prog);
      if (!scheduleHtml) return base;
      return base.replace('</div>', `${scheduleHtml}</div>`);
    };
    window.buildDocProgram.__scheduleWrapped = true;
  }

  function init() {
    injectStyle();
    ensureScheduleMigration();
    installOpenWrapper();
    installConfirmWrapper();
    installCardWrapper();
    installDocWrapper();
  }

  window.addScheduleRow = addScheduleRow;

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1200));
  window.addEventListener('load', () => setTimeout(init, 1200));
  setInterval(init, 1500);
})();
