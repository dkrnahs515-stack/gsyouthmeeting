/* ============================================
   펼쳐진 월간 달력 일정 이동 보정
   - +n개 더 있음으로 펼쳐진 일정 클릭이 끊길 때를 대비한 전역 위임 처리
   - 달력 카드의 텍스트를 기준으로 현재 입력 데이터에서 원본 항목을 재검색하여 이동
   ============================================ */

(function () {
  const TEAM_FALLBACK = [
    { name: '운영지원팀', color: '#1a4a8a' },
    { name: '교육·홍보팀', color: '#2e8a57' },
    { name: '청소년사업팀', color: '#7c3aed' }
  ];

  function getTeams() {
    return Array.isArray(window.TEAMS) ? window.TEAMS : TEAM_FALLBACK;
  }

  function normalize(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
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
    if (!event) return false;
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
    }, 160);
    return true;
  }

  function findEventFromExpandedCard(card) {
    const dataEvent = card.__calendarEvent;
    if (dataEvent) return dataEvent;

    const typeText = normalize(card.querySelector('.calendar-event-type')?.textContent || '');
    const programName = normalize(card.querySelector('.calendar-event-title')?.textContent || '');
    const metaText = normalize(card.querySelector('.calendar-event-meta')?.textContent || '');
    const type = typeText.includes('전월') ? 'prev' : 'next';
    const memberName = metaText.split('·')[0]?.trim() || '';

    const data = typeof collectData === 'function' ? collectData() : window.appState || {};
    const teams = getTeams();
    const candidates = [];

    [0, 1, 2].forEach(teamIdx => {
      const members = data.programs?.[teamIdx] || [];
      members.forEach((member, memberIdx) => {
        const items = member[type] || [];
        items.forEach((item, programIdx) => {
          const itemName = normalize(item.name);
          const memName = normalize(member.name);
          let score = 0;
          if (itemName === programName) score += 100;
          else if (itemName.includes(programName) || programName.includes(itemName)) score += 70;
          if (memberName && memName === memberName) score += 50;
          if (score > 0) {
            candidates.push({
              score,
              event: {
                teamIdx,
                memberIdx,
                programIdx,
                type,
                typeLabel: type === 'prev' ? '전월 보고' : '당월 계획',
                teamName: teams[teamIdx]?.name || TEAM_FALLBACK[teamIdx]?.name,
                memberName: member.name || memberName,
                programName: item.name || programName
              }
            });
          }
        });
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.event || null;
  }

  function bindExpandedDelegation() {
    if (document.__calendarExpandedJumpBound) return;
    document.__calendarExpandedJumpBound = true;

    document.addEventListener('click', event => {
      const card = event.target.closest?.('.calendar-expanded-event');
      if (!card) return;
      event.preventDefault();
      event.stopPropagation();

      const found = findEventFromExpandedCard(card);
      if (found) {
        jumpToEvent(found);
      } else if (typeof showToast === 'function') {
        showToast('⚠️ 해당 일정의 원본 입력 위치를 찾지 못했습니다. 일정 목록에서 다시 선택해주세요.');
      }
    }, true);
  }

  function attachDirectEventObjects() {
    const expandedCards = document.querySelectorAll('.calendar-expanded-event');
    expandedCards.forEach(card => {
      if (card.__calendarJumpFixAttached) return;
      card.__calendarJumpFixAttached = true;
      card.style.cursor = 'pointer';
    });
  }

  function init() {
    bindExpandedDelegation();
    attachDirectEventObjects();
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 900));
  window.addEventListener('load', () => setTimeout(init, 900));
  setInterval(init, 1000);
})();
