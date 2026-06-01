/* ============================================
   강서청소년회관 전체회의 자동화 - 메인 앱
   ============================================ */

const DEFAULT_AGENDA = [
  { text: '개회',          fixed: true  },
  { text: '도산의 말씀',   fixed: true  },
  { text: '관장 인사',     fixed: true  },
  { text: '팀별 보고',     fixed: true  },
  { text: '기타 공지사항', fixed: false },
  { text: '직원 생일 축하',fixed: false },
  { text: '폐회',          fixed: true  }
];

function getStepSequence() {
  return ['info', 'dozan', ...appState.teamOrder.map(i => `team-${i}`), 'etc', 'excel', 'summary'];
}
function getPanelId(key) { return 'panel-' + key; }
function getTabId(key)   { return 'step-tab-' + key; }

/* ─── 전월/당월 계산 ─── */
function getMonthInfo() {
  const year  = Number(document.getElementById('info-year')?.value  || 2026);
  const month = Number(document.getElementById('info-month')?.value || 5);

  // 당월
  const currYear  = year;
  const currMonth = month;

  // 전월 (1월이면 → 전년도 12월)
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;

  return {
    prev: { year: prevYear,  month: prevMonth, label: `${prevYear}년 ${prevMonth}월` },
    curr: { year: currYear,  month: currMonth, label: `${currYear}년 ${currMonth}월` }
  };
}

/* 연도/월 변경 → 전월·당월 표시 일괄 갱신 */
function onYearMonthChange() {
  autoSave();
  updateMonthLabels();
}

function updateMonthLabels() {
  const { prev, curr } = getMonthInfo();

  // 팀 패널 헤더 배지 갱신
  [0, 1, 2].forEach(i => {
    const prevEl = document.getElementById(`prev-month-label-${i}`);
    const currEl = document.getElementById(`curr-month-label-${i}`);
    if (prevEl) prevEl.textContent = `${prev.month}월 (${prev.year})`;
    if (currEl) currEl.textContent = `${curr.month}월 (${curr.year})`;
  });

  // 담당자 카드 내 섹션 태그도 갱신
  document.querySelectorAll('.prev-tag-month').forEach(el => {
    el.textContent = `● 전월 활동 보고 (${prev.month}월)`;
  });
  document.querySelectorAll('.next-tag-month').forEach(el => {
    el.textContent = `● 당월 활동 계획 (${curr.month}월)`;
  });
}

/* ─── HTML 이스케이프 ─── */
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── 초기화 ─── */
document.addEventListener('DOMContentLoaded', () => {
  if (!appState.agenda || !appState.agenda.length)
    appState.agenda = DEFAULT_AGENDA.map(a => ({ ...a }));
  if (!appState.teamOrder || appState.teamOrder.length !== 3)
    appState.teamOrder = [0, 1, 2];
  // programs 구조 보정 (구버전 데이터 호환)
  [0,1,2].forEach(i => {
    if (!Array.isArray(appState.programs[i])) appState.programs[i] = [];
  });

  initDozanLivePreview();
  renderTeamStepTabs();
  loadFromLocalStorage();
  refreshHistory();
  renderAgenda();
  [0,1,2].forEach(i => renderMemberList(i));
  updateMonthLabels();
});

/* ============================================================
   사이드바 팀 탭 + 드래그
   ============================================================ */

function renderTeamStepTabs() {
  const container = document.getElementById('team-step-tabs');
  if (!container) return;
  container.innerHTML = '';

  appState.teamOrder.forEach((teamIdx, pos) => {
    const team    = TEAMS[teamIdx];
    const stepKey = `team-${teamIdx}`;
    const stepNum = pos + 3;

    const li = document.createElement('li');
    li.className = 'step-item step-item-team';
    li.id = getTabId(stepKey);
    li.dataset.teamIdx = teamIdx;
    li.dataset.stepKey = stepKey;
    li.setAttribute('draggable', 'true');

    li.innerHTML = `
      <span class="step-team-drag-handle" title="드래그하여 팀 순서 변경">
        <i class="fas fa-grip-vertical"></i>
      </span>
      <span class="step-num" id="step-num-${stepKey}">${stepNum}</span>
      <span class="step-label" style="color:${team.color};">${team.name}</span>
      <i class="fas fa-check step-check" id="check-${stepKey}"></i>
    `;

    li.addEventListener('click', e => {
      if (e.target.closest('.step-team-drag-handle')) return;
      goStep(stepKey);
    });
    li.addEventListener('dragstart', onTeamTabDragStart);
    li.addEventListener('dragover',  onTeamTabDragOver);
    li.addEventListener('drop',      onTeamTabDrop);
    li.addEventListener('dragend',   onTeamTabDragEnd);
    container.appendChild(li);
  });

  // 팀 수에 따라 etc / excel / summary 번호 동적 산출
  // 팀 탭: 3~(2+팀수), etc: 2+팀수+1, excel: 2+팀수+2, summary: 2+팀수+3
  const teamCount = appState.teamOrder.length;
  const etcNum = document.getElementById('step-num-etc');
  if (etcNum) etcNum.textContent = String(2 + teamCount + 1);
  const excelNum = document.getElementById('step-num-excel');
  if (excelNum) excelNum.textContent = String(2 + teamCount + 2);
  const sumNum = document.getElementById('step-num-summary');
  if (sumNum) sumNum.textContent = String(2 + teamCount + 3);
  updateTeamPanelHeaders();
  updateTeamPanelNavs();
  reapplyDoneClasses();
}

function updateTeamPanelHeaders() {
  const iconMap  = ['fas fa-users-gear','fas fa-chalkboard-teacher','fas fa-child-reaching'];
  const clsMap   = ['team-0','team-1','team-2'];
  TEAMS.forEach((team, i) => {
    const ph = document.querySelector(`#panel-team-${i} .panel-header`);
    if (!ph) return;
    ph.className = `panel-header team-header ${clsMap[i]}`;
    ph.querySelector('h2').innerHTML = `<i class="${iconMap[i]}"></i> ${team.name} 보고`;
  });
}

function updateTeamPanelNavs() {
  const seq = getStepSequence();
  seq.forEach((stepKey, pos) => {
    if (!stepKey.startsWith('team-')) return;
    const panel = document.getElementById(getPanelId(stepKey));
    if (!panel) return;
    const nav = panel.querySelector('.step-nav');
    if (!nav) return;
    nav.innerHTML = `
      <button class="btn-prev" onclick="prevStep('${stepKey}')">
        <i class="fas fa-arrow-left"></i> 이전
      </button>
      <button class="btn-next" onclick="nextStep('${stepKey}')">
        다음 단계 <i class="fas fa-arrow-right"></i>
      </button>`;
  });
}

function reapplyDoneClasses() {
  appState.completedSteps.forEach(key => {
    const tab = document.getElementById(getTabId(key));
    if (tab) tab.classList.add('done');
  });
}

let teamDragSrcIdx = null;
function onTeamTabDragStart(e) {
  teamDragSrcIdx = appState.teamOrder.indexOf(Number(this.dataset.teamIdx));
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', teamDragSrcIdx);
}
function onTeamTabDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.step-item-team').forEach(el => el.classList.remove('drag-over'));
  this.classList.add('drag-over');
}
function onTeamTabDrop(e) {
  e.preventDefault();
  const targetPos = appState.teamOrder.indexOf(Number(this.dataset.teamIdx));
  if (teamDragSrcIdx === null || teamDragSrcIdx === targetPos) return;
  const moved = appState.teamOrder.splice(teamDragSrcIdx, 1)[0];
  appState.teamOrder.splice(targetPos, 0, moved);
  renderTeamStepTabs();
  autoSave();
  showToast('↕️ 팀 순서가 변경되었습니다.');
}
function onTeamTabDragEnd() {
  document.querySelectorAll('.step-item-team').forEach(el => el.classList.remove('dragging','drag-over'));
  teamDragSrcIdx = null;
}

