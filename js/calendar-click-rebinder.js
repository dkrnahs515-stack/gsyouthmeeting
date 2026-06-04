/* ============================================
   월간 달력 클릭 이벤트 재연결 최종 보정
   - 달력이 다시 그려질 때마다 보이는 일정 카드와 원본 입력 데이터를 재매칭
   - 일반 일정, +n개 펼친 일정, 하단 일정 목록 모두 클릭 이동 지원
   ============================================ */

(function () {
  const STYLE_ID = 'calendar-click-rebinder-style';
  const TEAM_FALLBACK = [
    { name: '운영지원팀', color: '#1a4a8a' },
    { name: '교육·홍보팀', color: '#2e8a57' },
    { name: '청소년사업팀', color: '#7c3aed' }
  ];

  function getTeams() {
    return Array.isArray(window.TEAMS) ? window.TEAMS : TEAM_FALLBACK;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function getCurrentMonthBase() {
    const data = typeof collectData === 'function' ? collectData() : {};
    return {
      year: Number(data.year || document.getElementById('info-year')?.value || new Date().getFullYear()),
      month: Number(data.month || document.getElementById('info-month')?.value || (new Date().getMonth() + 1))
    };
  }

  function getPrevMonth(year, month) {
    return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .calendar-event[data-jump-bound="true"] { cursor:pointer; }
      .calendar-event[data-jump-bound="true"]::after {
        content:'이동';
        position:absolute;
        right:5px;
        top:5px;
        font-size:9px;
        font-weight:900;
        color:#94a3b8;
        opacity:0;
        transition:.12s;
      }
      .calendar-event[data-jump-bound="true"]:hover::after { opacity:1; }
      #calendar-list-body tr[data-jump-bound="true"] { cursor:pointer; }
      #calendar-list-body tr[data-jump-bound="true"]:hover td { background:#eef6ff !important; }
      .calendar-source-highlight {
        animation: calendarSourcePulse 2.2s ease-in-out 0s 2;
        box-shadow:0 0 0 3px rgba(245,158,11,.35),0 12px 28px rgba(15,23,42,.16)!important;
        border-color:#f59e0b!important;
        background:#fff7ed!important;
      }
      .calendar-source-highlight .program-card-name::before {
        content:'📌 달력에서 선택한 일정 · ';
        color:#d97706;
        font-weight:900;
      }
      @keyframes calendarSourcePulse {
        0%{transform:translateY(0)}
        50%{transform:translateY(-2px)}
        100%{transform:translateY(0)}
      }
    `;
    document.head.appendChild(style);
  }

  function parseDayNumbers(text, defaultYear, defaultMonth) {
    const result = [];
    const source = String(text || '');
    if (!source.trim()) return result;

    let match;
    const fullDateRegex = /(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/g;
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
      const dateObj = new Date(d.year, d.month - 1, d.day);
      if (dateObj.getMonth() !== d.month - 1) return;
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
        if (typeof sub === 'string') {
          if (/일시|일자|날짜|\d{1,2}\.\(|\d{1,2}\([월화수목금토일]\)|\d{1,2}월\s*\d{1,2}/.test(sub)) parts.push(sub);
          return;
        }
        if (sub.date) parts.push(sub.date);
        if (sub.text && /일시|일자|날짜|\d{1,2}\.\(|\d{1,2}\([월화수목금토일]\)|\d{1,2}월\s*\d{1,2}/.test(sub.text)) parts.push(sub.text);
        if (sub.content && /일시|일자|날짜|\d{1,2}\.\(|\d{1,2}\([월화수목금토일]\)|\d{1,2}월\s*\d{1,2}/.test(sub.content)) parts.push(sub.content);
      });
    }
    return parts.join('\n');
  }

  function getAllEvents() {
    const data = typeof collectData === 'function' ? collectData() : window.appState || {};
    const teams = getTeams();
    const current = {
      year: Number(data.year || new Date().getFullYear()),
      month: Number(data.month || (new Date().getMonth() + 1))
    };
    const prev = getPrevMonth(current.year, current.month);
    const events = [];

    [0, 1, 2].forEach(teamIdx => {
      const members = data.programs?.[teamIdx] || [];
      members.forEach((member, memberIdx) => {
        ['prev', 'next'].forEach(type => {
          const periodBase = type === 'prev' ? prev : current;
          const items = member[type] || [];
          items.forEach((item, programIdx) => {
            const dateText = collectTextDates(item);
            const dates = parseDayNumbers(dateText, periodBase.year, periodBase.month);
            dates.forEach(date => {
              events.push({
                year: date.year,
                month: date.month,
                day: date.day,
                dateKey: `${date.year}-${pad(date.month)}-${pad(date.day)}`,
                type,
                typeLabel: type === 'prev' ? '전월 보고' : '당월 계획',
                teamIdx,
                memberIdx,
                programIdx,
                teamName: teams[teamIdx]?.name || TEAM_FALLBACK[teamIdx]?.name || `팀${teamIdx + 1}`,
                memberName: member.name || '담당자 미입력',
                programName: item.name || '제목 없음',
                time: item.time || '',
                place: item.place || '',
                notes: item.notes || ''
              });
            });
          });
        });
      });
    });

    events.sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey) ||
      a.teamIdx - b.teamIdx ||
      a.memberName.localeCompare(b.memberName) ||
      a.programIdx - b.programIdx
    );
    return events;
  }

  function getFilteredMonthEvents() {
    const base = getCurrentMonthBase();
    const viewYear = Number(document.getElementById('calendar-year')?.value || base.year);
    const viewMonth = Number(document.getElementById('calendar-month')?.value || base.month);
    const type = document.getElementById('calendar-filter-type')?.value || 'all';
    const team = document.getElementById('calendar-filter-team')?.value || 'all';
    const keyword = (document.getElementById('calendar-search')?.value || '').trim().toLowerCase();

    return getAllEvents().filter(event => {
      if (event.year !== viewYear || event.month !== viewMonth) return false;
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
        dateKey: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      });
    }
    return days;
  }

  function openMemberCard(teamIdx, memberIdx) {
    const body = document.getElementById(`member-body-${teamIdx}-${memberIdx}`);
    const icon = document.querySelector(`#member-card-${teamIdx}-${memberIdx} .member-collapse-btn i`);
    if (body && body.classList.contains('collapsed')) {
      body.classList.remove('collapsed');
      if (icon) icon.className = 'fas fa-chevron-up';
    }
  }

  function highlightProgramCard(teamIdx, memberIdx, type, programIdx) {
    document.querySelectorAll('.calendar-source-highlight').forEach(el => el.classList.remove('calendar-source-highlight'));
    const list = document.getElementById(`prog-list-${teamIdx}-${memberIdx}-${type}`);
    const card = list?.querySelectorAll('.program-card')?.[programIdx];
    if (!card) return false;
    card.classList.add('calendar-source-highlight');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => card.classList.remove('calendar-source-highlight'), 8000);
    return true;
  }

  function jumpToEvent(event) {
    if (!event) return;
    if (typeof showPage === 'function') showPage('input');
    if (typeof goStep === 'function') goStep(`team-${event.teamIdx}`);
    setTimeout(() => {
      openMemberCard(event.teamIdx, event.memberIdx);
      const moved = highlightProgramCard(event.teamIdx, event.memberIdx, event.type, event.programIdx);
      if (typeof showToast === 'function') {
        showToast(moved
          ? `📌 ${event.memberName || '담당자'}님의 ${event.typeLabel || '일정'} 항목으로 이동했습니다.`
          : '⚠️ 해당 입력 위치를 찾지 못했습니다.');
      }
    }, 180);
  }

  function bindCalendarCards() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    const base = getCurrentMonthBase();
    const year = Number(document.getElementById('calendar-year')?.value || base.year);
    const month = Number(document.getElementById('calendar-month')?.value || base.month);
    const days = buildCalendarDays(year, month);
    const dayEls = [...grid.querySelectorAll('.calendar-day')];
    const grouped = new Map();

    getFilteredMonthEvents().forEach(event => {
      if (!grouped.has(event.dateKey)) grouped.set(event.dateKey, []);
      grouped.get(event.dateKey).push(event);
    });

    dayEls.forEach((dayEl, idx) => {
      const day = days[idx];
      if (!day) return;
      const events = grouped.get(day.dateKey) || [];
      const cards = [...dayEl.querySelectorAll('.calendar-event')];
      const isExpanded = dayEl.classList.contains('calendar-expanded') || cards.length > 3;
      const visibleEvents = isExpanded ? events : events.slice(0, 3);

      cards.forEach((card, cardIdx) => {
        const event = visibleEvents[cardIdx];
        if (!event) return;
        card.dataset.jumpBound = 'true';
        card.onclick = e => {
          e.preventDefault();
          e.stopPropagation();
          jumpToEvent(event);
        };
      });
    });
  }

  function bindCalendarListRows() {
    const events = getFilteredMonthEvents();
    const rows = [...document.querySelectorAll('#calendar-list-body tr')];
    rows.forEach((row, idx) => {
      const event = events[idx];
      if (!event) return;
      row.dataset.jumpBound = 'true';
      row.title = '클릭하면 해당 팀별 보고 입력 위치로 이동합니다.';
      row.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        jumpToEvent(event);
      };
    });
  }

  function rebindAll() {
    injectStyle();
    bindCalendarCards();
    bindCalendarListRows();
  }

  function installObserver() {
    const grid = document.getElementById('calendar-grid');
    const list = document.getElementById('calendar-list-body');
    if (grid && !grid.__calendarRebindObserver) {
      const observer = new MutationObserver(() => setTimeout(rebindAll, 30));
      observer.observe(grid, { childList: true, subtree: true });
      grid.__calendarRebindObserver = observer;
    }
    if (list && !list.__calendarRebindObserver) {
      const observer = new MutationObserver(() => setTimeout(rebindAll, 30));
      observer.observe(list, { childList: true, subtree: true });
      list.__calendarRebindObserver = observer;
    }
  }

  function init() {
    rebindAll();
    installObserver();
  }

  window.calendarRebindClicks = rebindAll;

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  window.addEventListener('load', () => setTimeout(init, 1000));
  setInterval(init, 1200);
})();
