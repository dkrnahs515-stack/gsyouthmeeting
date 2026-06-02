/* ============================================
   월간 달력 일정 클릭 → 원본 입력 위치 이동
   - 달력 카드/일정 목록 행 클릭 시 팀별 보고 탭으로 이동
   - 담당자 카드 펼침, 해당 프로그램 카드 스크롤/강조
   ============================================ */

(function () {
  const STYLE_ID = 'calendar-jump-style';
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
      .calendar-event {
        position: relative;
      }

      .calendar-event::after {
        content: '이동';
        position: absolute;
        right: 5px;
        top: 5px;
        font-size: 9px;
        font-weight: 900;
        color: #94a3b8;
        opacity: 0;
        transition: opacity .12s;
      }

      .calendar-event:hover::after {
        opacity: 1;
      }

      .calendar-list-table tbody tr {
        cursor: pointer;
      }

      .calendar-list-table tbody tr:hover td {
        background: #eef6ff;
      }

      .calendar-source-highlight {
        animation: calendarSourcePulse 2.2s ease-in-out 0s 2;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, .35), 0 12px 28px rgba(15, 23, 42, .16) !important;
        border-color: #f59e0b !important;
        background: #fff7ed !important;
      }

      .calendar-source-highlight .program-card-name::before {
        content: '📌 달력에서 선택한 일정 · ';
        color: #d97706;
        font-weight: 900;
      }

      @keyframes calendarSourcePulse {
        0% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
        100% { transform: translateY(0); }
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
        if (sub.date) parts.push(sub.date);
        if (sub.text && /일시|일자|날짜|\d{1,2}\.\(|\d{1,2}\([월화수목금토일]\)|\d{1,2}월\s*\d{1,2}/.test(sub.text)) {
          parts.push(sub.text);
        }
      });
    }
    return parts.join('\n');
  }

  function getAllCalendarEvents() {
    const data = typeof collectData === 'function' ? collectData() : {};
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

    return getAllCalendarEvents().filter(event => {
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

  function mapVisibleCalendarCards() {
    const monthEvents = getFilteredMonthEvents();
    const cards = [...document.querySelectorAll('#calendar-grid .calendar-event')];
    const visibleEvents = [];

    const grouped = new Map();
    monthEvents.forEach(event => {
      if (!grouped.has(event.dateKey)) grouped.set(event.dateKey, []);
      grouped.get(event.dateKey).push(event);
    });

    [...grouped.keys()].sort().forEach(dateKey => {
      grouped.get(dateKey).slice(0, 3).forEach(event => visibleEvents.push(event));
    });

    cards.forEach((card, idx) => {
      const event = visibleEvents[idx];
      if (!event) return;
      card.dataset.calendarJumpIndex = String(idx);
      card.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        jumpToSource(event);
      });
    });
  }

  function mapCalendarListRows() {
    const events = getFilteredMonthEvents();
    const rows = [...document.querySelectorAll('#calendar-list-body tr')];
    rows.forEach((row, idx) => {
      const event = events[idx];
      if (!event) return;
      row.dataset.calendarJumpIndex = String(idx);
      row.title = '클릭하면 해당 팀별 보고 입력 위치로 이동합니다.';
      row.addEventListener('click', () => jumpToSource(event));
    });
  }

  function enhanceCalendarAfterRender() {
    injectStyle();
    setTimeout(() => {
      mapVisibleCalendarCards();
      mapCalendarListRows();
    }, 0);
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
    document.querySelectorAll('.calendar-source-highlight').forEach(el => {
      el.classList.remove('calendar-source-highlight');
    });

    const list = document.getElementById(`prog-list-${teamIdx}-${memberIdx}-${type}`);
    if (!list) return false;
    const card = list.querySelectorAll('.program-card')[programIdx];
    if (!card) return false;

    card.classList.add('calendar-source-highlight');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      card.classList.remove('calendar-source-highlight');
    }, 8000);
    return true;
  }

  function showToastSafe(message) {
    if (typeof showToast === 'function') showToast(message);
  }

  function jumpToSource(event) {
    if (!event) return;

    if (typeof showPage === 'function') showPage('input');
    if (typeof goStep === 'function') goStep(`team-${event.teamIdx}`);

    setTimeout(() => {
      openMemberCard(event.teamIdx, event.memberIdx);
      const moved = highlightProgramCard(event.teamIdx, event.memberIdx, event.type, event.programIdx);
      if (moved) {
        showToastSafe(`📌 ${event.memberName}님의 ${event.typeLabel} 항목으로 이동했습니다.`);
      } else {
        showToastSafe('⚠️ 해당 입력 위치를 찾지 못했습니다. 달력을 새로고침한 뒤 다시 시도해주세요.');
      }
    }, 120);
  }

  function wrapRenderCalendar() {
    if (typeof window.renderMonthCalendar !== 'function' || window.renderMonthCalendar.__jumpWrapped) return;
    const original = window.renderMonthCalendar;
    window.renderMonthCalendar = function wrappedRenderMonthCalendar() {
      const result = original.apply(this, arguments);
      enhanceCalendarAfterRender();
      return result;
    };
    window.renderMonthCalendar.__jumpWrapped = true;
  }

  function bindRefreshButtons() {
    ['btn-calendar-refresh', 'btn-calendar-this-month'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn || btn.__jumpBound) return;
      btn.addEventListener('click', () => setTimeout(enhanceCalendarAfterRender, 80));
      btn.__jumpBound = true;
    });

    ['calendar-year','calendar-month','calendar-filter-type','calendar-filter-team','calendar-search'].forEach(id => {
      const input = document.getElementById(id);
      if (!input || input.__jumpBound) return;
      input.addEventListener('input', () => setTimeout(enhanceCalendarAfterRender, 80));
      input.addEventListener('change', () => setTimeout(enhanceCalendarAfterRender, 80));
      input.__jumpBound = true;
    });
  }

  function initCalendarJump() {
    injectStyle();
    wrapRenderCalendar();
    bindRefreshButtons();
    if (document.getElementById('panel-month-calendar')?.classList.contains('active')) {
      enhanceCalendarAfterRender();
    }
  }

  window.jumpToCalendarSource = jumpToSource;

  document.addEventListener('DOMContentLoaded', () => setTimeout(initCalendarJump, 1200));
  window.addEventListener('load', () => setTimeout(initCalendarJump, 1200));
  setInterval(initCalendarJump, 1500);
})();