/* ============================================================
   페이지 / 단계 전환
   ============================================================ */

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-page="${name}"]`).classList.add('active');
  if (name === 'history') refreshHistory();
  if (name === 'stats')   renderStats();
}

function goStep(key) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.step-item').forEach(i => i.classList.remove('active'));
  const panel = document.getElementById(getPanelId(key));
  const tab   = document.getElementById(getTabId(key));
  if (panel) panel.classList.add('active');
  if (tab)   tab.classList.add('active');
  appState.currentStep = key;
  if (key === 'summary') renderTeamSummary();
}

function nextStep(key) {
  markStepDone(key);
  const seq = getStepSequence();
  const idx = seq.indexOf(key);
  if (idx >= 0 && idx < seq.length - 1) goStep(seq[idx + 1]);
}
function prevStep(key) {
  const seq = getStepSequence();
  const idx = seq.indexOf(key);
  if (idx > 0) goStep(seq[idx - 1]);
}
function markStepDone(key) {
  appState.completedSteps.add(key);
  const tab = document.getElementById(getTabId(key));
  if (tab) tab.classList.add('done');
  updateProgress();
  autoSave();
}
function updateProgress() {
  const pct = Math.min(Math.round((appState.completedSteps.size / 8) * 100), 100);
  document.getElementById('total-progress').style.width = pct + '%';
  document.getElementById('progress-pct').textContent   = pct + '%';
}

/* ============================================================
   담당자 관리 (팀별)
   ============================================================ */

/** 팀의 담당자 목록 전체 렌더링 */
function renderMemberList(teamIdx) {
  const wrap = document.getElementById(`team${teamIdx}-members-wrap`);
  if (!wrap) return;
  wrap.innerHTML = '';

  const members = appState.programs[teamIdx];
  if (!members.length) {
    wrap.innerHTML = `
      <div class="member-empty">
        <i class="fas fa-user-plus"></i>
        <p>아래 버튼을 눌러 담당자를 추가하세요.</p>
      </div>`;
    return;
  }

  members.forEach((member, mIdx) => {
    const card = buildMemberCard(teamIdx, mIdx, member);
    wrap.appendChild(card);
  });
  // 카드 렌더 후 월 라벨 즉시 반영
  updateMonthLabels();
}

/** 담당자 카드 DOM 생성 */
function buildMemberCard(teamIdx, mIdx, member) {
  const team   = TEAMS[teamIdx];
  const card   = document.createElement('div');
  card.className = 'member-card';
  card.id = `member-card-${teamIdx}-${mIdx}`;

  // 전월 보고 항목 HTML
  const prevItemsHtml = renderProgramItems(member.prev || [], teamIdx, mIdx, 'prev');
  // 당월 계획 항목 HTML
  const nextItemsHtml = renderProgramItems(member.next || [], teamIdx, mIdx, 'next');

  card.innerHTML = `
    <div class="member-card-header" style="border-left-color:${team.color}">
      <div class="member-card-title">
        <div class="member-avatar" style="background:${team.color}20;color:${team.color};">
          <i class="fas fa-user"></i>
        </div>
        <div class="member-info">
          <input type="text" class="member-name-input" placeholder="담당자 이름"
            value="${escHtml(member.name || '')}"
            oninput="updateMemberField(${teamIdx},${mIdx},'name',this.value)">
          <input type="text" class="member-title-input" placeholder="직위 (예: 주임, 팀원)"
            value="${escHtml(member.title || '')}"
            oninput="updateMemberField(${teamIdx},${mIdx},'title',this.value)">
        </div>
      </div>
      <div class="member-card-actions">
        <button class="member-collapse-btn" onclick="toggleMemberCard(${teamIdx},${mIdx})" title="접기/펼치기">
          <i class="fas fa-chevron-up"></i>
        </button>
        <button class="member-del-btn" onclick="deleteMember(${teamIdx},${mIdx})" title="담당자 삭제">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>

    <div class="member-card-body" id="member-body-${teamIdx}-${mIdx}">
      <!-- 전월 활동 보고 -->
      <div class="member-section">
        <div class="member-section-header">
          <span class="section-tag prev-tag prev-tag-month">● 전월 활동 보고</span>
          <button class="btn-add-program" onclick="openProgramModal(${teamIdx},${mIdx},'prev')">
            <i class="fas fa-plus"></i> 항목 추가
          </button>
        </div>
        <div class="program-list" id="prog-list-${teamIdx}-${mIdx}-prev">
          ${prevItemsHtml}
        </div>
      </div>

      <!-- 당월 활동 계획 -->
      <div class="member-section">
        <div class="member-section-header">
          <span class="section-tag next-tag next-tag-month">● 당월 활동 계획</span>
          <button class="btn-add-program" onclick="openProgramModal(${teamIdx},${mIdx},'next')">
            <i class="fas fa-plus"></i> 항목 추가
          </button>
        </div>
        <div class="program-list" id="prog-list-${teamIdx}-${mIdx}-next">
          ${nextItemsHtml}
        </div>
      </div>
    </div>
  `;

  return card;
}

/** 프로그램 카드 목록 HTML 반환 */
function renderProgramItems(items, teamIdx, mIdx, type) {
  if (!items.length) {
    return `<div class="prog-empty"><i class="fas fa-inbox"></i> 항목을 추가해주세요</div>`;
  }
  return items.map((item, pIdx) => buildProgramCardHtml(item, teamIdx, mIdx, type, pIdx)).join('');
}

function buildProgramCardHtml(item, teamIdx, mIdx, type, pIdx) {
  const icon = type === 'prev' ? 'fa-chart-bar' : 'fa-calendar-check';

  // 전체 일시/시간
  const metaParts = [];
  if (item.dates) metaParts.push(`<span><i class="fas fa-calendar-day"></i>${escHtml(item.dates)}</span>`);
  if (item.time)  metaParts.push(`<span><i class="fas fa-clock"></i>${escHtml(item.time)}</span>`);

  // 인원 합산 표시
  const youth  = Number(item.youth)  || 0;
  const adult  = Number(item.adult)  || 0;
  const leader = Number(item.leader) || 0;
  const total  = youth + adult + leader;
  const subTotal = (item.subs || []).reduce((acc, s) =>
    acc + (Number(s.youth)||0) + (Number(s.adult)||0) + (Number(s.leader)||0), 0);
  const dispTotal = total || subTotal;

  if (dispTotal > 0) {
    const parts = [];
    if (youth  > 0) parts.push(`청소년 ${youth}명`);
    if (adult  > 0) parts.push(`성인 ${adult}명`);
    if (leader > 0) parts.push(`지도자 ${leader}명`);
    metaParts.push(`<span><i class="fas fa-users"></i>${parts.join(' / ')} (합계 ${dispTotal}명)</span>`);
  }
  if (item.place) metaParts.push(`<span><i class="fas fa-location-dot"></i>${escHtml(item.place)}</span>`);

  // 하위 항목 렌더
  const subsHtml = (item.subs || []).map(s => {
    const subMeta = [];
    if (s.date)  subMeta.push(`<span class="sub-meta"><i class="fas fa-calendar-day"></i>${escHtml(s.date)}</span>`);
    if (s.time)  subMeta.push(`<span class="sub-meta"><i class="fas fa-clock"></i>${escHtml(s.time)}</span>`);
    if (s.place) subMeta.push(`<span class="sub-meta"><i class="fas fa-location-dot"></i>${escHtml(s.place)}</span>`);
    const sy = Number(s.youth)||0, sa = Number(s.adult)||0, sl = Number(s.leader)||0, st = sy+sa+sl;
    if (st > 0) {
      const pp = [];
      if (sy > 0) pp.push(`청소년 ${sy}명`);
      if (sa > 0) pp.push(`성인 ${sa}명`);
      if (sl > 0) pp.push(`지도자 ${sl}명`);
      subMeta.push(`<span class="sub-meta"><i class="fas fa-users"></i>${pp.join(' / ')} (${st}명)</span>`);
    }
    return `<div class="program-card-sub">
      <span class="sub-text">${escHtml(s.text)}</span>
      ${subMeta.length ? `<span class="sub-meta-wrap">${subMeta.join('')}</span>` : ''}
    </div>`;
  }).join('');

  return `
    <div class="program-card">
      <div class="program-card-icon"><i class="fas ${icon}"></i></div>
      <div class="program-card-body">
        <div class="program-card-name">${escHtml(item.name)}</div>
        ${metaParts.length ? `<div class="program-card-meta">${metaParts.join('')}</div>` : ''}
        ${subsHtml ? `<div class="program-card-subs">${subsHtml}</div>` : ''}
        ${item.notes ? `<div style="font-size:12px;color:#7c3aed;margin-top:4px;"><i class="fas fa-sticky-note"></i> ${escHtml(item.notes)}</div>` : ''}
      </div>
      <div class="program-card-actions">
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

/** 담당자 추가 */
function addMember(teamIdx) {
  appState.programs[teamIdx].push({
    id:    genId(),
    name:  '',
    title: '',
    prev:  [],
    next:  []
  });
  renderMemberList(teamIdx);
  autoSave();
  // 새 카드의 이름 input에 포커스
  setTimeout(() => {
    const mIdx = appState.programs[teamIdx].length - 1;
    const input = document.querySelector(`#member-card-${teamIdx}-${mIdx} .member-name-input`);
    if (input) input.focus();
  }, 60);
}

/** 담당자 삭제 */
function deleteMember(teamIdx, mIdx) {
  const name = appState.programs[teamIdx][mIdx]?.name || '이 담당자';
  if (!confirm(`"${name || '담당자'}"를 삭제할까요?\n입력된 보고 내용도 모두 삭제됩니다.`)) return;
  appState.programs[teamIdx].splice(mIdx, 1);
  renderMemberList(teamIdx);
  autoSave();
  showToast('🗑️ 담당자가 삭제되었습니다.');
}

/** 담당자 필드(이름/직위) 수정 */
function updateMemberField(teamIdx, mIdx, field, val) {
  if (appState.programs[teamIdx][mIdx]) {
    appState.programs[teamIdx][mIdx][field] = val;
    // 탭 카드 헤더 실시간 반영 (이름 변경 시)
    autoSave();
  }
}

/** 카드 접기/펼치기 */
function toggleMemberCard(teamIdx, mIdx) {
  const body = document.getElementById(`member-body-${teamIdx}-${mIdx}`);
  const btn  = document.querySelector(`#member-card-${teamIdx}-${mIdx} .member-collapse-btn i`);
  if (!body) return;
  const isCollapsed = body.classList.toggle('collapsed');
  if (btn) btn.className = isCollapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
}

/** 프로그램 목록 영역만 재렌더 */
function refreshProgramList(teamIdx, mIdx, type) {
  const el = document.getElementById(`prog-list-${teamIdx}-${mIdx}-${type}`);
  if (!el) return;
  const items = appState.programs[teamIdx][mIdx]?.[type] || [];
  el.innerHTML = items.length
    ? items.map((item, pIdx) => buildProgramCardHtml(item, teamIdx, mIdx, type, pIdx)).join('')
    : `<div class="prog-empty"><i class="fas fa-inbox"></i> 항목을 추가해주세요</div>`;
}

