import './calendar-more-expand.js';
import './calendar-expanded-jump-fix.js';
import './calendar-click-rebinder.js';

/* ============================================
   월간 달력 일정 클릭 → 원본 입력 위치 이동
   - 달력 카드/일정 목록 행 클릭 시 팀별 보고 탭으로 이동
   - +n개 더 있음으로 펼쳐진 일정도 원본 위치로 이동
   ============================================ */

(function () {
  const STYLE_ID = 'calendar-jump-style';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .calendar-event { position: relative; }
      .calendar-event::after {
        content:'이동';
        position:absolute;
        right:5px;
        top:5px;
        font-size:9px;
        font-weight:900;
        color:#94a3b8;
        opacity:0;
        transition:opacity .12s;
      }
      .calendar-event:hover::after { opacity:1; }
      .calendar-list-table tbody tr { cursor:pointer; }
      .calendar-list-table tbody tr:hover td { background:#eef6ff; }
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
    if (!list) return false;
    const card = list.querySelectorAll('.program-card')[programIdx];
    if (!card) return false;
    card.classList.add('calendar-source-highlight');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => card.classList.remove('calendar-source-highlight'), 8000);
    return true;
  }

  function jumpToSource(event) {
    if (!event) return;
    if (typeof showPage === 'function') showPage('input');
    if (typeof goStep === 'function') goStep(`team-${event.teamIdx}`);

    setTimeout(() => {
      openMemberCard(event.teamIdx, event.memberIdx);
      const moved = highlightProgramCard(event.teamIdx, event.memberIdx, event.type, event.programIdx);
      if (typeof showToast === 'function') {
        showToast(moved
          ? `📌 ${event.memberName || '담당자'}님의 ${event.typeLabel || '일정'} 항목으로 이동했습니다.`
          : '⚠️ 해당 입력 위치를 찾지 못했습니다. 달력을 새로고침한 뒤 다시 시도해주세요.');
      }
    }, 120);
  }

  function init() {
    injectStyle();
    if (typeof window.calendarRebindClicks === 'function') window.calendarRebindClicks();
  }

  window.jumpToCalendarSource = jumpToSource;

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
  setTimeout(init, 800);
})();
