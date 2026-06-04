/* ============================================
   월간 달력 +n개 더 있음 확장 기능
   - +n개 더 있음 클릭 시 해당 날짜의 전체 일정 펼침
   - 접기 클릭 시 다시 3개만 표시
   - 펼쳐진 일정 클릭 시 원본 입력 카드로 이동
   ============================================ */

(function () {
  const STYLE_ID = 'calendar-more-expand-style';
  const TEAM_FALLBACK = [
    { name: '운영지원팀', color: '#1a4a8a' },
    { name: '교육·홍보팀', color: '#2e8a57' },
    { name: '청소년사업팀', color: '#7c3aed' }
  ];
  const expandedDates = new Set();

  function getTeams() {
    return Array.isArray(window.TEAMS) ? window.TEAMS : TEAM_FALLBACK;
  }

  function esc(value) {
    return String(value || '').replace(/[&<>"]/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[s]));
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
      .calendar-more {
        cursor: pointer;
        transition: background .12s, color .12s, transform .12s;
      }
      .calendar-more:hover {
        background:#dbeafe;
        color:#1a4a8a;
        transform:translateY(-1px);
      }
      .calendar-day.calendar-expanded {
        min-height: 220px;
        box-shadow: inset 0 0 0 2px rgba(42,103,192,.22);
        background:#fbfdff;
      }
      .calendar-more-collapse {
        display:flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        font-size:10px;
        font-weight:900;
        color:#475569;
        background:#f1f5f9;
        border:1px solid #e2e8f0;
        border-radius:7px;
        padding:5px 6px;
        cursor:pointer;
        transition:.12s;
      }
      .calendar-more-collapse:hover {
        background:#1a4a8a;
        color:#fff;
      }
      .calendar-event.calendar-expanded-event {
        border-left-width: 5px;
      }
      .calendar-event.calendar-expanded-event::after {
        content: '상세 이동';
        position:absolute;
        right:5px;
        top:5px;
        font-size:9px;
        font-weight:900;
        color:#94a3b8;
        opacity:0;
        transition:.12s;
      }
      .calendar-event.calendar-expanded-event:hover::after {
        opacity:1;
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
                teamColor: teams[teamIdx]?.color || TEAM_FALLBACK[teamIdx]?.color || '#1a4a8a',
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

  function eventHtml(event, idx) {
    return `
      <div class="calendar-event calendar-expanded-event" data-expanded-event-idx="${idx}" style="border-left-color:${event.teamColor}" title="${esc(event.teamName)} · ${esc(event.memberName)} · ${esc(event.programName)}">
        <div class="calendar-event-type ${event.type}">${event.type === 'prev' ? '● 전월' : '● 당월'}</div>
        <div class="calendar-event-title">${esc(event.programName)}</div>
        <div class="calendar-event-meta">${esc(event.memberName)}${event.time ? ' · ' + esc(event.time) : ''}${event.place ? ' · ' + esc(event.place) : ''}</div>
      </div>`;
  }

  function expandDay(dayEl, dateKey, events) {
    const eventsWrap = dayEl.querySelector('.calendar-events');
    if (!eventsWrap) return;
    dayEl.classList.add('calendar-expanded');
    expandedDates.add(dateKey);
    eventsWrap.innerHTML = `
      ${events.map((event, idx) => eventHtml(event, idx)).join('')}
      <div class="calendar-more-collapse"><i class="fas fa-chevron-up"></i> 접기</div>
    `;

    eventsWrap.querySelectorAll('.calendar-expanded-event').forEach((card, idx) => {
      card.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.jumpToCalendarSource === 'function') {
          window.jumpToCalendarSource(events[idx]);
        }
      });
    });

    eventsWrap.querySelector('.calendar-more-collapse')?.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      expandedDates.delete(dateKey);
      if (typeof window.renderMonthCalendar === 'function') window.renderMonthCalendar();
    });
  }

  function attachMoreExpandHandlers() {
    injectStyle();
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    const base = getCurrentMonthBase();
    const viewYear = Number(document.getElementById('calendar-year')?.value || base.year);
    const viewMonth = Number(document.getElementById('calendar-month')?.value || base.month);
    const days = buildCalendarDays(viewYear, viewMonth);
    const dayEls = [...grid.querySelectorAll('.calendar-day')];
    const events = getFilteredMonthEvents();
    const grouped = new Map();
    events.forEach(event => {
      if (!grouped.has(event.dateKey)) grouped.set(event.dateKey, []);
      grouped.get(event.dateKey).push(event);
    });

    dayEls.forEach((dayEl, idx) => {
      const day = days[idx];
      if (!day) return;
      const dayEvents = grouped.get(day.dateKey) || [];
      const more = dayEl.querySelector('.calendar-more');

      if (expandedDates.has(day.dateKey) && dayEvents.length > 3) {
        expandDay(dayEl, day.dateKey, dayEvents);
        return;
      }

      if (!more || dayEvents.length <= 3 || more.__moreExpandBound) return;
      more.__moreExpandBound = true;
      more.title = '클릭하면 이 날짜의 전체 일정을 펼쳐볼 수 있습니다.';
      more.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        expandDay(dayEl, day.dateKey, dayEvents);
      });
    });
  }

  function wrapRenderMonthCalendar() {
    if (typeof window.renderMonthCalendar !== 'function' || window.renderMonthCalendar.__moreExpandWrapped) return;
    const original = window.renderMonthCalendar;
    window.renderMonthCalendar = function wrappedRenderMonthCalendar() {
      const result = original.apply(this, arguments);
      setTimeout(attachMoreExpandHandlers, 30);
      return result;
    };
    window.renderMonthCalendar.__moreExpandWrapped = true;
  }

  function bindCalendarControls() {
    ['calendar-year','calendar-month','calendar-filter-type','calendar-filter-team','calendar-search'].forEach(id => {
      const input = document.getElementById(id);
      if (!input || input.__moreExpandBound) return;
      input.addEventListener('input', () => {
        expandedDates.clear();
        setTimeout(attachMoreExpandHandlers, 80);
      });
      input.addEventListener('change', () => {
        expandedDates.clear();
        setTimeout(attachMoreExpandHandlers, 80);
      });
      input.__moreExpandBound = true;
    });

    ['btn-calendar-refresh','btn-calendar-this-month'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn || btn.__moreExpandBound) return;
      btn.addEventListener('click', () => {
        expandedDates.clear();
        setTimeout(attachMoreExpandHandlers, 100);
      });
      btn.__moreExpandBound = true;
    });
  }

  function init() {
    injectStyle();
    wrapRenderMonthCalendar();
    bindCalendarControls();
    if (document.getElementById('panel-month-calendar')?.classList.contains('active')) {
      setTimeout(attachMoreExpandHandlers, 100);
    }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1300));
  window.addEventListener('load', () => setTimeout(init, 1300));
  setInterval(init, 1800);
})();