/** 프로그램 삭제 */
function deleteProgram(teamIdx, mIdx, type, pIdx) {
  if (!confirm('이 항목을 삭제할까요?')) return;
  appState.programs[teamIdx][mIdx][type].splice(pIdx, 1);
  refreshProgramList(teamIdx, mIdx, type);
  autoSave();
  showToast('🗑️ 삭제되었습니다.');
}

/* ============================================================
   프로그램 추가/수정 모달
   ============================================================ */

function openProgramModal(teamIdx, mIdx, type, editIdx = null) {
  appState.modal = { teamIdx, mIdx, type, editIdx };
  const isEdit = editIdx !== null;
  const member = appState.programs[teamIdx][mIdx];
  const memberName = member?.name ? `(${member.name})` : '';

  document.getElementById('modal-title').textContent =
    (isEdit ? '항목 수정' : '항목 추가') +
    ` — ${TEAMS[teamIdx].name} ${memberName}`;

  let data = { name:'', subs:[], dates:'', time:'', place:'', youth:0, adult:0, leader:0, notes:'' };
  if (isEdit && member) data = member[type][editIdx];

  document.getElementById('modal-prog-name').value = data.name  || '';
  document.getElementById('modal-dates').value      = data.dates || '';
  document.getElementById('modal-time').value       = data.time  || '';
  document.getElementById('modal-place').value      = data.place || '';
  document.getElementById('modal-notes').value      = data.notes || '';

  // 모달 초기화: disabled 상태 해제 + 자동합산 영역 숨기기
  document.getElementById('modal-youth').disabled  = false;
  document.getElementById('modal-adult').disabled  = false;
  document.getElementById('modal-leader').disabled = false;
  document.getElementById('participants-auto-wrap').style.display  = 'none';
  document.getElementById('participants-auto-badge').style.display = 'none';
  document.getElementById('participants-manual-wrap').classList.remove('participants-manual-disabled');

  // 세부 항목이 인원값을 가지는지 확인
  const hasSubPeople = (data.subs || []).some(s => (Number(s.youth) > 0 || Number(s.adult) > 0 || Number(s.leader) > 0));
  if (hasSubPeople) {
    document.getElementById('modal-youth').value  = 0;
    document.getElementById('modal-adult').value  = 0;
    document.getElementById('modal-leader').value = 0;
  } else {
    document.getElementById('modal-youth').value  = data.youth  || '';
    document.getElementById('modal-adult').value  = data.adult  || '';
    document.getElementById('modal-leader').value = data.leader || '';
  }

  const subList = document.getElementById('modal-sub-list');
  subList.innerHTML = '';
  (data.subs || []).forEach(s => addSubItemWithValue(s));

  // 세부 항목 렌더 후 calcTotal로 모드 확정
  calcTotal();

  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-prog-name').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

/* ─── 인원 합계 계산 (세부 항목 자동합산 or 직접입력 전환) ─── */
function calcTotal() {
  const rows = document.querySelectorAll('#modal-sub-list .sub-input-row');
  let subYouth = 0, subAdult = 0, subLeader = 0, hasSubPeople = false;

  rows.forEach(row => {
    const y = Number(row.querySelector('.sub-youth-input')?.value)  || 0;
    const a = Number(row.querySelector('.sub-adult-input')?.value)  || 0;
    const l = Number(row.querySelector('.sub-leader-input')?.value) || 0;
    subYouth  += y;
    subAdult  += a;
    subLeader += l;
    if (y > 0 || a > 0 || l > 0) hasSubPeople = true;
  });

  const autoWrap   = document.getElementById('participants-auto-wrap');
  const manualWrap = document.getElementById('participants-manual-wrap');
  const autoBadge  = document.getElementById('participants-auto-badge');

  if (hasSubPeople) {
    // ── 자동합산 모드 ──
    autoWrap.style.display  = 'block';
    autoBadge.style.display = 'inline-flex';
    manualWrap.classList.add('participants-manual-disabled');
    document.getElementById('modal-youth').disabled  = true;
    document.getElementById('modal-adult').disabled  = true;
    document.getElementById('modal-leader').disabled = true;

    const subTotal = subYouth + subAdult + subLeader;
    document.getElementById('auto-youth-val').textContent  = subYouth;
    document.getElementById('auto-adult-val').textContent  = subAdult;
    document.getElementById('auto-leader-val').textContent = subLeader;
    document.getElementById('auto-total-val').textContent  = subTotal;
    document.getElementById('modal-total').textContent     = subTotal + '명';
  } else {
    // ── 직접입력 모드 ──
    autoWrap.style.display  = 'none';
    autoBadge.style.display = 'none';
    manualWrap.classList.remove('participants-manual-disabled');
    document.getElementById('modal-youth').disabled  = false;
    document.getElementById('modal-adult').disabled  = false;
    document.getElementById('modal-leader').disabled = false;

    const y = Number(document.getElementById('modal-youth').value)  || 0;
    const a = Number(document.getElementById('modal-adult').value)  || 0;
    const l = Number(document.getElementById('modal-leader').value) || 0;
    document.getElementById('modal-total').textContent = (y + a + l) + '명';
  }
}

function addSubItem() { addSubItemWithValue({ text:'', date:'', time:'', place:'', youth:0, adult:0, leader:0 }); }

function addSubItemWithValue(s) {
  const isObj  = typeof s === 'object' && s !== null;
  const text   = isObj ? (s.text   || '') : (typeof s === 'string' ? s : '');
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
      <input type="text" class="sub-text-input" placeholder="세부 항목명 (예: 신서중학교 방문)" value="${escHtml(text)}">
      <button class="btn-del-item" onclick="this.closest('.sub-input-row').remove(); calcTotal();"><i class="fas fa-times"></i></button>
    </div>
    <div class="sub-row-meta">
      <div class="sub-meta-field">
        <label><i class="fas fa-calendar-day"></i> 일자</label>
        <input type="text" class="sub-date-input" placeholder="예: 6.17.(금)" value="${escHtml(date)}">
      </div>
      <div class="sub-meta-field">
        <label><i class="fas fa-clock"></i> 시간</label>
        <input type="text" class="sub-time-input" placeholder="예: 14:00~16:00" value="${escHtml(time)}">
      </div>
      <div class="sub-meta-field sub-place-field">
        <label><i class="fas fa-location-dot"></i> 장소</label>
        <input type="text" class="sub-place-input" placeholder="예: 어우러짐" value="${escHtml(place)}">
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
  document.getElementById('modal-sub-list').appendChild(row);
  if (youth || adult || leader) calcTotal();
  row.querySelector('.sub-text-input').focus();
}

function confirmProgram() {
  const name = document.getElementById('modal-prog-name').value.trim();
  if (!name) { showToast('⚠️ 항목명을 입력해주세요.'); return; }

  // 하위 항목 수집
  const subs = [...document.querySelectorAll('#modal-sub-list .sub-input-row')].map(row => ({
    text:   row.querySelector('.sub-text-input')?.value.trim()   || '',
    date:   row.querySelector('.sub-date-input')?.value.trim()   || '',
    time:   row.querySelector('.sub-time-input')?.value.trim()   || '',
    place:  row.querySelector('.sub-place-input')?.value.trim()  || '',
    youth:  Number(row.querySelector('.sub-youth-input')?.value)  || 0,
    adult:  Number(row.querySelector('.sub-adult-input')?.value)  || 0,
    leader: Number(row.querySelector('.sub-leader-input')?.value) || 0
  })).filter(s => s.text);

  // 인원 결정: 세부 항목에 인원값이 있으면 자동합산, 없으면 직접입력값
  const hasSubPeople = subs.some(s => (s.youth > 0 || s.adult > 0 || s.leader > 0));
  let finalYouth, finalAdult, finalLeader;
  if (hasSubPeople) {
    finalYouth  = subs.reduce((acc, s) => acc + s.youth,  0);
    finalAdult  = subs.reduce((acc, s) => acc + s.adult,  0);
    finalLeader = subs.reduce((acc, s) => acc + s.leader, 0);
  } else {
    finalYouth  = Number(document.getElementById('modal-youth').value)  || 0;
    finalAdult  = Number(document.getElementById('modal-adult').value)  || 0;
    finalLeader = Number(document.getElementById('modal-leader').value) || 0;
  }

  const data = {
    name,
    subs,
    dates:  document.getElementById('modal-dates').value.trim(),
    time:   document.getElementById('modal-time').value.trim(),
    place:  document.getElementById('modal-place').value.trim(),
    youth:  finalYouth,
    adult:  finalAdult,
    leader: finalLeader,
    notes:  document.getElementById('modal-notes').value.trim()
  };

  const { teamIdx, mIdx, type, editIdx } = appState.modal;
  const member = appState.programs[teamIdx][mIdx];
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
}

/* ============================================================
   안건 관리
   ============================================================ */

function renderAgenda() {
  const list = document.getElementById('agenda-edit-list');
  if (!list) return;
  list.innerHTML = '';
  appState.agenda.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'agenda-item' + (item.fixed ? ' agenda-fixed' : '');
    li.setAttribute('draggable', 'true');
    li.dataset.idx = idx;
    li.innerHTML = `
      <span class="agenda-drag-handle" title="드래그하여 순서 변경"><i class="fas fa-grip-vertical"></i></span>
      <span class="agenda-num">${idx + 1}</span>
      <div class="agenda-item-content">
        <input type="text" class="agenda-item-input"
          value="${escHtml(item.text)}" placeholder="안건 내용 입력"
          oninput="updateAgendaText(${idx}, this.value)">
        ${item.fixed ? '<span class="agenda-fixed-badge">고정</span>' : ''}
      </div>
      <button class="agenda-del-btn" onclick="deleteAgendaItem(${idx})" ${item.fixed ? 'disabled' : ''}>
        <i class="fas fa-times"></i>
      </button>`;
    li.addEventListener('dragstart', onAgendaDragStart);
    li.addEventListener('dragover',  onAgendaDragOver);
    li.addEventListener('drop',      onAgendaDrop);
    li.addEventListener('dragend',   onAgendaDragEnd);
    list.appendChild(li);
  });
}

