/* ============================================
   PDF → 표준 엑셀 변환 보조 기능
   - PDF.js로 브라우저에서 텍스트 추출
   - 추출 내용을 회의자료 자동기입 표준 엑셀 양식으로 변환
   - 변환 결과를 엑셀로 다운로드하고, 붙여넣기 영역에도 자동 반영
   ============================================ */

(function () {
  const STYLE_ID = 'pdf-to-excel-style';
  const CARD_ID = 'pdf-to-excel-card';
  const HEADERS = ['연도','월','회의일시','회의장소','팀','담당자','직위','구분','프로그램명','세부내용','일자','시간','운영장소','청소년','성인','지도자','비고'];
  let pdfFile = null;
  let convertedRows = [];

  const TEAM_NAMES = [
    { name: '운영지원팀', keys: ['운영지원팀','운영지원'] },
    { name: '교육·홍보팀', keys: ['교육·홍보팀','교육홍보팀','교육·홍보','교육홍보'] },
    { name: '청소년사업팀', keys: ['청소년사업팀','청소년사업'] }
  ];

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .pdf-convert-card {
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,.08);
        border: 1.5px solid #e2e8f0;
        padding: 22px 24px;
        margin-bottom: 16px;
        border-left: 5px solid #b91c1c;
      }
      .pdf-convert-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .pdf-convert-title {
        font-size: 17px;
        font-weight: 800;
        color: #b91c1c;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pdf-convert-sub {
        font-size: 12px;
        color: #64748b;
        margin-top: 4px;
        line-height: 1.55;
      }
      .pdf-convert-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        align-items: stretch;
      }
      .pdf-drop-zone {
        min-height: 145px;
        border: 2.5px dashed #fecaca;
        background: #fff7f7;
        color: #7f1d1d;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        text-align: center;
        padding: 22px;
        cursor: pointer;
        transition: background .2s, border-color .2s, transform .1s;
      }
      .pdf-drop-zone:hover,
      .pdf-drop-zone.drag-active {
        background: #fee2e2;
        border-color: #b91c1c;
        transform: translateY(-1px);
      }
      .pdf-drop-zone i { font-size: 32px; margin-bottom: 8px; color: #b91c1c; }
      .pdf-file-name {
        margin-top: 8px;
        font-size: 12px;
        font-weight: 800;
        color: #b91c1c;
      }
      .pdf-convert-help {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 16px;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .pdf-convert-help b { color: #1a4a8a; }
      .pdf-convert-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
      }
      .btn-pdf-convert,
      .btn-pdf-apply,
      .btn-pdf-download {
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
        transition: transform .1s, opacity .15s;
      }
      .btn-pdf-convert { background: #b91c1c; color: #fff; }
      .btn-pdf-download { background: #1a4a8a; color: #fff; }
      .btn-pdf-apply { background: #ecfdf5; color: #166534; border: 1px solid #bbf7d0; }
      .btn-pdf-convert:hover,
      .btn-pdf-apply:hover,
      .btn-pdf-download:hover { transform: translateY(-1px); }
      .btn-pdf-convert:disabled,
      .btn-pdf-apply:disabled,
      .btn-pdf-download:disabled { opacity: .45; cursor: not-allowed; transform: none; }
      .pdf-status-box {
        display: none;
        margin-top: 12px;
        padding: 11px 13px;
        border-radius: 12px;
        background: #fff7ed;
        border: 1px solid #fed7aa;
        color: #9a3412;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.55;
      }
      @media (max-width: 900px) {
        .pdf-convert-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  async function loadPdfJs() {
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
    return pdfjs;
  }

  function setStatus(message, type = 'info') {
    const box = document.getElementById('pdf-status-box');
    if (!box) return;
    box.style.display = 'block';
    box.textContent = message;
    if (type === 'ok') {
      box.style.background = '#ecfdf5';
      box.style.borderColor = '#bbf7d0';
      box.style.color = '#166534';
    } else if (type === 'error') {
      box.style.background = '#fef2f2';
      box.style.borderColor = '#fecaca';
      box.style.color = '#991b1b';
    } else {
      box.style.background = '#fff7ed';
      box.style.borderColor = '#fed7aa';
      box.style.color = '#9a3412';
    }
  }

  function showToastSafe(msg) {
    if (typeof showToast === 'function') showToast(msg);
  }

  function groupItemsToLines(items) {
    const filtered = items
      .map(it => ({ str: String(it.str || '').trim(), x: it.transform[4], y: it.transform[5] }))
      .filter(it => it.str);
    filtered.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const groups = [];
    filtered.forEach(item => {
      let group = groups.find(g => Math.abs(g.y - item.y) < 4);
      if (!group) {
        group = { y: item.y, items: [] };
        groups.push(group);
      }
      group.items.push(item);
      group.y = (group.y + item.y) / 2;
    });

    return groups
      .sort((a, b) => b.y - a.y)
      .map(g => {
        const sorted = g.items.sort((a, b) => a.x - b.x);
        return {
          text: sorted.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim(),
          x: Math.min(...sorted.map(i => i.x)),
          y: g.y
        };
      })
      .filter(l => l.text);
  }

  function extractBasicInfo(text) {
    const info = { year: '', month: '', date: '', place: '', agenda: [], dozan: '' };
    const ym = text.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월/);
    if (ym) { info.year = ym[1]; info.month = ym[2]; }
    const date = text.match(/일시\s*[:：]\s*([^\n]+)/);
    if (date) info.date = date[1].trim();
    const place = text.match(/장소\s*[:：]\s*([^\n]+)/);
    if (place) info.place = place[1].trim();

    text.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*(\d+)\.\s*(.+)$/);
      if (m && Number(m[1]) <= 10) info.agenda.push(m[2].trim());
    });
    const dz = text.match(/도산의 말씀([\s\S]*?)(강\s*서\s*청\s*소\s*년\s*회\s*관|4\.\s*팀|팀\s*별\s*보\s*고)/);
    if (dz) info.dozan = dz[1].trim();
    return info;
  }

  function detectTeam(text, currentTeam) {
    const compact = String(text || '').replace(/\s/g, '');
    const found = TEAM_NAMES.find(t => t.keys.some(k => compact.includes(k.replace(/\s/g, ''))));
    return found ? found.name : currentTeam;
  }

  function cleanLine(text) {
    return String(text || '')
      .replace(/^[-–—•ㆍ·*＊■□▶▷✔✓\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isJunkLine(line) {
    const t = String(line || '').replace(/\s/g, '');
    if (!t) return true;
    if (/^-?\d+-?$/.test(t)) return true;
    if (/^담당$|^담$|^당$/.test(t)) return true;
    if (/활동보고|활동계획|5월|6월/.test(t) && t.length < 14) return true;
    return false;
  }

  function extractNameMarkers(nameLines, fallbackName) {
    const markers = [];
    let buf = '';
    let startY = null;
    let prevY = null;
    const titles = ['주임','대리','팀장','관장','부장','기타','공통'];
    const forbidden = ['담당','활동','보고','계획','일시','장소','인원','내용','월','팀'];

    function flush() {
      const name = buf.trim();
      if (/^[가-힣]{2,4}$/.test(name) && !forbidden.includes(name)) {
        markers.push({ name, title: '', y: startY || prevY || 9999 });
      }
      buf = '';
      startY = null;
    }

    nameLines.forEach(line => {
      const t = line.text.replace(/\s/g, '');
      if (!t || t === '담' || t === '당' || t === '담당') return;
      if (prevY !== null && Math.abs(prevY - line.y) > 42) flush();
      prevY = line.y;
      if (titles.includes(t)) {
        if (buf) {
          const name = buf.trim();
          if (/^[가-힣]{2,4}$/.test(name) && !forbidden.includes(name)) {
            markers.push({ name, title: t === '기타' || t === '공통' ? '' : t, y: startY || line.y });
          }
          buf = ''; startY = null;
        } else if (t === '기타' || t === '공통') {
          markers.push({ name: t, title: '', y: line.y });
        }
        return;
      }
      if (/^[가-힣]{1,4}$/.test(t) && !forbidden.includes(t)) {
        if (!startY) startY = line.y;
        if (t.length >= 2) { flush(); markers.push({ name: t, title: '', y: line.y }); }
        else { buf += t; if (buf.length >= 4) flush(); }
      }
    });
    flush();
    if (!markers.length && fallbackName) markers.push({ name: fallbackName, title: '', y: 9999 });
    return markers.sort((a, b) => b.y - a.y);
  }

  function splitPrograms(lines) {
    const chunks = [];
    let current = null;
    lines.forEach(line => {
      const raw = line.text.trim();
      if (isJunkLine(raw)) return;
      if (/^\s*■/.test(raw)) {
        current = { startY: line.y, lines: [raw] };
        chunks.push(current);
        return;
      }
      if (!current) {
        if (/^[*＊]/.test(raw) || raw.length > 8) {
          current = { startY: line.y, lines: [raw] };
          chunks.push(current);
        }
        return;
      }
      current.lines.push(raw);
    });
    return chunks;
  }

  function chooseMember(markers, y, fallback) {
    if (!markers.length) return { name: fallback || '자동변환', title: '' };
    const marker = markers.find(m => m.y >= y - 6) || markers[markers.length - 1];
    return marker || { name: fallback || '자동변환', title: '' };
  }

  function parsePeople(text, label) {
    const re = new RegExp(label + '\\s*([0-9,]+)\\s*명');
    const m = text.match(re);
    return m ? Number(m[1].replace(/,/g, '')) : '';
  }

  function parseProgramChunk(chunk) {
    const all = chunk.lines.join('\n');
    let title = cleanLine(chunk.lines[0]).replace(/^■\s*/, '').trim() || '제목 없음';
    const details = chunk.lines.slice(1).map(cleanLine).filter(Boolean).join('\n');
    const date = (all.match(/일시\s*[:：]\s*([^\n]+)/) || [,''])[1].trim();
    const time = (date.match(/(\d{1,2}:\d{2}\s*[~\-–]\s*\d{1,2}:\d{2})/) || [,''])[1].trim();
    const place = (all.match(/장소\s*[:：]\s*([^\n]+)/) || [,''])[1].trim();
    return { title, details, date, time, place, youth: parsePeople(all, '청소년'), adult: parsePeople(all, '성인'), leader: parsePeople(all, '지도자') };
  }

  function rowsFromPageLines(lines, width, basic, currentState) {
    const rows = [];
    const pageText = lines.map(l => l.text).join('\n');
    currentState.team = detectTeam(pageText, currentState.team || '운영지원팀');

    const nameMax = width * 0.17;
    const prevMax = width * 0.55;
    const nameLines = lines.filter(l => l.x < nameMax);
    const prevLines = lines.filter(l => l.x >= nameMax && l.x < prevMax);
    const nextLines = lines.filter(l => l.x >= prevMax);
    const markers = extractNameMarkers(nameLines, currentState.member);

    [['전월', prevLines], ['당월', nextLines]].forEach(([period, colLines]) => {
      splitPrograms(colLines).forEach(chunk => {
        const member = chooseMember(markers, chunk.startY, currentState.member);
        currentState.member = member.name;
        const prog = parseProgramChunk(chunk);
        rows.push([
          basic.year || new Date().getFullYear(),
          basic.month || new Date().getMonth() + 1,
          basic.date || '',
          basic.place || '',
          currentState.team || '운영지원팀',
          member.name || '자동변환',
          member.title || '',
          period,
          prog.title,
          prog.details,
          prog.date,
          prog.time,
          prog.place,
          prog.youth,
          prog.adult,
          prog.leader,
          'PDF 자동 변환 후 확인 필요'
        ]);
      });
    });

    return rows;
  }

  async function extractPdfRows(file) {
    const pdfjs = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const allRows = [HEADERS];
    const rawPages = [];
    let basic = { year: '', month: '', date: '', place: '', agenda: [], dozan: '' };
    const state = { team: '운영지원팀', member: '' };

    for (let p = 1; p <= pdf.numPages; p++) {
      setStatus(`PDF ${p}/${pdf.numPages}쪽을 분석하는 중입니다...`);
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const lines = groupItemsToLines(content.items);
      const text = lines.map(l => l.text).join('\n');
      rawPages.push([`Page ${p}`, text]);
      if (p === 1) basic = { ...basic, ...extractBasicInfo(text) };
      if (p >= 2) rowsFromPageLines(lines, viewport.width, basic, state).forEach(r => allRows.push(r));
    }
    return { rows: allRows, rawPages, basic };
  }

  function rowsToTsv(rows) {
    return rows.map(r => r.map(v => String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' / ')).join('\t')).join('\n');
  }

  function downloadExcel(rows, rawPages, basic, fileName) {
    if (!window.XLSX) { showToastSafe('⚠️ 엑셀 생성 라이브러리를 불러오지 못했습니다.'); return; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), '붙여넣기용_활동자료');
    const infoRows = [
      ['항목','내용'],
      ['연도', basic.year || ''],
      ['월', basic.month || ''],
      ['회의일시', basic.date || ''],
      ['회의장소', basic.place || ''],
      ['안건', (basic.agenda || []).join('\n')],
      ['도산의 말씀', basic.dozan || '']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(infoRows), '기본정보_안건');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['페이지','추출 텍스트'], ...rawPages]), 'PDF추출원문');
    const safeName = (fileName || '회의자료').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `${safeName}_표준엑셀변환.xlsx`);
  }

  async function convertPdfAndDownload() {
    if (!pdfFile) { showToastSafe('⚠️ 먼저 PDF 파일을 선택해주세요.'); return; }
    try {
      document.getElementById('btn-pdf-convert')?.setAttribute('disabled', 'disabled');
      setStatus('PDF 분석을 시작합니다. 표 구조에 따라 일부 내용은 확인·수정이 필요할 수 있습니다.');
      const result = await extractPdfRows(pdfFile);
      convertedRows = result.rows;
      const activityCount = Math.max(0, convertedRows.length - 1);
      const textarea = document.getElementById('import-meeting-text');
      if (textarea) textarea.value = rowsToTsv(convertedRows);
      downloadExcel(result.rows, result.rawPages, result.basic, pdfFile.name);
      setStatus(`✅ PDF 변환 완료: ${activityCount}개 후보 항목을 표준 엑셀 양식으로 변환했습니다. 다운로드한 엑셀을 확인한 뒤 삽입하거나, 바로 [변환 결과 자동 기입]을 누르세요.`, 'ok');
      showToastSafe('✅ PDF를 표준 엑셀 양식으로 변환했습니다.');
    } catch (err) {
      console.error(err);
      setStatus('PDF 변환 중 오류가 발생했습니다. 텍스트형 PDF인지 확인해주세요. 스캔 이미지 PDF는 서버형 OCR이 필요합니다.', 'error');
      showToastSafe('⚠️ PDF 변환에 실패했습니다.');
    } finally {
      document.getElementById('btn-pdf-convert')?.removeAttribute('disabled');
    }
  }

  function applyConvertedRows() {
    const textarea = document.getElementById('import-meeting-text');
    if (!textarea || !textarea.value.trim()) {
      showToastSafe('⚠️ 먼저 PDF를 변환해주세요.');
      return;
    }
    document.getElementById('btn-import-apply')?.click();
  }

  function injectPdfCard() {
    if (document.getElementById(CARD_ID)) return;
    const panel = document.getElementById('panel-import-meeting');
    if (!panel) return;
    const firstCard = panel.querySelector('.import-panel-card');
    const card = document.createElement('div');
    card.id = CARD_ID;
    card.className = 'pdf-convert-card';
    card.innerHTML = `
      <div class="pdf-convert-header">
        <div>
          <div class="pdf-convert-title"><i class="fas fa-file-pdf"></i> PDF → 표준 엑셀 변환</div>
          <div class="pdf-convert-sub">PDF 회의자료를 먼저 표준 엑셀 양식으로 변환해 다운로드한 뒤, 변환 결과를 회의자료 삽입 영역에 자동 반영할 수 있습니다.</div>
        </div>
      </div>
      <div class="pdf-convert-grid">
        <label class="pdf-drop-zone" id="pdf-drop-zone" for="pdf-file-input">
          <i class="fas fa-file-arrow-up"></i>
          <strong>PDF 파일 선택 또는 드래그</strong>
          <small>텍스트형 PDF 우선 지원 / 스캔 이미지 PDF는 OCR 필요</small>
          <div class="pdf-file-name" id="pdf-file-name">선택된 PDF 없음</div>
        </label>
        <div class="pdf-convert-help">
          <div><b>권장 흐름</b>: PDF 업로드 → 엑셀 다운로드 → 엑셀에서 확인·수정 → [회의자료 삽입]에 붙여넣기 또는 업로드</div>
          <div><b>자동 기입</b>: 변환 결과는 아래 붙여넣기 입력창에도 자동 입력되며, 바로 자동 기입할 수 있습니다.</div>
          <div><b>주의</b>: 좌우 2단 표 PDF는 담당자 구분이 일부 어긋날 수 있어 엑셀 확인을 권장합니다.</div>
        </div>
      </div>
      <input type="file" id="pdf-file-input" accept=".pdf,application/pdf" style="display:none">
      <div class="pdf-convert-actions">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn-pdf-convert" id="btn-pdf-convert"><i class="fas fa-file-excel"></i> PDF를 엑셀로 변환/다운로드</button>
          <button type="button" class="btn-pdf-apply" id="btn-pdf-apply"><i class="fas fa-check"></i> 변환 결과 자동 기입</button>
        </div>
      </div>
      <div id="pdf-status-box" class="pdf-status-box"></div>
    `;
    if (firstCard) panel.insertBefore(card, firstCard); else panel.appendChild(card);

    const input = card.querySelector('#pdf-file-input');
    const drop = card.querySelector('#pdf-drop-zone');
    const name = card.querySelector('#pdf-file-name');

    input.addEventListener('change', e => {
      pdfFile = e.target.files[0] || null;
      name.textContent = pdfFile ? pdfFile.name : '선택된 PDF 없음';
    });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-active'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-active'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag-active');
      pdfFile = e.dataTransfer.files[0] || null;
      if (pdfFile && !/\.pdf$/i.test(pdfFile.name)) {
        showToastSafe('⚠️ PDF 파일만 선택해주세요.');
        pdfFile = null;
      }
      name.textContent = pdfFile ? pdfFile.name : '선택된 PDF 없음';
    });
    card.querySelector('#btn-pdf-convert').addEventListener('click', convertPdfAndDownload);
    card.querySelector('#btn-pdf-apply').addEventListener('click', applyConvertedRows);
  }

  function initPdfToExcel() {
    injectStyle();
    injectPdfCard();
  }

  document.addEventListener('DOMContentLoaded', initPdfToExcel);
  window.addEventListener('load', initPdfToExcel);
  setTimeout(initPdfToExcel, 900);
})();
