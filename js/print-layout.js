/* ============================================
   인쇄/미리보기 전월·당월 좌우 배치 보정
   - 기존 Firebase 데이터 구조는 변경하지 않음
   - 회의자료 생성 화면의 담당자별 보고 출력만 2단으로 재구성
   ============================================ */

(function () {
  function buildDocProgramSafe(prog) {
    if (typeof window.buildDocProgram === 'function') {
      return window.buildDocProgram(prog);
    }
    return '';
  }

  window.generatePreview = function generatePreviewTwoColumn() {
    const d = collectData();
    document.getElementById('preview-title-label').textContent = `${d.year}년 ${d.month}월 전체회의 자료`;

    const teamIcons   = ['fas fa-users-gear','fas fa-chalkboard-teacher','fas fa-child-reaching'];
    const teamClasses = ['','team-edu','team-youth'];
    const agendaHtml = d.agenda.filter(a => a.text.trim()).map(a => `<li>${escHtml(a.text)}</li>`).join('');

    let html = `
      <div class="doc-title">
        강 서 청 소 년 회 관
        <br><span style="font-size:18px;letter-spacing:.1em;">${d.year}년 ${d.month}월 전체회의 자료</span>
      </div>
      <div class="doc-info-row">
        <span><i class="fas fa-calendar-alt" style="color:#1a4a8a"></i> 일시: ${escHtml(d.date) || '미입력'}</span>
        <span><i class="fas fa-location-dot" style="color:#1a4a8a"></i> 장소: ${escHtml(d.place) || '미입력'}</span>
      </div>
      <div class="doc-agenda">
        <div class="doc-agenda-title"><i class="fas fa-list-ol"></i> 안건</div>
        <ol>${agendaHtml}</ol>
      </div>
      <div class="doc-section">
        <div class="doc-section-title"><i class="fas fa-quote-left"></i> 도산의 말씀</div>
        <div class="doc-dozan">
          <div class="doc-dozan-text">${escHtml(d.dozan.content) || '(말씀 미입력)'}</div>
          ${d.dozan.source ? `<div class="doc-dozan-source">- ${escHtml(d.dozan.source)} -</div>` : ''}
        </div>
      </div>
      <div class="doc-section">
        <div class="doc-section-title"><i class="fas fa-users"></i> 팀별 보고</div>`;

    d.teamOrder.forEach(teamIdx => {
      const members = d.programs[teamIdx] || [];
      html += `
        <div class="doc-team-block">
          <div class="doc-team-header ${teamClasses[teamIdx]}">
            <span><i class="${teamIcons[teamIdx]}"></i> ${TEAMS[teamIdx].name}</span>
            <span style="font-size:11px;opacity:.8;">${members.length}명</span>
          </div>`;

      if (!members.length) {
        html += `<p class="doc-empty-text">입력된 담당자가 없습니다.</p>`;
      } else {
        members.forEach(member => {
          const badge = member.title ? ` <span style="font-size:11px;font-weight:400;opacity:.75;">${escHtml(member.title)}</span>` : '';
          html += `<div class="doc-member-block doc-member-two-column">`;
          html += `<div class="doc-member-title"><i class="fas fa-user-tie"></i> ${escHtml(member.name || '(이름 미입력)')}${badge}</div>`;

          html += `<div class="doc-member-lr-wrap">`;

          html += `<div class="doc-member-col doc-member-prev-col">`;
          html += `<div class="doc-sub-title prev"><i class="fas fa-chart-bar"></i> 전월 활동 보고</div>`;
          if (!member.prev.length) {
            html += `<p class="doc-empty-text">입력된 내용이 없습니다.</p>`;
          } else {
            member.prev.forEach(p => { html += buildDocProgramSafe(p); });
          }
          html += `</div>`;

          html += `<div class="doc-member-col doc-member-next-col">`;
          html += `<div class="doc-sub-title next"><i class="fas fa-calendar-check"></i> 당월 활동 계획</div>`;
          if (!member.next.length) {
            html += `<p class="doc-empty-text">입력된 내용이 없습니다.</p>`;
          } else {
            member.next.forEach(p => { html += buildDocProgramSafe(p); });
          }
          html += `</div>`;

          html += `</div>`;
          html += `</div>`;
        });
      }
      html += `</div>`;
    });

    html += `</div>`;

    html += `<div class="doc-section"><div class="doc-section-title"><i class="fas fa-bullhorn"></i> 기타 공지사항</div>`;
    const notices = d.notices.filter(n => n.trim());
    if (!notices.length) {
      html += `<p class="doc-empty-text">입력된 공지사항이 없습니다.</p>`;
    } else {
      notices.forEach(n => {
        html += `<div class="doc-notice-item"><i class="fas fa-circle-dot" style="font-size:8px;margin-right:6px;"></i>${escHtml(n)}</div>`;
      });
    }
    html += `</div>`;

    html += `<div class="doc-section"><div class="doc-section-title"><i class="fas fa-cake-candles"></i> 직원 생일 축하 🎉</div>`;
    const bdays = d.birthdays.filter(b => b.name.trim());
    if (!bdays.length) {
      html += `<p class="doc-empty-text">이달의 생일자 정보가 없습니다.</p>`;
    } else {
      bdays.forEach(b => {
        html += `<span class="doc-birthday-item">🎂 ${escHtml(b.name)}${b.date ? ' (' + escHtml(b.date) + ')' : ''}</span>`;
      });
    }
    html += `</div>`;

    html += `<div style="text-align:center;margin-top:40px;padding-top:16px;border-top:1.5px solid #e2e8f0;font-size:11px;color:#94a3b8;">강서청소년회관 · ${d.year}년 ${d.month}월 전체회의</div>`;

    document.getElementById('preview-document').innerHTML = html;
    showPage('preview');
    showToast('📄 회의자료가 생성되었습니다!');
  };
})();