function updateAgendaText(idx, val) { appState.agenda[idx].text = val; autoSave(); }

function addAgendaItem() {
  const lastFixed = [...appState.agenda].reverse().findIndex(a => a.fixed);
  const at = lastFixed >= 0 ? appState.agenda.length - lastFixed - 1 : appState.agenda.length;
  appState.agenda.splice(at, 0, { text:'', fixed:false });
  renderAgenda();
  autoSave();
  setTimeout(() => {
    const inputs = document.querySelectorAll('.agenda-item-input');
    if (inputs[at]) inputs[at].focus();
  }, 50);
}

function deleteAgendaItem(idx) {
  if (appState.agenda[idx].fixed) return;
  appState.agenda.splice(idx, 1);
  renderAgenda(); autoSave();
  showToast('🗑️ 안건이 삭제되었습니다.');
}

function resetAgenda() {
  if (!confirm('안건을 기본값으로 복원할까요?')) return;
  appState.agenda = DEFAULT_AGENDA.map(a => ({ ...a }));
  renderAgenda(); autoSave();
  showToast('🔄 기본 안건으로 복원되었습니다.');
}

let agendaDragSrc = null;
function onAgendaDragStart(e) { agendaDragSrc = Number(this.dataset.idx); this.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; }
function onAgendaDragOver(e)  { e.preventDefault(); document.querySelectorAll('.agenda-item').forEach(el=>el.classList.remove('drag-over')); this.classList.add('drag-over'); }
function onAgendaDrop(e) {
  e.preventDefault();
  const to = Number(this.dataset.idx);
  if (agendaDragSrc === null || agendaDragSrc === to) return;
  const moved = appState.agenda.splice(agendaDragSrc, 1)[0];
  appState.agenda.splice(to, 0, moved);
  renderAgenda(); autoSave();
}
function onAgendaDragEnd() { document.querySelectorAll('.agenda-item').forEach(el=>el.classList.remove('dragging','drag-over')); agendaDragSrc=null; }

/* ============================================================
   도산의 말씀
   ============================================================ */

function initDozanLivePreview() {
  document.getElementById('dozan-content').addEventListener('input', updateDozanPreview);
  document.getElementById('dozan-source').addEventListener('input',  updateDozanPreview);
}

function updateDozanPreview() {
  const text = document.getElementById('dozan-content').value;
  const src  = document.getElementById('dozan-source').value;
  document.getElementById('dozan-preview-content').textContent = text || '말씀을 입력하면 여기에 표시됩니다.';
  document.getElementById('dozan-preview-src').textContent     = src  ? '- ' + src + ' -' : '';
}

/* ============================================================
   공지사항 / 생일자
   ============================================================ */

function addNotice() { appState.notices.push(''); renderNotices(); }
function renderNotices() {
  const list = document.getElementById('notice-list');
  list.innerHTML = '';
  if (!appState.notices.length) {
    list.innerHTML = `<div class="prog-empty"><i class="fas fa-bullhorn"></i> 공지사항을 추가해주세요</div>`; return;
  }
  appState.notices.forEach((n, i) => {
    const row = document.createElement('div');
    row.className = 'notice-item';
    row.innerHTML = `
      <i class="fas fa-circle-info" style="color:#2a67c0;font-size:14px;flex-shrink:0;"></i>
      <input type="text" placeholder="공지 내용을 입력하세요" value="${escHtml(n)}"
        oninput="appState.notices[${i}]=this.value;autoSave()">
      <button class="btn-del-item" onclick="appState.notices.splice(${i},1);renderNotices();autoSave()">
        <i class="fas fa-times"></i></button>`;
    list.appendChild(row);
  });
}

function addBirthday() { appState.birthdays.push({ name:'', date:'' }); renderBirthdays(); }
function renderBirthdays() {
  const list = document.getElementById('birthday-list');
  list.innerHTML = '';
  if (!appState.birthdays.length) {
    list.innerHTML = `<div class="prog-empty"><i class="fas fa-cake-candles"></i> 생일자를 추가해주세요</div>`; return;
  }
  appState.birthdays.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'birthday-item';
    row.innerHTML = `
      <i class="fas fa-cake-candles" style="color:#be185d;font-size:14px;flex-shrink:0;"></i>
      <input type="text" placeholder="이름" value="${escHtml(b.name||'')}" style="max-width:100px;"
        oninput="appState.birthdays[${i}].name=this.value;autoSave()">
      <input type="text" placeholder="생년월일 또는 직위" value="${escHtml(b.date||'')}"
        oninput="appState.birthdays[${i}].date=this.value;autoSave()">
      <button class="btn-del-item" onclick="appState.birthdays.splice(${i},1);renderBirthdays();autoSave()">
        <i class="fas fa-times"></i></button>`;
    list.appendChild(row);
  });
}

/* ============================================================
   데이터 수집 / 복원
   ============================================================ */

function collectData() {
  return {
    year:      Number(document.getElementById('info-year').value),
    month:     Number(document.getElementById('info-month').value),
    date:      document.getElementById('info-date').value.trim(),
    place:     document.getElementById('info-place').value.trim(),
    agenda:    appState.agenda.map(a => ({ ...a })),
    teamOrder: [...appState.teamOrder],
    dozan: {
      content: document.getElementById('dozan-content').value.trim(),
      source:  document.getElementById('dozan-source').value.trim()
    },
    programs: {
      0: appState.programs[0].map(m => ({ ...m, prev:[...m.prev], next:[...m.next] })),
      1: appState.programs[1].map(m => ({ ...m, prev:[...m.prev], next:[...m.next] })),
      2: appState.programs[2].map(m => ({ ...m, prev:[...m.prev], next:[...m.next] }))
    },
    notices:   [...appState.notices],
    birthdays: appState.birthdays.map(b => ({ ...b })),
    savedAt:   new Date().toISOString()
  };
}

function restoreData(d) {
  if (!d) return;
  if (d.year)  document.getElementById('info-year').value  = d.year;
  if (d.month) document.getElementById('info-month').value = d.month;
  if (d.date)  document.getElementById('info-date').value  = d.date;
  if (d.place) document.getElementById('info-place').value = d.place;

  appState.agenda = (d.agenda && d.agenda.length)
    ? d.agenda.map(a => ({ ...a }))
    : DEFAULT_AGENDA.map(a => ({ ...a }));
  renderAgenda();

  appState.teamOrder = (d.teamOrder && d.teamOrder.length === 3) ? [...d.teamOrder] : [0,1,2];
  renderTeamStepTabs();

  if (d.dozan) {
    document.getElementById('dozan-content').value = d.dozan.content || '';
    document.getElementById('dozan-source').value  = d.dozan.source  || '';
    updateDozanPreview();
  }

  // programs 복원 (구버전 호환: 팀당 객체 → 담당자 배열)
  if (d.programs) {
    [0,1,2].forEach(i => {
      const raw = d.programs[i];
      if (Array.isArray(raw)) {
        // 신버전: 담당자 배열
        appState.programs[i] = raw.map(m => ({
          id:    m.id    || genId(),
          name:  m.name  || '',
          title: m.title || '',
          prev:  Array.isArray(m.prev) ? m.prev : [],
          next:  Array.isArray(m.next) ? m.next : []
        }));
      } else if (raw && typeof raw === 'object') {
        // 구버전: { prev:[], next:[] } → 담당자 1명으로 변환
        appState.programs[i] = [{
          id: genId(), name:'', title:'',
          prev: raw.prev || [],
          next: raw.next || []
        }];
      } else {
        appState.programs[i] = [];
      }
      renderMemberList(i);
    });
  }

  if (d.notices)   { appState.notices   = [...d.notices];            renderNotices();   }
  if (d.birthdays) { appState.birthdays = d.birthdays.map(b=>({...b})); renderBirthdays(); }
}

/* ============================================================
   미리보기 생성
   ============================================================ */

