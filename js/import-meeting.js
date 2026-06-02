/* ============================================
   회의자료 삽입 탭
   - 텍스트/CSV/엑셀/JSON 파일을 읽어 회의자료 구조에 자동 반영
   - 브라우저 정적 환경 기준: txt, csv, xlsx, xls, json 우선 지원
   ============================================ */

(function () {
  const STYLE_ID = 'meeting-import-style';
  const PANEL_ID = 'panel-import-meeting';
  const STEP_ID = 'step-tab-import-meeting';

  const TEAM_NAMES = [
    { idx: 0, name: '운영지원팀', keys: ['운영지원팀', '운영지원'] },
    { idx: 1, name: '교육·홍보팀', keys: ['교육·홍보팀', '교육홍보팀', '교육·홍보', '교육홍보'] },
    { idx: 2, name: '청소년사업팀', keys: ['청소년사업팀', '청소년사업'] }
  ];

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .import-panel-card {
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,.08);
        border: 1.5px solid #e2e8f0;
        padding: 22px 24px;
        margin-bottom: 16px;
      }
      .import-grid {
        display: grid;
        grid-template-columns: 1.1fr .9fr;
        gap: 18px;
        align-items: start;
      }
      .import-drop-zone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 170px;
        padding: 28px 20px;
        border: 2.5px dashed #cbd5e1;
        border-radius: 16px;
        background: #f8fafc;
        color: #64748b;
        text-align: center;
        cursor: pointer;
        transition: border-color .2s, background .2s, color .2s;
      }
      .import-drop-zone:hover,
      .import-drop-zone.drag-active {
        border-color: #1a4a8a;
        background: #eef6ff;
        color: #1a4a8a;
      }
      .import-drop-zone i {
        font-size: 34px;
        color: #1a4a8a;
        margin-bottom: 10px;
      }
      .import-drop-zone strong { color: #1a4a8a; }
      .import-help-list {
        display: flex;
        flex-direction: column;
        gap: 9px;
        padding: 14px 16px;
        background: #f8fafc;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        font-size: 12px;
        color: #475569;
        line-height: 1.55;
      }
      .import-help-list b { color: #1a4a8a; }
      .import-textarea {
        width: 100%;
        min-height: 230px;
        resize: vertical;
        border: 1.5px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 16px;
        font-family: 'Noto Sans KR', sans-serif;
        font-size: 13px;
        line-height: 1.65;
        outline: none;
        background: #f8fafc;
        color: #1e293b;
      }
      .import-textarea:focus { border-color: #2a67c0; background: #fff; }
      .import-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 14px;
      }
      .import-option {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        color: #475569;
      }
      .btn-import-apply,
      .btn-import-clear,
      .btn-import-sample {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        transition: background .15s, transform .1s;
      }
      .btn-import-apply { background: #1a4a8a; color: #fff; }
      .btn-import-clear { background: #f1f5f9; color: #475569; }
      .btn-import-sample { background: #fff7ed; color: #c2410c; }
      .btn-import-apply:hover,
      .btn-import-clear:hover,
      .btn-import-sample:hover { transform: translateY(-1px); }
      .import-result-box {
        margin-top: 14px;
        padding: 12px 14px;
        border-radius: 12px;
        background: #ecfdf5;
        color: #166534;
        border: 1px solid #bbf7d0;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.55;
        display: none;
      }
      .step-item-import .step-num { background: #fef3c7; color: #92400e; }
      .step-item-import.active .step-num { background: #d97706; color: #fff; }
      @media (max-width: 900px) {
        .import-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function blankDataFromCurrent() {
    const base = typeof collectData === 'function' ? collectData() : {};
    return {
      year: base.year || new Date().getFullYear(),
      month: base.month || (new Date().getMonth() + 1),
      date: base.date || '',
      place: base.place || '어우러짐',
      agenda: Array.isArray(base.agenda) ? base.agenda.map(a => ({ ...a })) : [],
      teamOrder: Array.isArray(base.teamOrder) ? [...base.teamOrder] : [0, 1, 2],
      dozan: { content: '', source: '' },
      programs: { 0: [], 1: [], 2: [] },
      notices: [],
      birthdays: []
    };
  }

  function currentDataCopy() {
    const base = typeof collectData === 'function' ? collectData() : blankDataFromCurrent();
    return JSON.parse(JSON.stringify(base));
  }

  function ensurePrograms(data) {
    if (!data.programs) data.programs = { 0: [], 1: [], 2: [] };
    [0, 1, 2].forEach(i => { if (!Array.isArray(data.programs[i])) data.programs[i] = []; });
  }

  function findTeamIdx(value) {
    const text = String(value || '').replace(/\s/g, '');
    const found = TEAM_NAMES.find(t => t.keys.some(k => text.includes(k.replace(/\s/g, ''))));
    return found ? found.idx : 0;
  }

  function findOrCreateMember(data, teamIdx, name, title) {
    ensurePrograms(data);
    const memberName = String(name || '').trim() || '자동삽입';
    let member = data.programs[teamIdx].find(m => (m.name || '') === memberName);
    if (!member) {
      member = { id: '', name: memberName, title: String(title || '').trim(), prev: [], next: [] };
      data.programs[teamIdx].push(member);
    }
    if (title && !member.title) member.title = String(title).trim();
    if (!Array.isArray(member.prev)) member.prev = [];
    if (!Array.isArray(member.next)) member.next = [];
    return member;
  }

  function normalizePeriod(value) {
    const text = String(value || '').replace(/\s/g, '');
    if (/전월|보고|실적|결과/.test(text)) return 'prev';
    if (/당월|계획|예정/.test(text)) return 'next';
    return 'next';
  }

  function toNumber(value) {
    const n = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function createProgramFromRow(row, map) {
    const name = getCell(row, map.program) || getCell(row, map.name) || '';
    const subText = getCell(row, map.sub) || getCell(row, map.content) || '';
    const prog = {
      name: String(name || subText || '제목 없음').trim(),
      dates: String(getCell(row, map.date) || '').trim(),
      time: String(getCell(row, map.time) || '').trim(),
      place: String(getCell(row, map.place) || '').trim(),
      youth: toNumber(getCell(row, map.youth)),
      adult: toNumber(getCell(row, map.adult)),
      leader: toNumber(getCell(row, map.leader)),
      notes: String(getCell(row, map.note) || '').trim(),
      subs: []
    };
    if (subText && String(subText).trim() !== prog.name) {
      prog.subs.push({
        text: String(subText).trim(),
        date: String(getCell(row, map.subDate) || '').trim(),
        time: String(getCell(row, map.subTime) || '').trim(),
        place: String(getCell(row, map.subPlace) || '').trim(),
        youth: toNumber(getCell(row, map.subYouth)),
        adult: toNumber(getCell(row, map.subAdult)),
        leader: toNumber(getCell(row, map.subLeader))
      });
    }
    return prog;
  }

  function getCell(row, idx) {
    return idx >= 0 ? row[idx] : '';
  }

  function headerIndex(headers, patterns) {
    return headers.findIndex(h => patterns.some(p => String(h || '').replace(/\s/g, '').includes(p)));
  }

  function parseRowsToData(rows, reset) {
    const data = reset ? blankDataFromCurrent() : currentDataCopy();
    ensurePrograms(data);
    const cleanRows = rows.filter(r => Array.isArray(r) && r.some(c => String(c || '').trim()));
    if (!cleanRows.length) return { data, count: 0, mode: 'rows' };

    const headers = cleanRows[0].map(h => String(h || '').trim());
    const map = {
      year: headerIndex(headers, ['연도']),
      month: headerIndex(headers, ['월']),
      dateInfo: headerIndex(headers, ['회의일시', '일시']),
      placeInfo: headerIndex(headers, ['회의장소', '장소']),
      team: headerIndex(headers, ['팀']),
      member: headerIndex(headers, ['담당자', '작성자', '이름']),
      title: headerIndex(headers, ['직위', '직책']),
      period: headerIndex(headers, ['구분', '분류', '전월당월']),
      program: headerIndex(headers, ['프로그램명', '사업명', '활동명']),
      name: headerIndex(headers, ['제목']),
      sub: headerIndex(headers, ['세부내용', '하위항목', '내용']),
      content: headerIndex(headers, ['보고내용', '계획내용']),
      date: headerIndex(headers, ['일자', '날짜', '기간']),
      time: headerIndex(headers, ['시간']),
      place: headerIndex(headers, ['운영장소', '활동장소']),
      youth: headerIndex(headers, ['청소년']),
      adult: headerIndex(headers, ['성인']),
      leader: headerIndex(headers, ['지도자', '담당지도자']),
      note: headerIndex(headers, ['비고', '특이사항', '메모']),
      subDate: headerIndex(headers, ['세부일자']),
      subTime: headerIndex(headers, ['세부시간']),
      subPlace: headerIndex(headers, ['세부장소']),
      subYouth: headerIndex(headers, ['세부청소년']),
      subAdult: headerIndex(headers, ['세부성인']),
      subLeader: headerIndex(headers, ['세부지도자'])
    };

    let count = 0;
    cleanRows.slice(1).forEach(row => {
      if (map.year >= 0 && row[map.year]) data.year = toNumber(row[map.year]) || data.year;
      if (map.month >= 0 && row[map.month]) data.month = toNumber(row[map.month]) || data.month;
      if (map.dateInfo >= 0 && row[map.dateInfo]) data.date = String(row[map.dateInfo]).trim();
      if (map.placeInfo >= 0 && row[map.placeInfo]) data.place = String(row[map.placeInfo]).trim();

      const progName = getCell(row, map.program) || getCell(row, map.name) || getCell(row, map.content) || getCell(row, map.sub);
      if (!progName) return;

      const teamIdx = findTeamIdx(getCell(row, map.team));
      const member = findOrCreateMember(data, teamIdx, getCell(row, map.member), getCell(row, map.title));
      const period = normalizePeriod(getCell(row, map.period));
      member[period].push(createProgramFromRow(row, map));
      count += 1;
    });

    return { data, count, mode: 'rows' };
  }

  function stripBullet(line) {
    return String(line || '').replace(/^[\-–—•ㆍ·*■□▶▷✔✓\d.\)\s]+/, '').trim();
  }

  function parseTextToData(text, reset) {
    const data = reset ? blankDataFromCurrent() : currentDataCopy();
    ensurePrograms(data);
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let section = '';
    let teamIdx = 0;
    let period = 'next';
    let member = null;
    let currentProg = null;
    let count = 0;
    const dozanLines = [];

    function setMember(name) { member = findOrCreateMember(data, teamIdx, name || '자동삽입', ''); }
    function addProgram(name) {
      if (!member) setMember('자동삽입');
      const prog = { name: stripBullet(name) || '제목 없음', subs: [] };
      member[period].push(prog);
      currentProg = prog;
      count += 1;
    }

    lines.forEach(raw => {
      const line = raw.trim();
      const ym = line.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월/);
      if (ym) { data.year = Number(ym[1]); data.month = Number(ym[2]); }
      if (/^일시\s*[:：]/.test(line)) { data.date = line.replace(/^일시\s*[:：]/, '').trim(); return; }
      if (/^장소\s*[:：]/.test(line)) { data.place = line.replace(/^장소\s*[:：]/, '').trim(); return; }
      if (/안건/.test(line)) { section = 'agenda'; return; }
      if (/도산의\s*말씀/.test(line)) { section = 'dozan'; return; }
      if (/기타\s*공지|공지사항/.test(line)) { section = 'notices'; return; }
      if (/생일/.test(line)) { section = 'birthdays'; return; }

      const team = TEAM_NAMES.find(t => t.keys.some(k => line.replace(/\s/g, '').includes(k.replace(/\s/g, ''))));
      if (team) { teamIdx = team.idx; section = 'programs'; setMember('자동삽입'); return; }
      if (/전월|활동\s*보고|보고/.test(line) && !/당월/.test(line)) { period = 'prev'; section = 'programs'; currentProg = null; return; }
      if (/당월|활동\s*계획|계획/.test(line)) { period = 'next'; section = 'programs'; currentProg = null; return; }

      const memberMatch = line.match(/^(담당자|작성자|이름)\s*[:：]\s*(.+)$/);
      if (memberMatch) { setMember(memberMatch[2]); return; }

      if (section === 'agenda') {
        const text = stripBullet(line);
        if (text) data.agenda.push({ text });
        return;
      }
      if (section === 'dozan') { dozanLines.push(line); return; }
      if (section === 'notices') { data.notices.push(stripBullet(line)); return; }
      if (section === 'birthdays') { data.birthdays.push({ name: stripBullet(line), date: '' }); return; }
      if (section === 'programs') {
        if (/^[-–—•ㆍ·]/.test(line) && currentProg) currentProg.subs.push({ text: stripBullet(line) });
        else addProgram(line);
      }
    });

    if (dozanLines.length) data.dozan.content = dozanLines.join('\n');
    return { data, count, mode: 'text' };
  }

  function parseDelimitedText(text) {
    const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
    const delimiter = lines.some(l => l.includes('\t')) ? '\t' : ',';
    return lines.map(line => line.split(delimiter).map(c => c.replace(/^"|"$/g, '').trim()));
  }

  function applyImportFromText() {
    const text = document.getElementById('import-meeting-text')?.value || '';
    const reset = document.getElementById('import-reset-current')?.checked || false;
    if (!text.trim()) { showToast('⚠️ 붙여넣은 회의자료 내용이 없습니다.'); return; }

    let result;
    const looksTable = text.includes('\t') || text.split(/\r?\n/)[0]?.includes(',');
    if (looksTable && /팀|담당자|프로그램|구분|사업명|활동명/.test(text.split(/\r?\n/)[0] || '')) {
      result = parseRowsToData(parseDelimitedText(text), reset);
    } else {
      try {
        const json = JSON.parse(text);
        const imported = json.data || json;
        if (imported && imported.programs) result = { data: imported, count: 1, mode: 'json' };
        else result = parseTextToData(text, reset);
      } catch(e) {
        result = parseTextToData(text, reset);
      }
    }
    applyImportedData(result);
  }

  function applyImportedData(result) {
    if (!result || !result.data) return;
    if (typeof restoreData === 'function') restoreData(result.data);
    if (typeof autoSave === 'function') autoSave();
    showImportResult(`✅ 회의자료 삽입 완료: ${result.count || 0}개 항목을 자동 기입했습니다. (${result.mode})`);
    showToast('✅ 회의자료가 자동 기입되었습니다. 입력 내용을 확인해주세요.');
    if (typeof goStep === 'function') goStep('info');
  }

  function showImportResult(msg) {
    const box = document.getElementById('import-result-box');
    if (!box) return;
    box.style.display = 'block';
    box.textContent = msg;
  }

  function loadSample() {
    const sample = `연도\t월\t회의일시\t회의장소\t팀\t담당자\t직위\t구분\t프로그램명\t세부내용\t일자\t시간\t운영장소\t청소년\t성인\t지도자\t비고\n2026\t6\t2026. 6. 4.(목) 10:00~11:00\t어우러짐\t운영지원팀\t이건희\t주임\t전월\t청소년 스마트 체육관 FUNGYM[재미:짐]\t8주 체형관리 결과보고 및 활동소식 게시\t5월\t\t스마트체육관\t8\t1\t1\t\n2026\t6\t2026. 6. 4.(목) 10:00~11:00\t어우러짐\t운영지원팀\t이건희\t주임\t당월\t청소년 스마트 체육관 FUNGYM[재미:짐]\t12주 체형관리 운영\t6월\t10:00~11:00\t스마트체육관\t29\t1\t1\t`;
    document.getElementById('import-meeting-text').value = sample;
    showImportResult('예시 데이터가 입력되었습니다. [자동 기입하기]를 눌러 확인하세요.');
  }

  async function handleFile(file) {
    if (!file) return;
    const reset = document.getElementById('import-reset-current')?.checked || false;
    const name = file.name.toLowerCase();
    if (/\.json$/.test(name)) {
      const text = await file.text();
      document.getElementById('import-meeting-text').value = text;
      applyImportFromText();
      return;
    }
    if (/\.(txt|csv)$/.test(name)) {
      const text = await file.text();
      document.getElementById('import-meeting-text').value = text;
      applyImportFromText();
      return;
    }
    if (/\.(xlsx|xls)$/.test(name)) {
      if (!window.XLSX) { showToast('⚠️ 엑셀 파싱 라이브러리를 불러오지 못했습니다.'); return; }
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows = [];
      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        arr.forEach(r => rows.push(r));
      });
      document.getElementById('import-meeting-text').value = rows.map(r => r.join('\t')).join('\n');
      applyImportedData(parseRowsToData(rows, reset));
      return;
    }
    showToast('⚠️ 현재는 txt, csv, xlsx, xls, json 파일을 우선 지원합니다.');
  }

  function goImportStep() {
    if (typeof showPage === 'function') showPage('input');
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(PANEL_ID)?.classList.add('active');
    document.querySelectorAll('.step-item').forEach(i => i.classList.remove('active'));
    document.getElementById(STEP_ID)?.classList.add('active');
  }

  function injectTabAndPanel() {
    if (document.getElementById(STEP_ID)) return;
    const stepList = document.getElementById('step-list');
    const formArea = document.querySelector('.form-area');
    if (!stepList || !formArea) return;

    const li = document.createElement('li');
    li.className = 'step-item step-item-import';
    li.id = STEP_ID;
    li.innerHTML = `<span class="step-num"><i class="fas fa-file-import"></i></span><span class="step-label">회의자료 삽입</span>`;
    li.addEventListener('click', goImportStep);
    const infoTab = document.getElementById('step-tab-info');
    stepList.insertBefore(li, infoTab || stepList.firstChild);

    const panel = document.createElement('div');
    panel.className = 'step-panel';
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="panel-header" style="border-left-color:#d97706">
        <h2 style="color:#d97706"><i class="fas fa-file-import"></i> 회의자료 삽입</h2>
        <p>엑셀·CSV·텍스트 회의자료를 붙여넣거나 파일로 불러와 현재 양식에 자동 기입합니다.</p>
      </div>
      <div class="import-panel-card">
        <div class="import-grid">
          <div>
            <label class="import-drop-zone" id="import-drop-zone" for="import-file-input">
              <i class="fas fa-cloud-arrow-up"></i>
              <p><strong>파일을 드래그하거나 클릭해서 업로드</strong><br>또는 아래 입력칸에 회의자료 텍스트/엑셀 표를 붙여넣으세요.</p>
              <small>지원: .xlsx / .xls / .csv / .txt / .json</small>
            </label>
            <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv,.txt,.json" style="display:none">
          </div>
          <div class="import-help-list">
            <div><b>엑셀 권장 열:</b> 연도, 월, 회의일시, 회의장소, 팀, 담당자, 직위, 구분, 프로그램명, 세부내용, 일자, 시간, 운영장소, 청소년, 성인, 지도자, 비고</div>
            <div><b>구분 열:</b> 전월 / 당월로 입력하면 전월 활동보고와 당월 활동계획에 자동 배치됩니다.</div>
            <div><b>텍스트:</b> 운영지원팀, 전월 활동 보고, 당월 활동 계획 같은 제목을 기준으로 자동 분류합니다.</div>
          </div>
        </div>
        <textarea id="import-meeting-text" class="import-textarea" placeholder="여기에 회의자료 텍스트, CSV, 엑셀 표 복사본을 붙여넣으세요."></textarea>
        <div class="import-actions">
          <label class="import-option"><input type="checkbox" id="import-reset-current"> 현재 입력자료를 비우고 새 회의자료로 생성</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn-import-sample" id="btn-import-sample"><i class="fas fa-wand-magic-sparkles"></i> 예시 불러오기</button>
            <button type="button" class="btn-import-clear" id="btn-import-clear"><i class="fas fa-eraser"></i> 비우기</button>
            <button type="button" class="btn-import-apply" id="btn-import-apply"><i class="fas fa-check"></i> 자동 기입하기</button>
          </div>
        </div>
        <div id="import-result-box" class="import-result-box"></div>
      </div>`;
    formArea.insertBefore(panel, formArea.firstChild);

    document.getElementById('btn-import-apply').addEventListener('click', applyImportFromText);
    document.getElementById('btn-import-clear').addEventListener('click', () => {
      document.getElementById('import-meeting-text').value = '';
      const box = document.getElementById('import-result-box');
      if (box) box.style.display = 'none';
    });
    document.getElementById('btn-import-sample').addEventListener('click', loadSample);
    document.getElementById('import-file-input').addEventListener('change', e => handleFile(e.target.files[0]));

    const drop = document.getElementById('import-drop-zone');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-active'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-active'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag-active');
      handleFile(e.dataTransfer.files[0]);
    });
  }

  function initImportMeeting() {
    injectStyle();
    injectTabAndPanel();
  }

  window.goImportMeetingStep = goImportStep;
  document.addEventListener('DOMContentLoaded', initImportMeeting);
  window.addEventListener('load', initImportMeeting);
  setTimeout(initImportMeeting, 600);
})();
