/* ============================================
   PDF → 검수용 보고블록 변환 시스템
   - PDF를 바로 입력하지 않고 검수용 보고블록 표로 변환
   - ■ = 프로그램명 / 하위 줄 = 세부내용
   - 왼쪽 열 = 전월, 오른쪽 열 = 당월
   - 검수 후 엑셀 다운로드 또는 자동기입
   ============================================ */

(function () {
  const STYLE_ID = 'pdf-block-style';
  const CARD_ID = 'pdf-block-card';

  const BLOCK_HEADERS = [
    '변환ID','source_page','source_column','연도','월','회의일시','회의장소',
    '팀','담당자','직위','구분','프로그램명','세부내용','일자','시간','운영장소',
    '청소년','성인','지도자','비고','검수상태','신뢰도'
  ];

  const STANDARD_HEADERS = [
    '연도','월','회의일시','회의장소','팀','담당자','직위','구분','프로그램명','세부내용',
    '일자','시간','운영장소','청소년','성인','지도자','비고'
  ];

  const TEAMS = [
    { name: '운영지원팀', keys: ['운영지원팀', '운영지원'] },
    { name: '청소년사업팀', keys: ['청소년사업팀', '청소년사업'] },
    { name: '교육홍보팀', keys: ['교육홍보팀', '교육·홍보팀', '교육홍보', '교육·홍보'] }
  ];

  const MEMBER_DICTIONARY = {
    '운영지원팀': ['이건희','노혜성','김상구','기타'],
    '청소년사업팀': ['황세윤','박준규','김유진','기타'],
    '교육홍보팀': ['차보람','김가은','김은정','기타']
  };

  let selectedPdfFile = null;
  let blockRows = [];
  let rawPages = [];
  let basicInfo = {};

  const $ = selector => document.querySelector(selector);
  const compact = value => String(value || '').replace(/\s/g, '');
  const escapeHtml = value => String(value || '').replace(/[&<>"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char]));
  const cleanBullet = value => String(value || '').replace(/^[\-–—•ㆍ·*＊■□▶▷✔✓\s]+/, '').replace(/\s+/g, ' ').trim();

  function toast(message) {
    if (typeof showToast === 'function') showToast(message);
  }

  function setStatus(message, type = '') {
    const box = $('#pdf-block-status');
    if (!box) return;
    box.style.display = 'block';
    box.className = `pdf-block-status ${type}`;
    box.textContent = message;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .pdf-block-card {
        background:#fff;
        border:1.5px solid #e2e8f0;
        border-left:5px solid #7c3aed;
        border-radius:16px;
        padding:22px 24px;
        margin-bottom:16px;
        box-shadow:0 1px 3px rgba(0,0,0,.08);
      }
      .pdf-block-title {
        display:flex;
        align-items:center;
        gap:8px;
        font-size:17px;
        font-weight:800;
        color:#6d28d9;
        margin-bottom:6px;
      }
      .pdf-block-sub {
        font-size:12px;
        color:#64748b;
        line-height:1.55;
        margin-bottom:14px;
      }
      .pdf-block-grid {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
      }
      .pdf-block-drop {
        min-height:138px;
        border:2.5px dashed #c4b5fd;
        border-radius:14px;
        background:#faf5ff;
        color:#5b21b6;
        display:flex;
        align-items:center;
        justify-content:center;
        flex-direction:column;
        text-align:center;
        padding:20px;
        cursor:pointer;
        transition:.15s;
      }
      .pdf-block-drop:hover,
      .pdf-block-drop.drag-on {
        background:#f3e8ff;
        border-color:#7c3aed;
        transform:translateY(-1px);
      }
      .pdf-block-drop i {
        font-size:32px;
        margin-bottom:8px;
      }
      .pdf-block-file-name {
        margin-top:8px;
        font-size:12px;
        font-weight:800;
      }
      .pdf-block-help {
        background:#f8fafc;
        border:1px solid #e2e8f0;
        border-radius:12px;
        padding:13px 15px;
        font-size:12px;
        color:#475569;
        line-height:1.6;
      }
      .pdf-block-help b { color:#1a4a8a; }
      .pdf-block-actions {
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:13px;
      }
      .pdf-block-btn {
        display:inline-flex;
        align-items:center;
        gap:6px;
        border:none;
        border-radius:10px;
        padding:10px 15px;
        font-family:inherit;
        font-size:13px;
        font-weight:800;
        cursor:pointer;
        transition:.1s;
      }
      .pdf-block-btn:hover { transform:translateY(-1px); }
      .pdf-block-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; }
      .pdf-block-convert { background:#7c3aed; color:#fff; }
      .pdf-block-download { background:#1a4a8a; color:#fff; }
      .pdf-block-apply { background:#ecfdf5; color:#166534; border:1px solid #bbf7d0; }
      .pdf-block-status {
        display:none;
        margin-top:12px;
        padding:11px 13px;
        border-radius:12px;
        background:#fff7ed;
        border:1px solid #fed7aa;
        color:#9a3412;
        font-size:12px;
        font-weight:700;
        line-height:1.55;
      }
      .pdf-block-status.ok { background:#ecfdf5; border-color:#bbf7d0; color:#166534; }
      .pdf-block-status.err { background:#fef2f2; border-color:#fecaca; color:#991b1b; }
      .pdf-block-preview {
        display:none;
        margin-top:14px;
        border:1.5px solid #e2e8f0;
        border-radius:14px;
        overflow:hidden;
      }
      .pdf-block-preview-head {
        display:flex;
        justify-content:space-between;
        gap:8px;
        flex-wrap:wrap;
        background:#f8fafc;
        padding:11px 13px;
        border-bottom:1px solid #e2e8f0;
        font-size:12px;
        color:#64748b;
        font-weight:800;
      }
      .pdf-block-scroll { max-height:460px; overflow:auto; }
      .pdf-block-table { width:100%; border-collapse:collapse; font-size:12px; }
      .pdf-block-table th {
        position:sticky;
        top:0;
        background:#1a4a8a;
        color:#fff;
        padding:8px;
        border:1px solid #dbeafe;
        white-space:nowrap;
        z-index:1;
      }
      .pdf-block-table td {
        padding:7px 8px;
        border:1px solid #e2e8f0;
        vertical-align:top;
        white-space:pre-line;
        min-width:78px;
      }
      .pdf-block-table td[contenteditable=true]:focus {
        outline:2px solid #fdba74;
        background:#fff7ed;
      }
      .pdf-block-program { min-width:210px; font-weight:800; color:#1e293b; }
      .pdf-block-detail { min-width:360px; line-height:1.5; }
      .pdf-block-no { background:#f8fafc; text-align:center; font-weight:800; color:#64748b; }
      .pdf-block-confidence-low { background:#fef2f2 !important; }
      .pdf-block-confidence-mid { background:#fff7ed !important; }
      @media(max-width:900px){ .pdf-block-grid{grid-template-columns:1fr;} }
    `;
    document.head.appendChild(style);
  }

  async function loadPdfJs() {
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
    return pdfjs;
  }

  function groupTextItems(items) {
    const positioned = items
      .map(item => ({ text: String(item.str || '').trim(), x: item.transform[4], y: item.transform[5] }))
      .filter(item => item.text);

    positioned.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const groups = [];

    positioned.forEach(item => {
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
      .map(group => {
        const sorted = group.items.sort((a, b) => a.x - b.x);
        return {
          text: sorted.map(item => item.text).join(' ').replace(/\s+/g, ' ').trim(),
          x: Math.min(...sorted.map(item => item.x)),
          y: group.y
        };
      })
      .filter(line => line.text);
  }

  function extractBasicInfo(text) {
    const result = { year: '', month: '', date: '', place: '', agenda: [], dozan: '' };
    const ym = text.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월/);
    if (ym) {
      result.year = ym[1];
      result.month = ym[2];
    }
    const date = text.match(/일시\s*[:：]\s*([^\n]+)/);
    if (date) result.date = date[1].trim();
    const place = text.match(/장소\s*[:：]\s*([^\n]+)/);
    if (place) result.place = place[1].trim();

    text.split(/\r?\n/).forEach(line => {
      const agenda = line.match(/^\s*(\d+)\.\s*(.+)$/);
      if (agenda) result.agenda.push(agenda[2].trim());
    });
    return result;
  }

  function isJunkLine(value) {
    const text = compact(value);
    if (!text) return true;
    if (/^-?\d+-?$/.test(text)) return true;
    if (/^(담|당|담당)$/.test(text)) return true;
    if (/월활동보고/.test(text)) return true;
    if (/월활동계획/.test(text)) return true;
    if (/활동보고.*활동계획/.test(text)) return true;
    if (/^(성명|활동요일|활동시간|휴게시간)$/.test(text)) return true;
    if (/^\d{1,2}:\d{2}[~\-–]\d{1,2}:\d{2}$/.test(text)) return true;
    return false;
  }

  function detectTeam(text, currentTeam) {
    const source = compact(text);
    const found = TEAMS.find(team => team.keys.some(key => source.includes(compact(key))));
    return found ? found.name : currentTeam;
  }

  function extractNameMarkers(lines, teamName, fallbackName) {
    const dictionary = MEMBER_DICTIONARY[teamName] || [];
    const joinedByY = lines.map(line => ({ ...line, compact: compact(line.text) }));
    const markers = [];

    dictionary.forEach(name => {
      if (name === '기타') return;
      const letters = name.split('');
      for (let i = 0; i <= joinedByY.length - letters.length; i++) {
        const segment = joinedByY.slice(i, i + letters.length);
        const matched = segment.every((line, idx) => line.compact === letters[idx]);
        if (!matched) continue;
        const yGap = Math.abs(segment[0].y - segment[segment.length - 1].y);
        if (yGap > 120) continue;
        const titleCandidate = joinedByY[i + letters.length]?.compact || '';
        markers.push({
          name,
          title: ['주임','대리','팀장','부장','관장'].includes(titleCandidate) ? titleCandidate : '',
          y: segment[0].y,
          confidence: '높음'
        });
      }
    });

    lines.forEach(line => {
      const value = compact(line.text);
      if (value === '기타' || value === '공통') {
        markers.push({ name: value, title: '', y: line.y, confidence: '높음' });
      }
    });

    if (!markers.length && fallbackName) {
      markers.push({ name: fallbackName, title: '', y: 9999, confidence: '낮음' });
    }

    return markers.sort((a, b) => b.y - a.y);
  }

  function chooseMember(markers, y, fallbackName) {
    if (!markers.length) return { name: fallbackName || '자동변환', title: '', confidence: '낮음' };
    const found = markers.find(marker => marker.y >= y - 6) || markers[markers.length - 1];
    return found || { name: fallbackName || '자동변환', title: '', confidence: '낮음' };
  }

  function splitIntoProgramBlocks(lines) {
    const blocks = [];
    let current = null;

    lines.forEach(line => {
      const text = line.text.trim();
      if (isJunkLine(text)) return;

      if (/^■/.test(text)) {
        current = { y: line.y, lines: [text] };
        blocks.push(current);
        return;
      }

      if (!current) return;
      current.lines.push(text);
    });

    return blocks.filter(block => block.lines.length && !isJunkLine(block.lines[0]));
  }

  function parsePeople(text, label) {
    const found = text.match(new RegExp(label + '\\s*([0-9,]+)\\s*명'));
    return found ? Number(found[1].replace(/,/g, '')) : '';
  }

  function parseProgramBlock(block) {
    const validLines = block.lines.filter(line => !isJunkLine(line));
    const full = validLines.join('\n');
    const title = cleanBullet(validLines[0] || '제목 없음');
    const detailLines = validLines.slice(1).map(cleanBullet).filter(Boolean);
    const detail = detailLines.join('\n');
    const date = (full.match(/일시\s*[:：]\s*([^\n]+)/) || ['', ''])[1].trim();
    const time = (date.match(/(\d{1,2}:\d{2}\s*[~\-–]\s*\d{1,2}:\d{2})/) || ['', ''])[1].trim();
    const place = (full.match(/장소\s*[:：]\s*([^\n]+)/) || ['', ''])[1].trim();

    return {
      title,
      detail,
      date,
      time,
      place,
      youth: parsePeople(full, '청소년'),
      adult: parsePeople(full, '성인'),
      leader: parsePeople(full, '지도자')
    };
  }

  function confidenceFor(member, program) {
    if (!member || member.confidence === '낮음') return '낮음';
    if (!program.title || program.title === '제목 없음') return '낮음';
    if (!program.detail) return '중간';
    return '높음';
  }

  async function convertPdfToBlocks() {
    if (!selectedPdfFile) {
      toast('⚠️ PDF 파일을 선택해주세요.');
      return;
    }

    try {
      $('#pdf-block-convert').disabled = true;
      setStatus('PDF를 보고블록 단위로 분석하는 중입니다.');

      const pdfjs = await loadPdfJs();
      const pdf = await pdfjs.getDocument({ data: await selectedPdfFile.arrayBuffer() }).promise;

      blockRows = [BLOCK_HEADERS];
      rawPages = [['페이지', '추출 원문']];
      basicInfo = {};

      let currentTeam = '운영지원팀';
      let currentMember = '';
      let blockIndex = 1;

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        setStatus(`PDF ${pageNo}/${pdf.numPages}쪽 분석 중...`);
        const page = await pdf.getPage(pageNo);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const pageLines = groupTextItems(content.items);
        const pageText = pageLines.map(line => line.text).join('\n');

        rawPages.push([`Page ${pageNo}`, pageText]);

        if (pageNo === 1) {
          basicInfo = extractBasicInfo(pageText);
          continue;
        }

        currentTeam = detectTeam(pageText, currentTeam);

        const nameColumn = pageLines.filter(line => line.x < viewport.width * 0.18);
        const prevColumn = pageLines.filter(line => line.x >= viewport.width * 0.18 && line.x < viewport.width * 0.55);
        const nextColumn = pageLines.filter(line => line.x >= viewport.width * 0.55);
        const markers = extractNameMarkers(nameColumn, currentTeam, currentMember);

        [
          { label: '전월', column: 'left', lines: prevColumn },
          { label: '당월', column: 'right', lines: nextColumn }
        ].forEach(group => {
          splitIntoProgramBlocks(group.lines).forEach(block => {
            const member = chooseMember(markers, block.y, currentMember);
            currentMember = member.name;
            const program = parseProgramBlock(block);
            const confidence = confidenceFor(member, program);
            const id = `B${String(blockIndex).padStart(4, '0')}`;
            blockIndex += 1;

            blockRows.push([
              id,
              pageNo,
              group.column,
              basicInfo.year || new Date().getFullYear(),
              basicInfo.month || new Date().getMonth() + 1,
              basicInfo.date || '',
              basicInfo.place || '',
              currentTeam,
              member.name,
              member.title || '',
              group.label,
              program.title,
              program.detail,
              program.date,
              program.time,
              program.place,
              program.youth,
              program.adult,
              program.leader,
              'PDF 보고블록 자동 변환 후 검수 필요',
              confidence === '높음' ? '자동' : '확인필요',
              confidence
            ]);
          });
        });
      }

      renderPreviewTable(blockRows);
      const standardRows = convertBlocksToStandardRows(blockRows);
      const textArea = $('#import-meeting-text');
      if (textArea) textArea.value = rowsToTsv(standardRows);

      setStatus(`✅ 보고블록 변환 완료: ${Math.max(0, blockRows.length - 1)}개 블록을 찾았습니다. 미리보기 표에서 검수 후 엑셀 다운로드 또는 자동기입을 진행하세요.`, 'ok');
      toast('✅ PDF가 보고블록 검수표로 변환되었습니다.');
    } catch (error) {
      console.error(error);
      setStatus('PDF 변환 실패: 텍스트형 PDF가 아니거나 구조 분석에 실패했습니다. 스캔 PDF는 OCR/서버형 분석이 필요합니다.', 'err');
      toast('⚠️ PDF 변환에 실패했습니다.');
    } finally {
      $('#pdf-block-convert').disabled = false;
    }
  }

  function renderPreviewTable(rows) {
    const wrap = $('#pdf-block-preview');
    const body = $('#pdf-block-body');
    const info = $('#pdf-block-info');
    if (!wrap || !body) return;

    wrap.style.display = 'block';
    info.textContent = `총 ${Math.max(0, rows.length - 1)}개 보고블록 · 표 셀은 직접 수정 가능`;

    body.innerHTML = rows.slice(1).map((row, rowIndex) => {
      const confidence = row[21] || '';
      const confidenceClass = confidence === '낮음' ? 'pdf-block-confidence-low' : confidence === '중간' ? 'pdf-block-confidence-mid' : '';
      return `
        <tr>
          <td class="pdf-block-no">${rowIndex + 1}</td>
          ${BLOCK_HEADERS.map((header, colIndex) => {
            const extraClass = colIndex === 11 ? 'pdf-block-program' : colIndex === 12 ? 'pdf-block-detail' : '';
            return `<td contenteditable="true" data-c="${colIndex}" class="${extraClass} ${confidenceClass}">${escapeHtml(row[colIndex] ?? '')}</td>`;
          }).join('')}
        </tr>`;
    }).join('');
  }

  function getPreviewRows() {
    const body = $('#pdf-block-body');
    if (!body || !body.children.length) return blockRows;

    const rows = [BLOCK_HEADERS];
    [...body.querySelectorAll('tr')].forEach(tr => {
      const row = [];
      [...tr.querySelectorAll('td[data-c]')].forEach(td => {
        row[Number(td.dataset.c)] = td.innerText.trim();
      });
      rows.push(row);
    });
    return rows;
  }

  function convertBlocksToStandardRows(blocks) {
    const rows = [STANDARD_HEADERS];
    blocks.slice(1).forEach(row => {
      const status = row[20] || '';
      if (status === '제외') return;
      rows.push([
        row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11], row[12],
        row[13], row[14], row[15], row[16], row[17], row[18], row[19]
      ]);
    });
    return rows;
  }

  function rowsToTsv(rows) {
    return rows.map(row => row.map(value => String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' / ')).join('\t')).join('\n');
  }

  function downloadExcel() {
    const previewRows = getPreviewRows();
    if (!previewRows.length || previewRows.length <= 1) {
      toast('⚠️ 먼저 PDF를 분석해주세요.');
      return;
    }
    if (!window.XLSX) {
      toast('⚠️ 엑셀 라이브러리를 불러오지 못했습니다.');
      return;
    }

    const standardRows = convertBlocksToStandardRows(previewRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(previewRows), '변환검수_보고블록');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(standardRows), '붙여넣기용_활동자료');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['항목','내용'],
      ['연도', basicInfo.year || ''],
      ['월', basicInfo.month || ''],
      ['회의일시', basicInfo.date || ''],
      ['회의장소', basicInfo.place || ''],
      ['안건', (basicInfo.agenda || []).join('\n')]
    ]), '기본정보_안건');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rawPages), 'PDF추출원문');

    const filename = (selectedPdfFile ? selectedPdfFile.name.replace(/\.pdf$/i, '') : '회의자료') + '_보고블록_검수용.xlsx';
    XLSX.writeFile(wb, filename);
    toast('✅ 검수용 엑셀을 다운로드했습니다.');
  }

  function applyPreviewRows() {
    const previewRows = getPreviewRows();
    if (!previewRows.length || previewRows.length <= 1) {
      toast('⚠️ 먼저 PDF를 분석해주세요.');
      return;
    }
    const standardRows = convertBlocksToStandardRows(previewRows);
    const textArea = $('#import-meeting-text');
    if (textArea) textArea.value = rowsToTsv(standardRows);
    $('#btn-import-apply')?.click();
  }

  function injectPanel() {
    injectStyle();
    const importPanel = $('#panel-import-meeting');
    if (!importPanel || document.getElementById(CARD_ID)) return;

    const oldPdfCard = importPanel.querySelector('.import-card.pdf');
    if (oldPdfCard) oldPdfCard.style.display = 'none';
    const oldPreview = $('#pdf2-card');
    if (oldPreview) oldPreview.style.display = 'none';

    const card = document.createElement('div');
    card.id = CARD_ID;
    card.className = 'pdf-block-card';
    card.innerHTML = `
      <div class="pdf-block-title"><i class="fas fa-file-pdf"></i> PDF → 보고블록 검수표 변환</div>
      <div class="pdf-block-sub">
        PDF를 바로 입력하지 않고, 먼저 ‘검수용 보고블록 표’로 변환합니다. 표에서 담당자·구분·프로그램명·세부내용을 확인한 뒤 엑셀 다운로드 또는 자동기입을 진행하세요.
      </div>
      <div class="pdf-block-grid">
        <label class="pdf-block-drop" id="pdf-block-drop" for="pdf-block-input">
          <i class="fas fa-file-arrow-up"></i>
          <strong>PDF 파일 선택 또는 드래그</strong>
          <small>텍스트형 PDF 우선 지원 / 스캔 PDF는 OCR 필요</small>
          <div class="pdf-block-file-name" id="pdf-block-file-name">선택된 PDF 없음</div>
        </label>
        <div class="pdf-block-help">
          <b>분류 원칙</b><br>
          · 왼쪽 열 = 전월 / 오른쪽 열 = 당월<br>
          · ■ = 프로그램명 / *, -, 이어지는 줄 = 세부내용<br>
          · ‘5월 활동 보고’, ‘6월 활동 계획’, ‘담당’ 등 표 머리글은 제외<br>
          · 신뢰도가 낮은 행은 표에서 수정 후 사용
        </div>
      </div>
      <input type="file" id="pdf-block-input" accept=".pdf,application/pdf" style="display:none">
      <div class="pdf-block-actions">
        <button type="button" class="pdf-block-btn pdf-block-convert" id="pdf-block-convert"><i class="fas fa-magnifying-glass-chart"></i> PDF 분석 및 보고블록 표 생성</button>
        <button type="button" class="pdf-block-btn pdf-block-download" id="pdf-block-download"><i class="fas fa-file-excel"></i> 검수용 엑셀 다운로드</button>
        <button type="button" class="pdf-block-btn pdf-block-apply" id="pdf-block-apply"><i class="fas fa-check"></i> 검수표 기준 자동기입</button>
      </div>
      <div id="pdf-block-status" class="pdf-block-status"></div>
      <div id="pdf-block-preview" class="pdf-block-preview">
        <div class="pdf-block-preview-head">
          <strong><i class="fas fa-table"></i> 변환검수_보고블록</strong>
          <span id="pdf-block-info"></span>
        </div>
        <div class="pdf-block-scroll">
          <table class="pdf-block-table">
            <thead><tr><th>No</th>${BLOCK_HEADERS.map(header => `<th>${header}</th>`).join('')}</tr></thead>
            <tbody id="pdf-block-body"></tbody>
          </table>
        </div>
      </div>
    `;

    importPanel.insertBefore(card, importPanel.querySelector('.import-card') || importPanel.firstChild);

    const input = $('#pdf-block-input');
    const drop = $('#pdf-block-drop');
    const fileName = $('#pdf-block-file-name');

    input.addEventListener('change', event => {
      selectedPdfFile = event.target.files[0] || null;
      fileName.textContent = selectedPdfFile ? selectedPdfFile.name : '선택된 PDF 없음';
    });

    drop.addEventListener('dragover', event => {
      event.preventDefault();
      drop.classList.add('drag-on');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-on'));
    drop.addEventListener('drop', event => {
      event.preventDefault();
      drop.classList.remove('drag-on');
      const dropped = event.dataTransfer.files[0] || null;
      if (dropped && !/\.pdf$/i.test(dropped.name)) {
        toast('⚠️ PDF 파일만 선택해주세요.');
        return;
      }
      selectedPdfFile = dropped;
      fileName.textContent = selectedPdfFile ? selectedPdfFile.name : '선택된 PDF 없음';
    });

    $('#pdf-block-convert').addEventListener('click', convertPdfToBlocks);
    $('#pdf-block-download').addEventListener('click', downloadExcel);
    $('#pdf-block-apply').addEventListener('click', applyPreviewRows);
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(injectPanel, 900));
  window.addEventListener('load', () => setTimeout(injectPanel, 900));
  setTimeout(injectPanel, 1500);
})();
