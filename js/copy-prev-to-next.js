/* ============================================
   담당자별 전월 활동 보고 → 당월 활동 계획 복사 기능
   - 기존 Firebase 저장 구조 변경 없음
   - 복사된 항목은 일반 당월 항목처럼 수정/삭제 가능
   ============================================ */

(function () {
  const STYLE_ID = 'copy-prev-to-next-style';

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

      .btn-copy-prev-to-next {
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

      .btn-copy-prev-to-next:hover {
        background: #1a4a8a;
        color: #fff;
        transform: translateY(-1px);
      }

      .btn-copy-prev-to-next:disabled {
        opacity: .45;
        cursor: not-allowed;
        transform: none;
        background: #f1f5f9;
        color: #94a3b8;
      }

      @media (max-width: 800px) {
        .member-section-actions {
          width: 100%;
          justify-content: flex-start;
          margin-left: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function cloneProgramItem(item) {
    return JSON.parse(JSON.stringify(item || {}));
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
    btn.title = '전월 활동 보고 항목을 당월 활동 계획으로 복사합니다.';
    btn.innerHTML = '<i class="fas fa-copy"></i> 전월 → 당월 복사';
    btn.addEventListener('click', () => window.copyPrevToNext(teamIdx, mIdx));

    if (addBtn) group.insertBefore(btn, addBtn);
    else group.appendChild(btn);
  }

  function injectCopyButtonsForTeam(teamIdx) {
    const members = window.appState?.programs?.[teamIdx] || [];
    members.forEach((_, mIdx) => injectCopyButton(teamIdx, mIdx));
  }

  function injectAllCopyButtons() {
    injectCopyStyle();
    [0, 1, 2].forEach(injectCopyButtonsForTeam);
  }

  window.copyPrevToNext = function copyPrevToNext(teamIdx, mIdx) {
    const member = window.appState?.programs?.[teamIdx]?.[mIdx];
    if (!member) return;

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

    if (typeof refreshProgramList === 'function') {
      refreshProgramList(teamIdx, mIdx, 'next');
    }
    if (typeof autoSave === 'function') autoSave();

    showToast(`✅ 전월 활동 보고 ${copiedItems.length}개 항목을 당월 활동 계획으로 복사했습니다.`);
    setTimeout(() => injectCopyButton(teamIdx, mIdx), 0);
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

  function initCopyFeature() {
    injectCopyStyle();
    wrapRenderMemberList();
    wrapRefreshProgramList();
    injectAllCopyButtons();
  }

  initCopyFeature();
  document.addEventListener('DOMContentLoaded', initCopyFeature);
  window.addEventListener('load', initCopyFeature);
})();
