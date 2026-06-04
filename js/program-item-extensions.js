/* ============================================
   팀별 보고 항목 확장 기능
   - 세부 항목에 [내용 입력] 필드 추가
   - 전월/당월의 개별 프로그램 카드 단위 복사 기능 추가
   - 미리보기 문서에도 세부 내용 표시
   ============================================ */

(function () {
  const STYLE_ID = 'program-item-extension-style';

  function esc(value) {
    if (typeof escHtml === 'function') return escHtml(value || '');
    return String(value || '').replace(/[&<>"]/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[s]));
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .sub-content-wrap {
        margin-top: 8px;
      }

      .sub-content-wrap label {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: 800;
        color: #475569;
        margin-bottom: 5px;
      }

      .sub-content-input {
        width: 100%;
        min-height: 68px;
        resize: vertical;
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        padding: 9px 10px;
        font-family: inherit;
        font-size: 12px;
        line-height: 1.55;
        color: #1e293b;
        background: #f8fafc;
        outline: none;
      }

      .sub-content-input:focus {
        border-color: #2a67c0;
        background: #fff;
      }

      .program-card-sub-content {
        display: block;
        margin-top: 4px;
        padding: 6px 8px;
        border-left: 3px solid #cbd5e1;
        background: #f8fafc;
        border-radius: 6px;
        color: #475569;
        font-size: 11px;
        line-height: 1.55;
        white-space: pre-line;
      }

      .btn-card-copy {
        border: none;
        border-radius: 8px;
        width: 31px;
        height: 31px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: #eef6ff;
        color: #1a4a8a;
        transition: transform .12s, background .12s;
      }

      .btn-card-copy:hover {
        transform: translateY(-1px);
        background: #dbeafe;
      }

      .program-card-copy-flash {
        animation: programCopyFlash 1.6s ease-in-out 0s 2;
        border-color: #2a67c0 !important;
        box-shadow: 0 0 0 3px rgba(42,103,192,.18), 0 8px 22px rgba(15,23,42,.12) !important;
      }

      @keyframes programCopyFlash {
        0% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
        100% { transform: translateY(0); }
      }

      .doc-sub-content {
        display:block;
        margin-top:3px;
        padding-left:10px;
        color:#475569;
        white-space:pre-line;
        line-height:1.55;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureSubContentMigration() {
    if (!window.appState?.programs) return;
    [0, 1, 2].forEach(teamIdx => {
      (appState.programs[teamIdx] || []).forEach(member => {
        ['prev', 'next'].forEach(type => {
          (member[type] || []).forEach(item => {
            if (!Array.isArray(item.subs)) item.subs = [];
            item.subs = item.subs.map(sub => {
              if (typeof sub === 'string') return { text: sub, content: '', date: '', time: '', place: '', youth: 0, adult: 0, leader: 0 };
              return { content: '', ...sub };
            });
          });
        });
      });
    });
  }

  function buildSubRowsHtml(item) {
    return (item.subs || []).map(s => {
      const subMeta = [];
      if (s.date)  subMeta.push(`<span class="sub-meta"><i class="fas fa-calendar-day"></i>${esc(s.date)}</span>`);
      if (s.time)  subMeta.push(`<span class="sub-meta"><i class="fas fa-clock"></i>${esc(s.time)}</span>`);
      if (s.place) subMeta.push(`<span class="sub-meta"><i class="fas fa-location-dot"></i>${esc(s.place)}</span>`);
      const sy = Number(s.youth)||0, sa = Number(s.adult)||0, sl = Number(s.leader)||0, st = sy+sa+sl;
      if (st > 0) {
        const pp = [];
        if (sy > 0) pp.push(`청소년 ${sy}명`);
        if (sa > 0) pp.push(`성인 ${sa}명`);
        if (sl > 0) pp.push(`지도자 ${sl}명`);
        subMeta.push(`<span class="sub-meta"><i class="fas fa-users"></i>${pp.join(' / ')} (${st}명)</span>`);
      }

      return `<div class="program-card-sub">
        ${s.text ? `<span class="sub-text">${esc(s.text)}</span>` : '<span class="sub-text" style="color:#94a3b8;">세부 항목명 없음</span>'}
        ${s.content ? `<span class="program-card-sub-content">${esc(s.content)}</span>` : ''}
        ${subMeta.length ? `<span class="sub-meta-wrap">${subMeta.join('')}</span>` : ''}
      </div>`;
    }).join('');
  }

  function buildProgramCardHtmlExtended(item, teamIdx, mIdx, type, pIdx) {
    const icon = type === 'prev' ? 'fa-chart-bar' : 'fa-calendar-check';
    const copyTargetLabel = type === 'prev' ? '당월 활동 계획으로 복사' : '전월 활동 보고로 복사';

    const metaParts = [];
    if (item.dates) metaParts.push(`<span><i class="fas fa-calendar-day"></i>${esc(item.dates)}</span>`);
    if (item.time)  metaParts.push(`<span><i class="fas fa-clock"></i>${esc(item.time)}</span>`);

    const youth  = Number(item.youth)  || 0;
    const adult  = Number(item.adult)  || 0;
    const leader = Number(item.leader) || 0;
    const total  = youth + adult + leader;
    const subTotal = (item.subs || []).reduce((acc, s) => acc + (Number(s.youth)||0) + (Number(s.adult)||0) + (Number(s.leader)||0), 0);
    const dispTotal = total || subTotal;

    if (dispTotal > 0) {
      const parts = [];
      if (youth  > 0) parts.push(`청소년 ${youth}명`);
      if (adult  > 0) parts.push(`성인 ${adult}명`);
      if (leader > 0) parts.push(`지도자 ${leader}명`);
      metaParts.push(`<span><i class="fas fa-users"></i>${parts.join(' / ')} (합계 ${dispTotal}명)</span>`);
    }
    if (item.place) metaParts.push(`<span><i class="fas fa-location-dot"></i>${esc(item.place)}</span>`);

    const subsHtml = buildSubRowsHtml(item);

    return `
      <div class="program-card">
        <div class="program-card-icon"><i class="fas ${icon}"></i></div>
        <div class="program-card-body">
          <div class="program-card-name">${esc(item.name)}</div>
          ${metaParts.length ? `<div class="program-card-meta">${metaParts.join('')}</div>` : ''}
          ${subsHtml ? `<div class="program-card-subs">${subsHtml}</div>` : ''}
          ${item.notes ? `<div style="font-size:12px;color:#7c3aed;margin-top:4px;"><i class="fas fa-sticky-note"></i> ${esc(item.notes)}</div>` : ''}
        </div>
        <div class="program-card-actions">
          <button class="btn-card-copy" title="${copyTargetLabel}"
            onclick="copyProgramItem(${teamIdx},${mIdx},'${type}',${pIdx})">
            <i class="fas fa-copy"></i>
          </button>
          <button class="btn-card-edit" title="수정"
            onclick="openProgramModal(${teamIdx},${mIdx},'${type}',${pIdx})">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn-card-del" title="삭제"
            onclick="deleteProgram(${teamIdx},${mIdx},'${type}',${pIdx})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>`;
  }

  function addSubItemWithValueExtended(s) {
    const isObj  = typeof s === 'object' && s !== null;
    const text   = isObj ? (s.text   || '') : (typeof s === 'string' ? s : '');
    const content = isObj ? (s.content || s.body || s.desc || '') : '';
    const date   = isObj ? (s.date   || '') : '';
    const time   = isObj ? (s.time   || '') : '';
    const place  = isObj ? (s.place  || '') : '';
    const youth  = isObj ? (s.youth  || '') : '';
    const adult  = isObj ? (s.adult  || '') : '';
    const leader = isObj ? (s.leader || '') : '';

    const row = document.createElement('div');
    row.className = 'sub-input-row';
    row.innerHTML = `
      <div class="sub-row-main">
        <input type="text" class="sub-text-input" placeholder="세부 항목명 (예: 신서중학교 방문)" value="${esc(text)}">
        <button class="btn-del-item" onclick="this.closest('.sub-input-row').remove(); calcTotal();"><i class="fas fa-times"></i></button>
      </div>
      <div class="sub-content-wrap">
        <label><i class="fas fa-align-left"></i> 내용 입력</label>
        <textarea class="sub-content-input" placeholder="세부 내용을 입력하세요. 예: 결과보고 작성, 모집 안내, 사전 준비사항 등">${esc(content)}</textarea>
      </div>
      <div class="sub-row-meta">
        <div class="sub-meta-field">
          <label><i class="fas fa-calendar-day"></i> 일자</label>
          <input type="text" class="sub-date-input" placeholder="예: 6.17.(금)" value="${esc(date)}">
        </div>
        <div class="sub-meta-field">
          <label><i class="fas fa-clock"></i> 시간</label>
          <input type="text" class="sub-time-input" placeholder="예: 14:00~16:00" value="${esc(time)}">
        </div>
        <div class="sub-meta-field sub-place-field">
          <label><i class="fas fa-location-dot"></i> 장소</label>
          <input type="text" class="sub-place-input" placeholder="예: 어우러짐" value="${esc(place)}">
        </div>
      </div>
      <div class="sub-row-people">
        <div class="sub-meta-field">
          <label><i class="fas fa-child"></i> 청소년</label>
          <div class="sub-num-wrap">
            <input type="number" class="sub-youth-input" min="0" placeholder="0" value="${youth}" oninput="calcTotal()">
            <span>명</span>
          </div>
        </div>
        <div class="sub-meta-field">
          <label><i class="fas fa-person"></i> 성인</label>
          <div class="sub-num-wrap">
            <input type="number" class="sub-adult-input" min="0" placeholder="0" value="${adult}" oninput="calcTotal()">
            <span>명</span>
          </div>
        </div>
        <div class="sub-meta-field">
          <label><i class="fas fa-chalkboard-user"></i> 지도자</label>
          <div class="sub-num-wrap">
            <input type="number" class="sub-leader-input" min="0" placeholder="0" value="${leader}" oninput="calcTotal()">
            <span>명</span>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-sub-list')?.appendChild(row);
    if (youth || adult || leader) calcTotal();
    row.querySelector('.sub-text-input')?.focus();
  }

  function addSubItemExtended() {
    addSubItemWithValueExtended({ text:'', content:'', date:'', time:'', place:'', youth:0, adult:0, leader:0 });
  }

  function confirmProgramExtended() {
    const name = document.getElementById('modal-prog-name')?.value.trim();
    if (!name) { showToast('⚠️ 항목명을 입력해주세요.'); return; }

    const subs = [...document.querySelectorAll('#modal-sub-list .sub-input-row')].map(row => ({
      text:    row.querySelector('.sub-text-input')?.value.trim() || '',
      content: row.querySelector('.sub-content-input')?.value.trim() || '',
      date:    row.querySelector('.sub-date-input')?.value.trim() || '',
      time:    row.querySelector('.sub-time-input')?.value.trim() || '',
      place:   row.querySelector('.sub-place-input')?.value.trim() || '',
      youth:   Number(row.querySelector('.sub-youth-input')?.value) || 0,
      adult:   Number(row.querySelector('.sub-adult-input')?.value) || 0,
      leader:  Number(row.querySelector('.sub-leader-input')?.value) || 0
    })).filter(s => s.text || s.content || s.date || s.time || s.place || s.youth || s.adult || s.leader);

    const hasSubPeople = subs.some(s => (s.youth > 0 || s.adult > 0 || s.leader > 0));
    const finalYouth  = hasSubPeople ? subs.reduce((acc, s) => acc + s.youth, 0)  : Number(document.getElementById('modal-youth')?.value)  || 0;
    const finalAdult  = hasSubPeople ? subs.reduce((acc, s) => acc + s.adult, 0)  : Number(document.getElementById('modal-adult')?.value)  || 0;
    const finalLeader = hasSubPeople ? subs.reduce((acc, s) => acc + s.leader, 0) : Number(document.getElementById('modal-leader')?.value) || 0;

    const data = {
      name,
      subs,
      dates:  document.getElementById('modal-dates')?.value.trim() || '',
      time:   document.getElementById('modal-time')?.value.trim() || '',
      place:  document.getElementById('modal-place')?.value.trim() || '',
      youth:  finalYouth,
      adult:  finalAdult,
      leader: finalLeader,
      notes:  document.getElementById('modal-notes')?.value.trim() || ''
    };

    const { teamIdx, mIdx, type, editIdx } = appState.modal;
    const member = appState.programs[teamIdx]?.[mIdx];
    if (!member) return;

    if (editIdx !== null) {
      member[type][editIdx] = data;
      showToast('✅ 항목이 수정되었습니다.');
    } else {
      member[type].push(data);
      showToast('✅ 항목이 추가되었습니다.');
    }

    refreshProgramList(teamIdx, mIdx, type);
    closeModal();
    autoSave();
    if (typeof renderMonthCalendar === 'function') renderMonthCalendar();
  }

  function copyProgramItem(teamIdx, mIdx, type, pIdx, targetType = null) {
    const member = appState.programs?.[teamIdx]?.[mIdx];
    if (!member || !member[type]?.[pIdx]) return;

    const destType = targetType || (type === 'prev' ? 'next' : 'prev');
    const source = member[type][pIdx];
    const copied = deepClone(source);
    copied.name = copied.name?.startsWith('[복사하기]') ? copied.name : `[복사하기] ${copied.name || '제목 없음'}`;
    copied.subs = Array.isArray(copied.subs) ? copied.subs.map(sub => typeof sub === 'string' ? { text: sub, content: '' } : { content: '', ...sub }) : [];

    if (!Array.isArray(member[destType])) member[destType] = [];
    member[destType].push(copied);

    refreshProgramList(teamIdx, mIdx, destType);
    autoSave();
    if (typeof renderMonthCalendar === 'function') renderMonthCalendar();

    const label = destType === 'prev' ? '전월 활동 보고' : '당월 활동 계획';
    showToast(`📋 선택한 항목을 ${label}으로 복사했습니다.`);

    setTimeout(() => {
      const list = document.getElementById(`prog-list-${teamIdx}-${mIdx}-${destType}`);
      const card = list?.querySelectorAll('.program-card')?.[member[destType].length - 1];
      if (card) {
        card.classList.add('program-card-copy-flash');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => card.classList.remove('program-card-copy-flash'), 4000);
      }
    }, 80);
  }

  function buildDocProgramExtended(prog) {
    const metas = [];
    if (prog.dates) metas.push(`<span><i class="fas fa-calendar-day"></i> ${esc(prog.dates)}</span>`);
    if (prog.time)  metas.push(`<span><i class="fas fa-clock"></i> ${esc(prog.time)}</span>`);
    if (prog.place) metas.push(`<span><i class="fas fa-location-dot"></i> ${esc(prog.place)}</span>`);

    const youth  = Number(prog.youth)  || 0;
    const adult  = Number(prog.adult)  || 0;
    const leader = Number(prog.leader) || 0;
    const total  = youth + adult + leader;
    if (total > 0) {
      const parts = [];
      if (youth  > 0) parts.push(`청소년 ${youth}명`);
      if (adult  > 0) parts.push(`성인 ${adult}명`);
      if (leader > 0) parts.push(`지도자 ${leader}명`);
      metas.push(`<span><i class="fas fa-users"></i> ${parts.join(' / ')} (합계 ${total}명)</span>`);
    } else if (prog.participants) {
      metas.push(`<span><i class="fas fa-users"></i> ${esc(prog.participants)}</span>`);
    }

    const subsHtml = (prog.subs || []).map(s => {
      if (typeof s === 'string') return `<div class="doc-program-sub">${esc(s)}</div>`;
      const subMeta = [];
      if (s.date)  subMeta.push(`<span class="doc-sub-meta-item"><i class="fas fa-calendar-day"></i>${esc(s.date)}</span>`);
      if (s.time)  subMeta.push(`<span class="doc-sub-meta-item"><i class="fas fa-clock"></i>${esc(s.time)}</span>`);
      if (s.place) subMeta.push(`<span class="doc-sub-meta-item"><i class="fas fa-location-dot"></i>${esc(s.place)}</span>`);
      const sy = Number(s.youth)||0, sa = Number(s.adult)||0, sl = Number(s.leader)||0, st = sy+sa+sl;
      if (st > 0) {
        const pp = [];
        if (sy > 0) pp.push(`청소년 ${sy}명`);
        if (sa > 0) pp.push(`성인 ${sa}명`);
        if (sl > 0) pp.push(`지도자 ${sl}명`);
        subMeta.push(`<span class="doc-sub-meta-item"><i class="fas fa-users"></i>${pp.join('/')} (${st}명)</span>`);
      }
      return `<div class="doc-program-sub">
        ${s.text ? `<span class="doc-sub-text">${esc(s.text)}</span>` : ''}
        ${s.content ? `<span class="doc-sub-content">${esc(s.content)}</span>` : ''}
        ${subMeta.length ? `<span class="doc-sub-meta-wrap">${subMeta.join('')}</span>` : ''}
      </div>`;
    }).join('');

    return `
      <div class="doc-program">
        <div class="doc-program-name">■ ${esc(prog.name)}</div>
        ${metas.length ? `<div class="doc-program-meta">${metas.join('')}</div>` : ''}
        ${subsHtml}
        ${prog.notes ? `<div style="font-size:11px;color:#7c3aed;margin-top:4px;">※ ${esc(prog.notes)}</div>` : ''}
      </div>`;
  }

  function installExtensions() {
    injectStyle();
    ensureSubContentMigration();

    window.addSubItemWithValue = addSubItemWithValueExtended;
    window.addSubItem = addSubItemExtended;
    window.confirmProgram = confirmProgramExtended;
    window.buildProgramCardHtml = buildProgramCardHtmlExtended;
    window.copyProgramItem = copyProgramItem;
    window.buildDocProgram = buildDocProgramExtended;

    [0, 1, 2].forEach(teamIdx => {
      if (typeof renderMemberList === 'function') renderMemberList(teamIdx);
    });
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(installExtensions, 900));
  window.addEventListener('load', () => setTimeout(installExtensions, 900));
  setTimeout(installExtensions, 1400);
})();