function generatePreview() {
  const d = collectData();
  document.getElementById('preview-title-label').textContent = `${d.year}년 ${d.month}월 전체회의 자료`;

  const teamIcons   = ['fas fa-users-gear','fas fa-chalkboard-teacher','fas fa-child-reaching'];
  const teamClasses = ['','team-edu','team-youth'];

  const agendaHtml = d.agenda.filter(a=>a.text.trim()).map(a=>`<li>${escHtml(a.text)}</li>`).join('');

  let html = `
    <div class="doc-title">
      강 서 청 소 년 회 관
      <br><span style="font-size:18px;letter-spacing:.1em;">${d.year}년 ${d.month}월 전체회의 자료</span>
    </div>
    <div class="doc-info-row">
      <span><i class="fas fa-calendar-alt" style="color:#1a4a8a"></i> 일시: ${escHtml(d.date)||'미입력'}</span>
      <span><i class="fas fa-location-dot" style="color:#1a4a8a"></i> 장소: ${escHtml(d.place)||'미입력'}</span>
    </div>
    <div class="doc-agenda">
      <div class="doc-agenda-title"><i class="fas fa-list-ol"></i> 안건</div>
      <ol>${agendaHtml}</ol>
    </div>
    <div class="doc-section">
      <div class="doc-section-title"><i class="fas fa-quote-left"></i> 도산의 말씀</div>
      <div class="doc-dozan">
        <div class="doc-dozan-text">${escHtml(d.dozan.content)||'(말씀 미입력)'}</div>
        ${d.dozan.source?`<div class="doc-dozan-source">- ${escHtml(d.dozan.source)} -</div>`:''}
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title"><i class="fas fa-users"></i> 팀별 보고</div>`;

  d.teamOrder.forEach(teamIdx => {
    const members = d.programs[teamIdx] || [];
    html += `
      <div style="margin-bottom:28px;">
        <div class="doc-team-header ${teamClasses[teamIdx]}">
          <span><i class="${teamIcons[teamIdx]}"></i> ${TEAMS[teamIdx].name}</span>
          <span style="font-size:11px;opacity:.8;">${members.length}명</span>
        </div>`;

    if (!members.length) {
      html += `<p style="font-size:12px;color:#94a3b8;padding:8px 16px;">입력된 담당자가 없습니다.</p>`;
    } else {
      members.forEach(member => {
        const badge = member.title ? ` <span style="font-size:11px;font-weight:400;opacity:.75;">${escHtml(member.title)}</span>` : '';
        html += `<div class="doc-member-block">`;
        html += `<div class="doc-member-title"><i class="fas fa-user-tie"></i> ${escHtml(member.name||'(이름 미입력)')}${badge}</div>`;

        // 전월 보고
        html += `<div class="doc-sub-title prev"><i class="fas fa-chart-bar"></i> 전월 활동 보고</div>`;
        if (!member.prev.length) {
          html += `<p style="font-size:12px;color:#94a3b8;padding:4px 16px;">입력된 내용이 없습니다.</p>`;
        } else {
          member.prev.forEach(p => { html += buildDocProgram(p); });
        }

        // 당월 계획
        html += `<div class="doc-sub-title next" style="margin-top:10px;"><i class="fas fa-calendar-check"></i> 당월 활동 계획</div>`;
        if (!member.next.length) {
          html += `<p style="font-size:12px;color:#94a3b8;padding:4px 16px;">입력된 내용이 없습니다.</p>`;
        } else {
          member.next.forEach(p => { html += buildDocProgram(p); });
        }
        html += `</div>`; // /doc-member-block
      });
    }
    html += `</div>`; // /팀 블록
  });

  html += `</div>`; // /팀별 보고

  // 공지사항
  html += `<div class="doc-section"><div class="doc-section-title"><i class="fas fa-bullhorn"></i> 기타 공지사항</div>`;
  const notices = d.notices.filter(n=>n.trim());
  if (!notices.length) { html += `<p style="font-size:12px;color:#94a3b8;">입력된 공지사항이 없습니다.</p>`; }
  else notices.forEach(n => { html += `<div class="doc-notice-item"><i class="fas fa-circle-dot" style="font-size:8px;margin-right:6px;"></i>${escHtml(n)}</div>`; });
  html += `</div>`;

  // 생일
  html += `<div class="doc-section"><div class="doc-section-title"><i class="fas fa-cake-candles"></i> 직원 생일 축하 🎉</div>`;
  const bdays = d.birthdays.filter(b=>b.name.trim());
  if (!bdays.length) { html += `<p style="font-size:12px;color:#94a3b8;">이달의 생일자 정보가 없습니다.</p>`; }
  else bdays.forEach(b => { html += `<span class="doc-birthday-item">🎂 ${escHtml(b.name)}${b.date?' ('+escHtml(b.date)+')':''}</span>`; });
  html += `</div>`;

  html += `<div style="text-align:center;margin-top:40px;padding-top:16px;border-top:1.5px solid #e2e8f0;font-size:11px;color:#94a3b8;">강서청소년회관 · ${d.year}년 ${d.month}월 전체회의</div>`;

  document.getElementById('preview-document').innerHTML = html;
  showPage('preview');
  showToast('📄 회의자료가 생성되었습니다!');
}

function buildDocProgram(prog) {
  const metas = [];
  if (prog.dates) metas.push(`<span><i class="fas fa-calendar-day"></i> ${escHtml(prog.dates)}</span>`);
  if (prog.time)  metas.push(`<span><i class="fas fa-clock"></i> ${escHtml(prog.time)}</span>`);
  if (prog.place) metas.push(`<span><i class="fas fa-location-dot"></i> ${escHtml(prog.place)}</span>`);

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
    metas.push(`<span><i class="fas fa-users"></i> ${escHtml(prog.participants)}</span>`);
  }

  // 하위 항목
  const subsHtml = (prog.subs || []).map(s => {
    if (typeof s === 'string') return `<div class="doc-program-sub">${escHtml(s)}</div>`;
    const subMeta = [];
    if (s.date)  subMeta.push(`<span class="doc-sub-meta-item"><i class="fas fa-calendar-day"></i>${escHtml(s.date)}</span>`);
    if (s.time)  subMeta.push(`<span class="doc-sub-meta-item"><i class="fas fa-clock"></i>${escHtml(s.time)}</span>`);
    if (s.place) subMeta.push(`<span class="doc-sub-meta-item"><i class="fas fa-location-dot"></i>${escHtml(s.place)}</span>`);
    const sy = Number(s.youth)||0, sa = Number(s.adult)||0, sl = Number(s.leader)||0, st = sy+sa+sl;
    if (st > 0) {
      const pp = [];
      if (sy > 0) pp.push(`청소년 ${sy}명`);
      if (sa > 0) pp.push(`성인 ${sa}명`);
      if (sl > 0) pp.push(`지도자 ${sl}명`);
      subMeta.push(`<span class="doc-sub-meta-item"><i class="fas fa-users"></i>${pp.join('/')} (${st}명)</span>`);
    }
    return `<div class="doc-program-sub">
      <span class="doc-sub-text">${escHtml(s.text)}</span>
      ${subMeta.length ? `<span class="doc-sub-meta-wrap">${subMeta.join('')}</span>` : ''}
    </div>`;
  }).join('');

  return `
    <div class="doc-program">
      <div class="doc-program-name">■ ${escHtml(prog.name)}</div>
      ${metas.length ? `<div class="doc-program-meta">${metas.join('')}</div>` : ''}
      ${subsHtml}
      ${prog.notes ? `<div style="font-size:11px;color:#7c3aed;margin-top:4px;">※ ${escHtml(prog.notes)}</div>` : ''}
    </div>`;
}

/* ============================================================
   실적 통계 페이지
   ============================================================ */

