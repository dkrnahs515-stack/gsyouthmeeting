/* ============================================
   담당자별 전월 활동 보고 → 당월 활동 계획 복사 기능
   - 기존 Firebase 저장 구조 변경 없음
   - 복사된 항목은 일반 당월 항목처럼 수정/삭제 가능
   - 복사 항목명 앞에 [복사하기] 자동 표시
   - 팀별 전월 보고 전체 → 당월 계획 일괄 복사 지원
   ============================================ */

(function () {
  const STYLE_ID = 'copy-prev-to-next-style';
  const COPY_PREFIX = '[복사하기]';

  function injectCopyStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .member-section-header {
        gap: 8px;
        flex-wrap: wrap;
      }

      .member-section-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-left: auto;
      }

      .btn-copy-prev-to-next,
      .btn-copy-team-prev-to-next {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        border: 1.5px solid rgba(26, 74, 138, 0.25);
        border-radius: 8px;
        background: #eef6ff;
        color: #1a4a8a;
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: background .15s, color .15s, transform .1s;
        white-space: nowrap;
      }

      .btn-copy-prev-to-next:hover,
      .btn-copy-team-prev-to-next:hover {
        background: #1a4a8a;
        color: #fff;
        transform: translateY(-1px);
      }

      .btn-copy-prev-to-next:disabled,
      .btn-copy-team-prev-to-next:disabled {
        opacity: .45;
        cursor: not-allowed;
        transform: none;
        background: #f1f5f9;
        color: #94a3b8;
      }

      .team-copy-all-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
      }

      .btn-copy-team-prev-to-next {
        background: #fff7ed;
        color: #c2410c;
        border-color: rgba(217, 119, 6, 0.28);
      }

      .btn-copy-team-prev-to-next:hover {
        background: #d97706;
        color: #fff;
      }

      .copy-help-text {
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.4;
      }

      @media (max-width: 800px) {
        .member-section-actions {
          width: 100%;
          justify-content: flex-start;
          margin-left: 0;
        }

        .team-copy-all-actions {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getCurrentData() {
    if (typeof collectData !== 'function') return null;
    return collectData();
  }

  function getTeamMembers(teamIdx) {
    const data = getCurrentData();
    return data?.programs?.[teamIdx] || [];
  }

  function normalizeCopiedName(name) {
    const original = (name || '').trim() || '제목 없음';
    return original.startsWith(COPY_PREFIX) ? original : `${COPY_PREFIX} ${original}`;
  }

  function cloneProgramItem(item) {
    const copied = JSON.parse(JSON.stringify(item || {}));
    copied.name = normalizeCopiedName(copied.name);
    return copied;
  }

  function applyDataAndStayOnTeam(data, teamIdx) {
    if (typeof restoreData === 'function') restoreData(data);
    if (typeof goStep === 'function') goStep(`team-${teamIdx}`);
    if (typeof autoSave === 'function') autoSave();
    setTimeout(injectAllCopyButtons, 0);
  }

  function ensureActionGroup(header) {
    let group = header.querySelector('.member-section-actions');
    if (group) return group;

    group = document.createElement('div');
    group.className = 'member-section-actions';

    const addBtn = header.querySelector('.btn-add-program');
    if (addBtn) {
      header.appendChild(group);
      group.appendChild(addBtn);
    } else {
      header.appendChild(group);
    }
    return group;
  }

  function injectCopyButton(teamIdx, mIdx) {
    const card = document.getElementById(`member-card-${teamIdx}-${mIdx}`);
    if (!card) return;

    const nextHeader = card.querySelector('.member-section-next .member-section-header');
    if (!nextHeader || nextHeader.querySelector('.btn-copy-prev-to-next')) return;

    const group = ensureActionGroup(nextHeader);
    const addBtn = group.querySelector('.btn-add-program');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-copy-prev-to-next';
    btn.title = '이 담당자의 전월 활동 보고 항목을 당월 활동 계획으로 복사합니다.';
    btn.innerHTML = '<i class="fas fa-copy"></i> 전월 → 당월 복사';
    btn.addEventListener('click', () => window.copyPrevToNext(teamIdx, mIdx));

    if (addBtn) group.insertBefore(btn, addBtn);
    else group.appendChild(btn);
  }

  function injectTeamCopyAllButton(teamIdx) {
    const panel = document.getElementById(`panel-team-${teamIdx}`);
    if (!panel) return;

    const header = panel.querySelector('.panel-header');
    if (!header || header.querySelector('.btn-copy-team-prev-to-next')) return;

    const actions = document.createElement('div');
    actions.className = 'team-copy-all-actions';
    actions.innerHTML = `
      <button type="button" class="btn-copy-team-prev-to-next" title="이 팀의 모든 담당자 전월 활동 보고를 당월 활동 계획으로 복사합니다.">
        <i class="fas fa-copy"></i> 이 팀 전월 보고 전체 → 당월 계획 복사
      </button>
      <span class="copy-help-text">복사된 항목명 앞에는 ${COPY_PREFIX}가 자동으로 붙습니다.</span>
    `;

    actions.querySelector('.btn-copy-team-prev-to-next').addEventListener('click', () => {
      window.copyTeamPrevToNext(teamIdx);
    });

    header.appendChild(actions);
  }

  function injectCopyButtonsForTeam(teamIdx) {
    injectTeamCopyAllButton(teamIdx);
    const members = getTeamMembers(teamIdx);
    members.forEach((_, mIdx) => injectCopyButton(teamIdx, mIdx));
  }

  function injectAllCopyButtons() {
    injectCopyStyle();
    [0, 1, 2].forEach(injectCopyButtonsForTeam);
  }

  window.copyPrevToNext = function copyPrevToNext(teamIdx, mIdx) {
    const data = getCurrentData();
    const member = data?.programs?.[teamIdx]?.[mIdx];
    if (!data || !member) return;

    const prevItems = Array.isArray(member.prev) ? member.prev : [];
    if (!prevItems.length) {
      showToast('⚠️ 복사할 전월 활동 보고 항목이 없습니다.');
      return;
    }

    if (!Array.isArray(member.next)) member.next = [];

    if (member.next.length) {
      const ok = confirm('당월 활동 계획에 이미 입력된 항목이 있습니다.\n전월 활동 보고 항목을 당월 계획 뒤에 추가로 복사할까요?');
      if (!ok) return;
    }

    const copiedItems = prevItems.map(cloneProgramItem);
    member.next.push(...copiedItems);

    applyDataAndStayOnTeam(data, teamIdx);
    showToast(`✅ ${COPY_PREFIX} 표시로 전월 활동 보고 ${copiedItems.length}개 항목을 당월 활동 계획으로 복사했습니다.`);
  };

  window.copyTeamPrevToNext = function copyTeamPrevToNext(teamIdx) {
    const data = getCurrentData();
    const members = data?.programs?.[teamIdx] || [];
    if (!data || !members.length) {
      showToast('⚠️ 복사할 담당자가 없습니다.');
      return;
    }

    let copyCount = 0;
    let memberCount = 0;
    let hasExistingNext = false;

    members.forEach(member => {
      const prevItems = Array.isArray(member.prev) ? member.prev : [];
      if (!prevItems.length) return;
      if (Array.isArray(member.next) && member.next.length) hasExistingNext = true;
    });

    const hasCopySource = members.some(member => Array.isArray(member.prev) && member.prev.length);
    if (!hasCopySource) {
      showToast('⚠️ 이 팀에 복사할 전월 활동 보고 항목이 없습니다.');
      return;
    }

    const confirmMessage = hasExistingNext
      ? '이 팀의 일부 담당자는 이미 당월 활동 계획 항목이 있습니다.\n기존 당월 계획 뒤에 전월 보고 항목을 추가로 복사할까요?'
      : '이 팀의 모든 담당자 전월 활동 보고를 당월 활동 계획으로 복사할까요?';

    if (!confirm(confirmMessage)) return;

    members.forEach(member => {
      const prevItems = Array.isArray(member.prev) ? member.prev : [];
      if (!prevItems.length) return;

      if (!Array.isArray(member.next)) member.next = [];
      const copiedItems = prevItems.map(cloneProgramItem);
      member.next.push(...copiedItems);
      copyCount += copiedItems.length;
      memberCount += 1;
    });

    applyDataAndStayOnTeam(data, teamIdx);
    showToast(`✅ ${memberCount}명 담당자의 전월 보고 ${copyCount}개 항목을 당월 계획으로 일괄 복사했습니다.`);
  };

  function wrapRenderMemberList() {
    if (typeof window.renderMemberList !== 'function' || window.renderMemberList.__copyWrapped) return;

    const original = window.renderMemberList;
    window.renderMemberList = function wrappedRenderMemberList(teamIdx) {
      const result = original.apply(this, arguments);
      setTimeout(() => injectCopyButtonsForTeam(teamIdx), 0);
      return result;
    };
    window.renderMemberList.__copyWrapped = true;
  }

  function wrapRefreshProgramList() {
    if (typeof window.refreshProgramList !== 'function' || window.refreshProgramList.__copyWrapped) return;

    const original = window.refreshProgramList;
    window.refreshProgramList = function wrappedRefreshProgramList(teamIdx, mIdx, type) {
      const result = original.apply(this, arguments);
      setTimeout(() => injectCopyButton(teamIdx, mIdx), 0);
      return result;
    };
    window.refreshProgramList.__copyWrapped = true;
  }

  function wrapRenderTeamStepTabs() {
    if (typeof window.renderTeamStepTabs !== 'function' || window.renderTeamStepTabs.__copyWrapped) return;

    const original = window.renderTeamStepTabs;
    window.renderTeamStepTabs = function wrappedRenderTeamStepTabs() {
      const result = original.apply(this, arguments);
      setTimeout(injectAllCopyButtons, 0);
      return result;
    };
    window.renderTeamStepTabs.__copyWrapped = true;
  }

  function initCopyFeature() {
    injectCopyStyle();
    wrapRenderMemberList();
    wrapRefreshProgramList();
    wrapRenderTeamStepTabs();
    injectAllCopyButtons();
  }

  initCopyFeature();
  document.addEventListener('DOMContentLoaded', initCopyFeature);
  window.addEventListener('load', initCopyFeature);
})();
