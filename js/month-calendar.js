/* ============================================
   월간 일정 달력 탭
   - 입력된 전월/당월 활동 중 날짜가 있는 항목을 월 단위 달력으로 표시
   - 담당자, 팀, 전월/당월, 프로그램명 기준으로 확인 가능
   ============================================ */

(function () {
  const STYLE_ID = 'monthly-calendar-style';
  const PANEL_ID = 'panel-month-calendar';
  const TAB_ID = 'step-tab-month-calendar';

  const TEAM_FALLBACK = [
    { name: '운영지원팀', color: '#1a4a8a' },
    { name: '교육·홍보팀', color: '#2e8a57' },
    { name: '청소년사업팀', color: '#7c3aed' }
  ];

  function getTeams() {
    return Array.isArray(window.TEAMS) ? window.TEAMS : TEAM_FALLBACK;
  }

  function esc(value) {
    if (typeof escHtml === 'function') return escHtml(value || '');
    return String(value || '').replace(/[&<>"]/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[s]));
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function getCurrentMonthBase() {
    const data = typeof collectData === 'function' ? collectData() : {};
    const year = Number(data.year || document.getElementById('info-year')?.value || new Date().getFullYear());
    const month = Number(data.month || document.getElementById('info-month')?.value || (new Date().getMonth() + 1));
    return { year, month };
  }

  function getPrevMonth(year, month) {
    if (month === 1) return { year: year - 1, month: 12 };
    return { year, month: month - 1 };
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .step-item-calendar .step-num { background:#e0f2fe; color:#0369a1; }
      .step-item-calendar.active .step-num { background:#0284c7; color:#fff; }

      .calendar-panel-card {
        background:#fff;
        border:1.5px solid #e2e8f0;
        border-radius:16px;
        box-shadow:0 1px 3px rgba(0,0,0,.08);
        padding:22px 24px;
        margin-bottom:16px;
      }

      .calendar-toolbar {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
        margin-bottom:16px;
      }

      .calendar-title-box h3 {
        margin:0;
        font-size:20px;
        color:#1a4a8a;
        display:flex;
        align-items:center;
        gap:8px;
      }

      .calendar-title-box p {
        margin:5px 0 0;
        font-size:12px;
        color:#64748b;
      }

      .calendar-controls {
        display:flex;
        align-items:center;
        gap:8px;
        flex-wrap:wrap;
      }

      .calendar-select,
      .calendar-input {
        border:1.5px solid #e2e8f0;
        background:#f8fafc;
        border-radius:10px;
        padding:9px 11px;
        font-family:inherit;
        font-size:13px;
        font-weight:700;
        color:#1e293b;
        outline:none;
      }

      .calendar-select:focus,
      .calendar-input:focus {
        border-color:#2a67c0;
        background:#fff;
      }

      .btn-calendar-refresh,
      .btn-calendar-this-month,
      .btn-calendar-print {
        display:inline-flex;
        align-items:center;
        gap:6px;
        border:none;
        border-radius:10px;
        padding:10px 14px;
        font-family:inherit;
        font-size:13px;
        font-weight:800;
        cursor:pointer;
        transition:.12s;
      }

      .btn-calendar-refresh { background:#1a4a8a; color:#fff; }
      .btn-calendar-this-month { background:#eef6ff; color:#1a4a8a; border:1px solid #bfdbfe; }
      .btn-calendar-print { background:#f8fafc; color:#475569; border:1px solid #e2e8f0; }
      .btn-calendar-refresh:hover,
      .btn-calendar-this-month:hover,
      .btn-calendar-print:hover { transform:translateY(-1px); }

      .calendar-summary-row {
        display:grid;
        grid-template-columns:repeat(4, minmax(0,1fr));
        gap:10px;
        margin-bottom:14px;
      }

      .calendar-summary-card {
        background:#f8fafc;
        border:1px solid #e2e8f0;
        border-radius:12px;
        padding:12px 14px;
      }

      .calendar-summary-card strong {
        display:block;
        font-size:20px;
        color:#1a4a8a;
      }

      .calendar-summary-card span {
        font-size:12px;
        color:#64748b;
        font-weight:700;
      }

      .calendar-grid {
        display:grid;
        grid-template-columns:repeat(7, minmax(0,1fr));
        border:1px solid #dbe3ef;
        border-radius:14px;
        overflow:hidden;
        background:#fff;
      }

      .calendar-weekday {
        background:#1a4a8a;
        color:#fff;
        text-align:center;
        font-size:12px;
        font-weight:800;
        padding:10px 4px;
        border-right:1px solid rgba(255,255,255,.18);
      }

      .calendar-weekday.sun { background:#b91c1c; }
      .calendar-weekday.sat { background:#1d4ed8; }

      .calendar-day {
        min-height:136px;
        padding:8px;
        border-right:1px solid #e2e8f0;
        border-bottom:1px solid #e2e8f0;
        background:#fff;
        position:relative;
      }

      .calendar-day.outside { background:#f8fafc; color:#cbd5e1; }
      .calendar-day.today { box-shadow:inset 0 0 0 2px #f59e0b; }

      .calendar-day-number {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:6px;
        font-size:12px;
        font-weight:900;
        color:#1e293b;
        margin-bottom:6px;
      }

      .calendar-day.outside .calendar-day-number { color:#94a3b8; }

      .calendar-count-badge {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-width:20px;
        height:20px;
        padding:0 6px;
        border-radius:99px;
        background:#e0f2fe;
        color:#0369a1;
        font-size:11px;
        font-weight:900;
      }

      .calendar-events {
        display:flex;
        flex-direction:column;
        gap:5px;
      }

      .calendar-event {
        border-left:4px solid #1a4a8a;
        background:#f8fafc;
        border-radius:8px;
        padding:6px 7px;
        font-size:11px;
        line-height:1.35;
        cursor:pointer;
      }

      .calendar-event:hover { background:#eef6ff; }
      .calendar-event-type {
        display:inline-flex;
        align-items:center;
        gap:3px;
        font-size:10px;
        font-weight:900;
        margin-bottom:3px;
      }
      .calendar-event-type.prev { color:#d97706; }
      .calendar-event-type.next { color:#2e8a57; }
      .calendar-event-title {
        font-weight:900;
        color:#1e293b;
        overflow:hidden;
        text-overflow:ellipsis;
        display:-webkit-box;
        -webkit-line-clamp:2;
        -webkit-box-orient:vertical;
      }
      .calendar-event-meta {
        color:#64748b;
        font-size:10px;
        margin-top:2px;
      }

      .calendar-more {
        font-size:10px;
        font-weight:800;
        color:#64748b;
        background:#f1f5f9;
        border-radius:6px;
        padding:4px 6px;
      }

      .calendar-list-card {
        margin-top:16px;
        background:#fff;
        border:1.5px solid #e2e8f0;
        border-radius:14px;
        overflow:hidden;
      }

      .calendar-list-head {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        flex-wrap:wrap;
        padding:12px 14px;
        background:#f8fafc;
        border-bottom:1px solid #e2e8f0;
        font-weight:900;
        color:#1a4a8a;
      }

      .calendar-list-table {
        width:100%;
        border-collapse:collapse;
        font-size:12px;
      }

      .calendar-list-table th {
        background:#f8fafc;
        color:#475569;
        font-weight:900;
        padding:9px;
        border-bottom:1px solid #e2e8f0;
        text-align:left;
      }

      .calendar-list-table td {
        padding:9px;
        border-bottom:1px solid #edf2f7;
        vertical-align:top;
      }

      .calendar-empty {
        padding:30px 20px;
        text-align:center;
        color:#94a3b8;
        font-weight:800;
      }

      @media(max-width:1000px) {
        .calendar-summary-row { grid-template-columns:repeat(2, minmax(0,1fr)); }
        .calendar-day { min-height:112px; padding:6px; }
      }

      @media(max-width:760px) {
        .calendar-grid { display:block; border-radius:12px; }
        .calendar-weekday { display:none; }
        .calendar-day { min-height:auto; border-right:none; }
        .calendar-day.outside { display:none; }
        .calendar-summary-row { grid-template-columns:1fr; }
      }

      @media print {
        body * { visibility:hidden !important; }
        #panel-month-calendar, #panel-month-calendar * { visibility:visible !important; }
        #panel-month-calendar { position:absolute; left:0; top:0; width:100%; background:#fff; }
        .calendar-controls, .step-nav, .btn-calendar-refresh, .btn-calendar-this-month, .btn-calendar-print { display:none !important; }
        .calendar-panel-card { box-shadow:none !important; border:none !important; padding:0 !important; }
        .calendar-day { min-height:108px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function parseDayNumbers(text, defaultYear, defaultMonth) {
    const result = [];
    const source = String(text || '');
    if (!source.trim()) return result;

    const fullDateRegex = /(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/g;
    let match;
    while ((match = fullDateRegex.exec(source)) !== null) {
      result.push({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) });
    }

    const monthDayRegex = /(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g;
    while ((match = monthDayRegex.exec(source)) !== null) {
      result.push({ year: defaultYear, month: Number(match[1]), day: Number(match[2]) });
    }

    const dottedDayRegex = /(?<!\d)(\d{1,2})\s*\.\s*(?:\([월화수목금토일]\)|[월화수목금토일])?/g;
    while ((match = dottedDayRegex.exec(source)) !== null) {
      const before = source.slice(Math.max(0, match.index - 3), match.index);
      const after = source.slice(match.index + match[0].length, match.index + match[0].length + 3);
      if (before.includes(':') || after.includes(':')) continue;
      const day = Number(match[1]);
      if (day >= 1 && day <= 31) result.push({ year: defaultYear, month: defaultMonth, day });
    }

    const parenDayRegex = /(?<!\d)(\d{1,2})\s*\([월화수목금토일]\)/g;
    while ((match = parenDayRegex.exec(source)) !== null) {
      const day = Number(match[1]);
      if (day >= 1 && day <= 31) result.push({ year: defaultYear, month: defaultMonth, day });
    }

    const unique = new Map();
    result.forEach(d => {
      if (d.month < 1 || d.month > 12 || d.day < 1 || d.day > 31) return;
      unique.set(`${d.year}-${d.month}-${d.day}`, d);
    });
    return [...unique.values()];
  }

  function collectTextDates(item) {
    const parts = [];
    if (item.dates) parts.push(item.dates);
    if (item.date) parts.push(item.date);
    if (item.notes) parts.push(item.notes);
    if (Array.isArray(item.subs)) {
      item.subs.forEach(sub => {
        if (sub.date) parts.push(sub.date);
        if (sub.text && /일시|일자|날짜|\d{1,2}\.\(|\d{1,2}\([월화수목금토일]\)|\d{1,2}월\s*\d{1,2}/.test(sub.text)) parts.push(sub.text);
      });
    }
    return parts.join('\n');
  }

  function extractEvents() {
    const data = typeof collectData === 'function' ? collectData() : {};
    const teams = getTeams();
    const current = { year: Number(data.year || new Date().getFullYear()), month: Number(data.month || (new Date().getMonth() + 1)) };
    const prev = getPrevMonth(current.year, current.month);
    const events = [];

    [0, 1, 2].forEach(teamIdx => {
      const members = data.programs?.[teamIdx] || [];
      members.forEach(member => {
        ['prev', 'next'].forEach(type => {
          const periodBase = type === 'prev' ? prev : current;
          const items = member[type] || [];
          items.forEach((item, itemIdx) => {
            const dateText = collectTextDates(item);
            const dates = parseDayNumbers(dateText, periodBase.year, periodBase.month);
            dates.forEach(date => {
              const dateObj = new Date(date.year, date.month - 1, date.day);
              if (dateObj.getMonth() !== date.month - 1) return;
              events.push({
                id: `${teamIdx}-${member.name}-${type}-${itemIdx}-${date.year}-${date.month}-${date.day}`,
                year: date.year,
                month: date.month,
                day: date.day,
                dateKey: `${date.year}-${pad(date.month)}-${pad(date.day)}`,
                type,
                typeLabel: type === 'prev' ? '전월 보고' : '당월 계획',
                teamIdx,
                teamName: teams[teamIdx]?.name || TEAM_FALLBACK[teamIdx]?.name || `팀${teamIdx + 1}`,
                teamColor: teams[teamIdx]?.color || TEAM_FALLBACK[teamIdx]?.color || '#1a4a8a',
                memberName: member.name || '담당자 미입력',
                memberTitle: member.title || '',
                programName: item.name || '제목 없음',
                time: item.time || '',
                place: item.place || '',
                notes: item.notes || '',
                rawDate: dateText
              });
            });
          });
        });
      });
    });

    events.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.teamIdx - b.teamIdx || a.memberName.localeCompare(b.memberName));
    return events;
  }

  function filterEvents(events) {
    const type = document.getElementById('calendar-filter-type')?.value || 'all';
    const team = document.getElementById('calendar-filter-team')?.value || 'all';
    const keyword = (document.getElementById('calendar-search')?.value || '').trim().toLowerCase();

    return events.filter(event => {
      if (type !== 'all' && event.type !== type) return false;
      if (team !== 'all' && String(event.teamIdx) !== team) return false;
      if (keyword) {
        const hay = `${event.teamName} ${event.memberName} ${event.programName} ${event.place} ${event.notes}`.toLowerCase();
        if (!hay.includes(keyword)) return false;
      }
      return true;
    });
  }

  function buildCalendarDays(year, month) {
    const first = new Date(year, month - 1, 1);
    const start = new Date(year, month - 1, 1 - first.getDay());
    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        outside: date.getMonth() !== month - 1,
        dateKey: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      });
    }
    return days;
  }

  function eventHtml(event) {
    return `
      <div class="calendar-event" style="border-left-color:${event.teamColor}" title="${esc(event.teamName)} · ${esc(event.memberName)} · ${esc(event.programName)}">
        <div class="calendar-event-type ${event.type}">${event.type === 'prev' ? '● 전월' : '● 당월'}</div>
        <div class="calendar-event-title">${esc(event.programName)}</div>
        <div class="calendar-event-meta">${esc(event.memberName)}${event.time ? ' · ' + esc(event.time) : ''}</div>
      </div>`;
  }

  function renderCalendar() {
    const base = getCurrentMonthBase();
    const viewYear = Number(document.getElementById('calendar-year')?.value || base.year);
    const viewMonth = Number(document.getElementById('calendar-month')?.value || base.month);
    const allEvents = extractEvents();
    const filtered = filterEvents(allEvents);
    const monthEvents = filtered.filter(e => e.year === viewYear && e.month === viewMonth);
    const days = buildCalendarDays(viewYear, viewMonth);
    const todayKey = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;

    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    const weekdays = ['일','월','화','수','목','금','토'];
    let html = weekdays.map((w, idx) => `<div class="calendar-weekday ${idx === 0 ? 'sun' : idx === 6 ? 'sat' : ''}">${w}</div>`).join('');

    days.forEach(day => {
      const events = monthEvents.filter(e => e.dateKey === day.dateKey);
      const visibleEvents = events.slice(0, 3);
      html += `
        <div class="calendar-day ${day.outside ? 'outside' : ''} ${day.dateKey === todayKey ? 'today' : ''}">
          <div class="calendar-day-number">
            <span>${day.day}</span>
            ${events.length ? `<span class="calendar-count-badge">${events.length}</span>` : ''}
          </div>
          <div class="calendar-events">
            ${visibleEvents.map(eventHtml).join('')}
            ${events.length > 3 ? `<div class="calendar-more">+ ${events.length - 3}개 더 있음</div>` : ''}
          </div>
        </div>`;
    });

    grid.innerHTML = html;
    renderSummary(allEvents, filtered, monthEvents, viewYear, viewMonth);
    renderEventList(monthEvents);
  }

  function renderSummary(allEvents, filtered, monthEvents, year, month) {
    const uniqueDays = new Set(monthEvents.map(e => e.dateKey)).size;
    const prevCount = monthEvents.filter(e => e.type === 'prev').length;
    const nextCount = monthEvents.filter(e => e.type === 'next').length;
    const title = document.getElementById('calendar-main-title');
    if (title) title.innerHTML = `<i class="fas fa-calendar-days"></i> ${year}년 ${month}월 일정 달력`;

    const summary = document.getElementById('calendar-summary-row');
    if (!summary) return;
    summary.innerHTML = `
      <div class="calendar-summary-card"><strong>${monthEvents.length}</strong><span>이 달 표시 일정</span></div>
      <div class="calendar-summary-card"><strong>${uniqueDays}</strong><span>일정이 있는 날짜</span></div>
      <div class="calendar-summary-card"><strong>${nextCount}</strong><span>당월 활동 계획</span></div>
      <div class="calendar-summary-card"><strong>${prevCount}</strong><span>전월 활동 보고</span></div>`;
  }

  function renderEventList(events) {
    const body = document.getElementById('calendar-list-body');
    const empty = document.getElementById('calendar-empty');
    if (!body || !empty) return;

    if (!events.length) {
      body.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    body.innerHTML = events.map(event => `
      <tr>
        <td>${event.month}.${event.day}</td>
        <td>${event.typeLabel}</td>
        <td>${esc(event.teamName)}</td>
        <td>${esc(event.memberName)}</td>
        <td><strong>${esc(event.programName)}</strong>${event.notes ? `<br><span style="color:#64748b;">${esc(event.notes)}</span>` : ''}</td>
        <td>${esc(event.time || '-')}</td>
        <td>${esc(event.place || '-')}</td>
      </tr>`).join('');
  }

  function setToCurrentMeetingMonth() {
    const base = getCurrentMonthBase();
    const y = document.getElementById('calendar-year');
    const m = document.getElementById('calendar-month');
    if (y) y.value = base.year;
    if (m) m.value = base.month;
    renderCalendar();
  }

  function goCalendarTab() {
    if (typeof showPage === 'function') showPage('input');
    document.querySelectorAll('.step-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.step-item').forEach(item => item.classList.remove('active'));
    document.getElementById(PANEL_ID)?.classList.add('active');
    document.getElementById(TAB_ID)?.classList.add('active');
    renderCalendar();
  }

  function injectCalendarTab() {
    if (document.getElementById(TAB_ID)) return;
    const stepList = document.getElementById('step-list');
    const formArea = document.querySelector('.form-area');
    if (!stepList || !formArea) return;

    const li = document.createElement('li');
    li.className = 'step-item step-item-calendar';
    li.id = TAB_ID;
    li.innerHTML = `<span class="step-num"><i class="fas fa-calendar-days"></i></span><span class="step-label">월간 달력</span>`;
    li.addEventListener('click', goCalendarTab);

    const summaryTab = document.getElementById('step-tab-summary');
    stepList.insertBefore(li, summaryTab || null);

    const base = getCurrentMonthBase();
    const panel = document.createElement('div');
    panel.className = 'step-panel';
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="panel-header" style="border-left-color:#0284c7">
        <h2 style="color:#0284c7"><i class="fas fa-calendar-days"></i> 월간 일정 달력</h2>
        <p>입력된 전월 활동 보고와 당월 활동 계획 중 날짜가 있는 항목을 월 단위 달력으로 확인합니다.</p>
      </div>
      <div class="calendar-panel-card">
        <div class="calendar-toolbar">
          <div class="calendar-title-box">
            <h3 id="calendar-main-title"><i class="fas fa-calendar-days"></i> ${base.year}년 ${base.month}월 일정 달력</h3>
            <p>날짜 입력 예: 13.(토), 20.(토), 6월 13일, 2026. 6. 13.</p>
          </div>
          <div class="calendar-controls">
            <input type="number" id="calendar-year" class="calendar-input" value="${base.year}" min="2020" max="2035" style="width:92px">
            <select id="calendar-month" class="calendar-select">
              ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === base.month ? 'selected' : ''}>${i + 1}월</option>`).join('')}
            </select>
            <select id="calendar-filter-type" class="calendar-select">
              <option value="all">전체 구분</option>
              <option value="next">당월 계획</option>
              <option value="prev">전월 보고</option>
            </select>
            <select id="calendar-filter-team" class="calendar-select">
              <option value="all">전체 팀</option>
              ${getTeams().map((team, i) => `<option value="${i}">${esc(team.name || TEAM_FALLBACK[i]?.name)}</option>`).join('')}
            </select>
            <input type="text" id="calendar-search" class="calendar-input" placeholder="담당자/프로그램 검색" style="width:160px">
            <button type="button" class="btn-calendar-refresh" id="btn-calendar-refresh"><i class="fas fa-rotate"></i> 새로고침</button>
            <button type="button" class="btn-calendar-this-month" id="btn-calendar-this-month"><i class="fas fa-bullseye"></i> 회의 월</button>
            <button type="button" class="btn-calendar-print" id="btn-calendar-print"><i class="fas fa-print"></i> 인쇄</button>
          </div>
        </div>
        <div id="calendar-summary-row" class="calendar-summary-row"></div>
        <div id="calendar-grid" class="calendar-grid"></div>
        <div class="calendar-list-card">
          <div class="calendar-list-head">
            <span><i class="fas fa-list-check"></i> 일정 목록</span>
            <span style="font-size:11px;color:#64748b;">달력에 표시된 일정만 목록화</span>
          </div>
          <div id="calendar-empty" class="calendar-empty" style="display:none;">이 월에 표시할 일정이 없습니다. 날짜 입력 형식을 확인해주세요.</div>
          <table class="calendar-list-table">
            <thead>
              <tr><th>일자</th><th>구분</th><th>팀</th><th>담당자</th><th>프로그램</th><th>시간</th><th>장소</th></tr>
            </thead>
            <tbody id="calendar-list-body"></tbody>
          </table>
        </div>
      </div>
      <div class="step-nav">
        <button class="btn-prev" onclick="goStep('excel')"><i class="fas fa-arrow-left"></i> 이전 단계</button>
        <button class="btn-next" onclick="goStep('summary')">다음 단계 <i class="fas fa-arrow-right"></i></button>
      </div>`;

    formArea.appendChild(panel);

    ['calendar-year','calendar-month','calendar-filter-type','calendar-filter-team','calendar-search'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', renderCalendar);
      document.getElementById(id)?.addEventListener('change', renderCalendar);
    });
    document.getElementById('btn-calendar-refresh')?.addEventListener('click', renderCalendar);
    document.getElementById('btn-calendar-this-month')?.addEventListener('click', setToCurrentMeetingMonth);
    document.getElementById('btn-calendar-print')?.addEventListener('click', () => window.print());
  }

  function wrapAutoRefreshHooks() {
    if (typeof window.refreshProgramList === 'function' && !window.refreshProgramList.__calendarWrapped) {
      const original = window.refreshProgramList;
      window.refreshProgramList = function wrappedRefreshProgramList() {
        const result = original.apply(this, arguments);
        if (document.getElementById(PANEL_ID)?.classList.contains('active')) setTimeout(renderCalendar, 0);
        return result;
      };
      window.refreshProgramList.__calendarWrapped = true;
    }
  }

  function initMonthlyCalendar() {
    injectStyle();
    injectCalendarTab();
    wrapAutoRefreshHooks();
  }

  window.goMonthCalendarTab = goCalendarTab;
  window.renderMonthCalendar = renderCalendar;

  document.addEventListener('DOMContentLoaded', () => setTimeout(initMonthlyCalendar, 700));
  window.addEventListener('load', () => setTimeout(initMonthlyCalendar, 700));
  setTimeout(initMonthlyCalendar, 1200);
})();