function renderStats() {
  const container = document.getElementById('stats-content');
  if (!container) return;

  const { prev, curr } = getMonthInfo();

  // 기간 라벨 갱신
  const periodLabel = document.getElementById('stats-period-label');
  if (periodLabel) {
    periodLabel.textContent =
      `${prev.year}년 ${prev.month}월(전월) ~ ${curr.year}년 ${curr.month}월(당월) 실적`;
  }

  // 전체 데이터가 있는지 확인
  const hasData = [0,1,2].some(i =>
    (appState.programs[i] || []).some(m =>
      (m.prev && m.prev.length) || (m.next && m.next.length)
    )
  );

  if (!hasData) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-chart-pie"></i>
        <p>입력 탭에서 팀별 프로그램 자료를 작성한 후 확인하세요.</p>
      </div>`;
    return;
  }

  // 공통 집계 함수 재사용
  const { sections, grandYouth, grandAdult, grandLeader,
          grandPrevY, grandPrevA, grandPrevL,
          grandNextY, grandNextA, grandNextL } =
    buildTeamStatsSections(prev, curr, { showPlace: true });

  // 전체 합계 카드
  const grandTotal  = grandYouth + grandAdult + grandLeader;
  const grandPrevT  = grandPrevY + grandPrevA + grandPrevL;
  const grandNextT  = grandNextY + grandNextA + grandNextL;

  /* 전월/당월 소계 칩 헬퍼 */
  function periodChips(py, pa, pl, period, colorVar) {
    const pt = py+pa+pl;
    if (pt === 0) return `<span style="font-size:12px;color:var(--gray-400);">입력 없음</span>`;
    return `
      <span class="stats-period-chip" style="background:rgba(${colorVar},0.10);color:rgba(${colorVar},1)">
        <i class="fas fa-child"></i> ${py}
      </span>
      <span class="stats-period-chip" style="background:rgba(${colorVar},0.10);color:rgba(${colorVar},1)">
        <i class="fas fa-person"></i> ${pa}
      </span>
      <span class="stats-period-chip" style="background:rgba(${colorVar},0.10);color:rgba(${colorVar},1)">
        <i class="fas fa-chalkboard-user"></i> ${pl}
      </span>
      <span class="stats-period-chip total" style="background:rgba(${colorVar},0.18);color:rgba(${colorVar},1);font-weight:700">
        합계 ${pt}명
      </span>`;
  }

  const summaryHtml = `
    <div class="stats-grand-summary">
      <div class="stats-grand-card youth-card">
        <div class="stats-grand-icon"><i class="fas fa-child"></i></div>
        <div class="stats-grand-label">총 청소년</div>
        <div class="stats-grand-num">${grandYouth}<span>명</span></div>
        <div class="stats-grand-sub">
          <span class="stats-sub-period prev">전월 ${grandPrevY}명</span>
          <span class="stats-sub-period next">당월 ${grandNextY}명</span>
        </div>
      </div>
      <div class="stats-grand-card adult-card">
        <div class="stats-grand-icon"><i class="fas fa-person"></i></div>
        <div class="stats-grand-label">총 성인</div>
        <div class="stats-grand-num">${grandAdult}<span>명</span></div>
        <div class="stats-grand-sub">
          <span class="stats-sub-period prev">전월 ${grandPrevA}명</span>
          <span class="stats-sub-period next">당월 ${grandNextA}명</span>
        </div>
      </div>
      <div class="stats-grand-card leader-card">
        <div class="stats-grand-icon"><i class="fas fa-chalkboard-user"></i></div>
        <div class="stats-grand-label">총 지도자</div>
        <div class="stats-grand-num">${grandLeader}<span>명</span></div>
        <div class="stats-grand-sub">
          <span class="stats-sub-period prev">전월 ${grandPrevL}명</span>
          <span class="stats-sub-period next">당월 ${grandNextL}명</span>
        </div>
      </div>
      <div class="stats-grand-card total-card">
        <div class="stats-grand-icon"><i class="fas fa-users"></i></div>
        <div class="stats-grand-label">전체 합계</div>
        <div class="stats-grand-num">${grandTotal}<span>명</span></div>
        <div class="stats-grand-sub">
          <span class="stats-sub-period prev">전월 ${grandPrevT}명</span>
          <span class="stats-sub-period next">당월 ${grandNextT}명</span>
        </div>
      </div>
    </div>
    <div class="stats-period-bar-row">
      <div class="stats-period-bar prev-bar">
        <span class="stats-period-bar-label"><i class="fas fa-calendar-minus"></i> 전월 활동 보고 <em>${prev.month}월</em></span>
        <div class="stats-period-bar-chips">
          <span class="stats-sum-chip youth-chip"><i class="fas fa-child"></i> 청소년 <strong>${grandPrevY}</strong>명</span>
          <span class="stats-sum-chip adult-chip"><i class="fas fa-person"></i> 성인 <strong>${grandPrevA}</strong>명</span>
          <span class="stats-sum-chip leader-chip"><i class="fas fa-chalkboard-user"></i> 지도자 <strong>${grandPrevL}</strong>명</span>
          <span class="stats-sum-chip total-chip lg"><i class="fas fa-users"></i> 합계 <strong>${grandPrevT}</strong>명</span>
        </div>
      </div>
      <div class="stats-period-bar next-bar">
        <span class="stats-period-bar-label"><i class="fas fa-calendar-check"></i> 당월 활동 계획 <em>${curr.month}월</em></span>
        <div class="stats-period-bar-chips">
          <span class="stats-sum-chip youth-chip"><i class="fas fa-child"></i> 청소년 <strong>${grandNextY}</strong>명</span>
          <span class="stats-sum-chip adult-chip"><i class="fas fa-person"></i> 성인 <strong>${grandNextA}</strong>명</span>
          <span class="stats-sum-chip leader-chip"><i class="fas fa-chalkboard-user"></i> 지도자 <strong>${grandNextL}</strong>명</span>
          <span class="stats-sum-chip total-chip lg"><i class="fas fa-users"></i> 합계 <strong>${grandNextT}</strong>명</span>
        </div>
      </div>
    </div>`;

  container.innerHTML = summaryHtml + sections.join('');
}

/* ────────────────────────────────────────────────────────
   팀별 집계 공통 빌더 (위자드 summary 패널 & 실적통계 페이지 공유)
   · 전월 프로그램 블록 / 당월 프로그램 블록 / 팀 합계 소계행 분리
──────────────────────────────────────────────────────── */
function buildTeamStatsSections(prev, curr, opts = {}) {
  let grandPrevY=0, grandPrevA=0, grandPrevL=0;
  let grandNextY=0, grandNextA=0, grandNextL=0;

  /* 한 프로그램에서 표시 인원 3종 추출 */
  function getDispNums(prog) {
    const py=Number(prog.youth)||0, pa=Number(prog.adult)||0, pl=Number(prog.leader)||0;
    const subY=(prog.subs||[]).reduce((a,s)=>a+(Number(s.youth)||0),  0);
    const subA=(prog.subs||[]).reduce((a,s)=>a+(Number(s.adult)||0),  0);
    const subL=(prog.subs||[]).reduce((a,s)=>a+(Number(s.leader)||0), 0);
    const hasSub=(subY+subA+subL)>0;
    return { y:hasSub?subY:py, a:hasSub?subA:pa, l:hasSub?subL:pl };
  }

  /* 프로그램 TR + 하위항목 TR 생성 */
  function buildProgRows(progsArr, memberName, badgeHtml) {
    return progsArr.map(prog => {
      const { y, a, l } = getDispNums(prog);
      const t = y+a+l;
      const subRows = (prog.subs||[]).filter(s=>s.text).map(s => {
        const sy=Number(s.youth)||0, sa=Number(s.adult)||0, sl=Number(s.leader)||0, st=sy+sa+sl;
        return `<tr class="stats-sub-row">
          <td></td>
          <td class="stats-sub-name"><i class="fas fa-turn-down" style="font-size:10px;color:var(--gray-400);margin-right:4px;"></i>${escHtml(s.text)}</td>
          <td>${s.date  ? escHtml(s.date)  : '-'}</td>
          <td>${s.time  ? escHtml(s.time)  : '-'}</td>
          <td>${s.place ? escHtml(s.place) : '-'}</td>
          <td class="stats-num youth">${sy>0?sy:'-'}</td>
          <td class="stats-num adult">${sa>0?sa:'-'}</td>
          <td class="stats-num leader">${sl>0?sl:'-'}</td>
          <td class="stats-num total">${st>0?st:'-'}</td>
        </tr>`;
      }).join('');
      return `
        <tr class="stats-prog-row">
          <td>${badgeHtml}</td>
          <td class="stats-prog-name"><strong>${escHtml(prog.name)}</strong><br><span class="stats-member-tag">${escHtml(memberName)}</span></td>
          <td>${prog.dates?escHtml(prog.dates):'-'}</td>
          <td>${prog.time ?escHtml(prog.time) :'-'}</td>
          <td>${prog.place?escHtml(prog.place):'-'}</td>
          <td class="stats-num youth">${y>0?y:'-'}</td>
          <td class="stats-num adult">${a>0?a:'-'}</td>
          <td class="stats-num leader">${l>0?l:'-'}</td>
          <td class="stats-num total ${t>0?'has-data':''}">${t>0?t+'명':'-'}</td>
        </tr>${subRows}`;
    }).join('');
  }

  /* 기간별 소계행 */
  function subtotalRow(label, sy, sa, sl, cls) {
    const st = sy+sa+sl;
    return `<tr class="stats-period-subtotal ${cls}">
      <td colspan="5" class="stats-subtotal-label">${label} 소계</td>
      <td class="stats-num youth"><strong>${sy>0?sy:'-'}</strong></td>
      <td class="stats-num adult"><strong>${sa>0?sa:'-'}</strong></td>
      <td class="stats-num leader"><strong>${sl>0?sl:'-'}</strong></td>
      <td class="stats-num total has-data"><strong>${st>0?st+'명':'-'}</strong></td>
    </tr>`;
  }

  const sections = appState.teamOrder.map(teamIdx => {
    const team    = TEAMS[teamIdx];
    const members = appState.programs[teamIdx] || [];

    // 전월 / 당월 인원 누계
    let prevY=0, prevA=0, prevL=0;
    let nextY=0, nextA=0, nextL=0;

    // 전월 / 당월 행 모음
    let prevRows = '', nextRows = '';
    let hasPrev = false, hasNext = false;

    members.forEach(member => {
      const memberName = member.name || '(이름 미입력)';
      const prevBadge = `<span class="stats-badge prev-badge">${prev.month}월(전월)</span>`;
      const nextBadge = `<span class="stats-badge next-badge">${curr.month}월(당월)</span>`;

      // 전월 집계
      (member.prev || []).forEach(prog => {
        const { y, a, l } = getDispNums(prog);
        prevY+=y; prevA+=a; prevL+=l;
      });
      prevRows += buildProgRows(member.prev || [], memberName, prevBadge);
      if ((member.prev||[]).length) hasPrev = true;

      // 당월 집계
      (member.next || []).forEach(prog => {
        const { y, a, l } = getDispNums(prog);
        nextY+=y; nextA+=a; nextL+=l;
      });
      nextRows += buildProgRows(member.next || [], memberName, nextBadge);
      if ((member.next||[]).length) hasNext = true;
    });

    const teamY = prevY+nextY, teamA = prevA+nextA, teamL = prevL+nextL;

    grandPrevY+=prevY; grandPrevA+=prevA; grandPrevL+=prevL;
    grandNextY+=nextY; grandNextA+=nextA; grandNextL+=nextL;

    if (!hasPrev && !hasNext) {
      return `
        <div class="stats-team-block">
          <div class="stats-team-header" style="background:${team.color}15;border-left:4px solid ${team.color};">
            <span class="stats-team-name" style="color:${team.color}"><i class="fas fa-users"></i> ${escHtml(team.name)}</span>
            <span style="font-size:12px;color:var(--gray-400);">입력된 프로그램 없음</span>
          </div>
        </div>`;
    }

    // 전월 섹션 그룹 헤더 행
    const prevGroupRow = hasPrev ? `
      <tr class="stats-period-group-row prev-group">
        <td colspan="9"><i class="fas fa-calendar-minus"></i> 전월 활동 보고 <span class="stats-period-month">${prev.month}월 (${prev.year})</span></td>
      </tr>` : '';

    const nextGroupRow = hasNext ? `
      <tr class="stats-period-group-row next-group">
        <td colspan="9"><i class="fas fa-calendar-check"></i> 당월 활동 계획 <span class="stats-period-month">${curr.month}월 (${curr.year})</span></td>
      </tr>` : '';

    const prevSubtotalRow = hasPrev ? subtotalRow(`전월 ${prev.month}월`, prevY, prevA, prevL, 'prev-subtotal') : '';
    const nextSubtotalRow = hasNext ? subtotalRow(`당월 ${curr.month}월`, nextY, nextA, nextL, 'next-subtotal') : '';

    const teamTotal = teamY+teamA+teamL;
    const teamSubtotalRow = `
      <tr class="stats-team-subtotal">
        <td colspan="5" style="text-align:right;font-weight:700;color:var(--gray-600);">팀 합계</td>
        <td class="stats-num youth"><strong>${teamY>0?teamY:'-'}</strong></td>
        <td class="stats-num adult"><strong>${teamA>0?teamA:'-'}</strong></td>
        <td class="stats-num leader"><strong>${teamL>0?teamL:'-'}</strong></td>
        <td class="stats-num total has-data"><strong>${teamTotal>0?teamTotal+'명':'-'}</strong></td>
      </tr>`;

    return `
      <div class="stats-team-block">
        <div class="stats-team-header" style="background:${team.color}15;border-left:4px solid ${team.color};">
          <span class="stats-team-name" style="color:${team.color}">
            <i class="fas fa-users"></i> ${escHtml(team.name)}
          </span>
          <div class="stats-team-summary">
            <span class="stats-sum-chip youth-chip"><i class="fas fa-child"></i> 청소년 <strong>${teamY}</strong>명</span>
            <span class="stats-sum-chip adult-chip"><i class="fas fa-person"></i> 성인 <strong>${teamA}</strong>명</span>
            <span class="stats-sum-chip leader-chip"><i class="fas fa-chalkboard-user"></i> 지도자 <strong>${teamL}</strong>명</span>
            <span class="stats-sum-chip total-chip"><i class="fas fa-users"></i> 합계 <strong>${teamTotal}</strong>명</span>
          </div>
        </div>
        <div class="stats-table-wrap">
          <table class="stats-table">
            <thead>
              <tr>
                <th style="width:88px;">구분</th>
                <th style="min-width:130px;">프로그램명</th>
                <th style="width:90px;">일시</th>
                <th style="width:100px;">시간</th>
                <th style="width:100px;">장소</th>
                <th style="width:64px;"><i class="fas fa-child"></i> 청소년</th>
                <th style="width:60px;"><i class="fas fa-person"></i> 성인</th>
                <th style="width:64px;"><i class="fas fa-chalkboard-user"></i> 지도자</th>
                <th style="width:72px;"><i class="fas fa-users"></i> 합계</th>
              </tr>
            </thead>
            <tbody>
              ${prevGroupRow}${prevRows}${prevSubtotalRow}
              ${nextGroupRow}${nextRows}${nextSubtotalRow}
              ${teamSubtotalRow}
            </tbody>
          </table>
        </div>
      </div>`;
  });

  // grand 합산
  const grandYouth  = grandPrevY + grandNextY;
  const grandAdult  = grandPrevA + grandNextA;
  const grandLeader = grandPrevL + grandNextL;

  return {
    sections,
    grandYouth, grandAdult, grandLeader,
    grandPrevY, grandPrevA, grandPrevL,
    grandNextY, grandNextA, grandNextL
  };
}

/* ────────────────────────────────────────────────────────
   팀별 집계 시트 (위자드 단계 6 — panel-summary)
──────────────────────────────────────────────────────── */
function renderTeamSummary() {
  const container = document.getElementById('summary-content');
  if (!container) return;

  const { prev, curr } = getMonthInfo();

  const hasData = [0,1,2].some(i =>
    (appState.programs[i]||[]).some(m => (m.prev&&m.prev.length)||(m.next&&m.next.length))
  );

  // 내보내기 버튼 숨김
  const exportBtn = document.getElementById('summary-export-actions');
  if (exportBtn) exportBtn.style.display = 'none';

  if (!hasData) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-table-cells"></i>
        <p>팀별 보고 단계에서 프로그램을 입력하면<br>여기에 자동으로 집계됩니다.</p>
      </div>`;
    return;
  }

  const { sections, grandYouth, grandAdult, grandLeader } =
    buildTeamStatsSections(prev, curr);

  const grandTotal = grandYouth + grandAdult + grandLeader;

  // 전체 합계 요약 바
  const summaryBar = `
    <div class="summary-total-bar">
      <span class="summary-bar-title"><i class="fas fa-sigma"></i> 전체 집계</span>
      <div class="summary-bar-chips">
        <span class="stats-sum-chip youth-chip lg"><i class="fas fa-child"></i> 청소년 <strong>${grandYouth}</strong>명</span>
        <span class="stats-sum-chip adult-chip lg"><i class="fas fa-person"></i> 성인 <strong>${grandAdult}</strong>명</span>
        <span class="stats-sum-chip leader-chip lg"><i class="fas fa-chalkboard-user"></i> 지도자 <strong>${grandLeader}</strong>명</span>
        <span class="stats-sum-chip total-chip lg"><i class="fas fa-users"></i> 합계 <strong>${grandTotal}</strong>명</span>
      </div>
    </div>`;

  container.innerHTML = summaryBar + sections.join('');

  // 데이터 있으면 내보내기 버튼 표시
  if (exportBtn) exportBtn.style.display = 'flex';
}

/* ────────────────────────────────────────────────────────
   팀별 집계 인쇄 / PDF 저장
──────────────────────────────────────────────────────── */
function printTeamSummary(mode) {
  const { prev, curr } = getMonthInfo();
  const d = collectData();
  const docTitle = `${d.year}년 ${d.month}월 전체회의 — 팀별 사업 인원 집계`;

  // 현재 summary-content HTML 그대로 가져오기
  const contentEl = document.getElementById('summary-content');
  if (!contentEl || contentEl.querySelector('.empty-state')) {
    alert('집계 데이터가 없습니다. 팀별 보고를 먼저 입력해주세요.');
    return;
  }

  // 인쇄용 HTML 생성 (아이콘 폰트 포함)
  const contentHtml = contentEl.innerHTML;

  const pw = window.open('', '_blank', 'width=1100,height=820');
  pw.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escHtml(docTitle)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── 화면 툴바 ── */
#toolbar{
  position:fixed;top:0;left:0;right:0;height:54px;
  background:#1a4a8a;color:#fff;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 24px;z-index:9999;gap:12px;
  font-family:'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif;
}
.tb-left{display:flex;flex-direction:column;gap:2px;}
.tb-title{font-size:13pt;font-weight:700;}
.tb-sub{font-size:9pt;opacity:.75;}
.tb-btns{display:flex;gap:10px;}
.tb-btns button{
  display:flex;align-items:center;gap:6px;
  border:none;border-radius:6px;padding:8px 18px;
  font-size:11pt;font-weight:700;cursor:pointer;
  font-family:inherit;
}
.btn-print-now{background:#fff;color:#1a4a8a;}
.btn-print-now:hover{background:#dbeafe;}
.btn-pdf-now{background:#dc2626;color:#fff;}
.btn-pdf-now:hover{background:#b91c1c;}

/* ── 본문 ── */
body{
  font-family:'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif;
  background:#e8edf2;
  padding-top:66px;
  font-size:10pt;
  color:#1e293b;
}
.body-inner{padding:20px;max-width:1100px;margin:0 auto;}

/* ── 문서 헤더 ── */
.doc-header{
  background:#fff;border-radius:10px;
  box-shadow:0 2px 8px rgba(0,0,0,.10);
  padding:18px 24px;margin-bottom:20px;
  display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:12px;
}
.doc-header-title{
  font-size:16pt;font-weight:800;color:#1a4a8a;
  display:flex;align-items:center;gap:10px;
}
.doc-header-meta{font-size:9pt;color:#64748b;text-align:right;line-height:1.7;}

/* ── 전체 합계 바 ── */
.summary-total-bar{
  display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:10px;
  background:linear-gradient(135deg,#1a4a8a,#2a67c0);
  color:#fff;border-radius:10px;padding:14px 20px;
  margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.12);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.summary-bar-title{font-size:13pt;font-weight:700;display:flex;align-items:center;gap:8px;}
.summary-bar-chips{display:flex;flex-wrap:wrap;gap:8px;}

/* ── 팀 블록 ── */
.stats-team-block{
  background:#fff;border-radius:10px;
  box-shadow:0 2px 8px rgba(0,0,0,.08);
  margin-bottom:18px;overflow:hidden;
}
.stats-team-header{
  display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:8px;padding:12px 18px;
}
.stats-team-name{font-size:13pt;font-weight:700;display:flex;align-items:center;gap:6px;}
.stats-team-summary{display:flex;flex-wrap:wrap;gap:6px;}

/* ── 인원 칩 ── */
.stats-sum-chip{
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 12px;border-radius:20px;font-size:11pt;font-weight:600;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.stats-sum-chip.lg{padding:5px 16px;font-size:12pt;}
.youth-chip{background:#dbeafe;color:#1e40af;}
.adult-chip{background:#dcfce7;color:#166534;}
.leader-chip{background:#ede9fe;color:#6d28d9;}
.total-chip{background:#f1f5f9;color:#334155;}

/* ── 테이블 래퍼 ── */
.stats-table-wrap{overflow-x:auto;padding:0 4px 4px;}
.stats-table{width:100%;border-collapse:collapse;font-size:9pt;}
.stats-table th,.stats-table td{
  border:1px solid #d1d5db;padding:6px 10px;vertical-align:middle;
}
.stats-table th{
  background:#1e3a5f;color:#fff;font-weight:700;text-align:center;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.stats-table td{background:#fff;text-align:left;}
.stats-num{text-align:center!important;font-variant-numeric:tabular-nums;}
.stats-num.youth{color:#1e40af;font-weight:600;}
.stats-num.adult{color:#166534;font-weight:600;}
.stats-num.leader{color:#6d28d9;font-weight:600;}
.stats-num.total{color:#334155;}
.stats-num.has-data{font-weight:700;}

/* ── 배지 ── */
.stats-badge{
  display:inline-block;padding:2px 8px;border-radius:10px;
  font-size:9pt;font-weight:700;white-space:nowrap;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.prev-badge{background:#fef3c7;color:#d97706;}
.next-badge{background:#e8f6ee;color:#2e8a57;}

/* ── 기간 그룹 헤더 ── */
.stats-period-group-row td{font-size:11pt;font-weight:700;padding:8px 14px;}
.stats-period-group-row.prev-group td{
  background:#fef3c7;color:#d97706;
  border-top:2px solid rgba(217,119,6,.2);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.stats-period-group-row.next-group td{
  background:#e8f6ee;color:#2e8a57;
  border-top:2px solid rgba(46,138,87,.2);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.stats-period-month{font-size:9pt;font-weight:400;margin-left:6px;opacity:.8;}

/* ── 소계 행 ── */
.stats-period-subtotal td{padding:7px 12px;font-size:10pt;}
.stats-period-subtotal.prev-subtotal{
  background:rgba(217,119,6,.06);border-top:1.5px solid rgba(217,119,6,.18);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.stats-period-subtotal.next-subtotal{
  background:rgba(46,138,87,.06);border-top:1.5px solid rgba(46,138,87,.18);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.stats-subtotal-label{text-align:right;font-size:10pt;font-weight:700;color:#475569;}
.stats-period-subtotal.prev-subtotal .stats-subtotal-label{color:#d97706;}
.stats-period-subtotal.next-subtotal .stats-subtotal-label{color:#2e8a57;}

/* ── 팀 합계 행 ── */
.stats-team-subtotal td{
  background:#f1f5f9;font-size:10pt;
  border-top:2px solid #cbd5e1;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}

/* ── 하위 항목 ── */
.stats-sub-row td{background:#f8fafc;font-size:8.5pt;color:#475569;}
.stats-sub-name{padding-left:18px!important;}
.stats-prog-name{font-size:9.5pt;}
.stats-member-tag{font-size:8pt;color:#94a3b8;}

/* ── 빈 상태 (혹시 모르니) ── */
.empty-state{display:none;}

/* ═══════════ 인쇄 전용 ═══════════ */
@media print{
  @page{size:A4 landscape;margin:8mm 7mm;}
  #toolbar{display:none!important;}
  body{background:#fff!important;padding-top:0!important;}
  .body-inner{padding:0!important;max-width:none!important;}
  .doc-header{box-shadow:none!important;border:1px solid #e2e8f0!important;border-radius:0!important;margin-bottom:10px!important;padding:10px 14px!important;}
  .doc-header-title{font-size:13pt!important;}
  .stats-team-block{box-shadow:none!important;border:1px solid #e2e8f0!important;border-radius:0!important;margin-bottom:8px!important;page-break-inside:avoid;}
  .summary-total-bar{border-radius:0!important;margin-bottom:10px!important;padding:10px 14px!important;}
  .stats-table-wrap{overflow:visible!important;}
  .stats-table{font-size:7.5pt!important;}
  .stats-table th,.stats-table td{padding:3px 6px!important;}
}
</style>
</head>
<body>
<!-- 화면 툴바 -->
<div id="toolbar">
  <div class="tb-left">
    <span class="tb-title"><i class="fas fa-table-cells"></i> ${escHtml(docTitle)}</span>
    <span class="tb-sub">${prev.year}년 ${prev.month}월(전월) ~ ${curr.year}년 ${curr.month}월(당월)</span>
  </div>
  <div class="tb-btns">
    <button class="btn-print-now" onclick="window.print()">
      <i class="fas fa-print"></i> 인쇄
    </button>
    <button class="btn-pdf-now" onclick="savePdf()">
      <i class="fas fa-file-pdf"></i> PDF 저장
    </button>
  </div>
</div>

<div class="body-inner">
  <!-- 문서 헤더 -->
  <div class="doc-header">
    <div class="doc-header-title">
      <i class="fas fa-table-cells"></i> 팀별 사업 인원 집계
    </div>
    <div class="doc-header-meta">
      강서청소년회관<br>
      ${prev.year}년 ${prev.month}월(전월) ~ ${curr.year}년 ${curr.month}월(당월)<br>
      출력일: ${new Date().toLocaleDateString('ko-KR')}
    </div>
  </div>

  <!-- 집계 콘텐츠 (summary-content 그대로) -->
  ${contentHtml}
</div>

<script>
  /* PDF 저장: 인쇄 다이얼로그에서 "PDF로 저장" 선택 안내 */
  function savePdf() {
    var msg = 'PDF 저장 방법:\\n\\n' +
      '1. 아래 인쇄 창이 열립니다.\\n' +
      '2. 프린터 목록에서 "PDF로 저장" 또는\\n   "Microsoft Print to PDF"를 선택하세요.\\n' +
      '3. 저장 위치를 지정하면 PDF 파일이 생성됩니다.';
    if (confirm(msg + '\\n\\n[확인]을 누르면 인쇄 창이 열립니다.')) {
      window.print();
    }
  }
<\/script>
</body>
</html>`);
  pw.document.close();
}

/* ============================================================
   저장 / 불러오기
   ============================================================ */

function autoSave() {
  try { localStorage.setItem('kgyc_draft', JSON.stringify(collectData())); } catch(e) {}
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('kgyc_draft');
    if (!raw) return;
    restoreData(JSON.parse(raw));
    showToast('💾 이전 작업을 불러왔습니다.');
  } catch(e) {}
}

async function saveMeeting() {
  const d = collectData();
  const title = `${d.year}년 ${d.month}월 전체회의`;
  try {
    const saved = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
    const record = { id: Date.now().toString(), title, year:d.year, month:d.month,
      savedAt: new Date().toLocaleString('ko-KR'), data: d };
    const ei = saved.findIndex(s => s.year===d.year && s.month===d.month);
    if (ei >= 0) saved[ei] = record; else saved.unshift(record);
    localStorage.setItem('kgyc_history', JSON.stringify(saved));
    showToast('✅ 저장되었습니다!');
    refreshHistory();
  } catch(e) { showToast('⚠️ 저장 중 오류가 발생했습니다.'); }
}

function refreshHistory() {
  const list  = document.getElementById('history-list');
  const saved = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
  if (!saved.length) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>저장된 회의 자료가 없습니다.</p></div>`; return;
  }
  list.innerHTML = saved.map((s, i) => `
    <div class="history-card">
      <div class="history-card-icon"><i class="fas fa-file-alt"></i></div>
      <div class="history-card-body">
        <div class="history-card-title">${escHtml(s.title)}</div>
        <div class="history-card-meta">저장일시: ${s.savedAt} · 장소: ${escHtml(s.data?.place||'-')}</div>
      </div>
      <div class="history-card-actions">
        <button class="btn-hist-load" onclick="loadHistRecord(${i})"><i class="fas fa-folder-open"></i> 불러오기</button>
        <button class="btn-hist-del"  onclick="deleteHistRecord(${i})"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('');
}

function loadHistRecord(idx) {
  const saved = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
  if (!saved[idx]) return;
  restoreData(saved[idx].data);
  localStorage.setItem('kgyc_draft', JSON.stringify(saved[idx].data));
  showPage('input'); goStep('info');
  showToast(`📂 "${saved[idx].title}" 불러왔습니다.`);
}

function deleteHistRecord(idx) {
  if (!confirm('이 기록을 삭제할까요?')) return;
  const saved = JSON.parse(localStorage.getItem('kgyc_history') || '[]');
  saved.splice(idx, 1);
  localStorage.setItem('kgyc_history', JSON.stringify(saved));
  refreshHistory(); showToast('🗑️ 삭제되었습니다.');
}

function printDoc() { window.print(); }

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter')
    if (document.getElementById('modal-overlay').classList.contains('open')) confirmProgram();
});
