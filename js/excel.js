/* ============================================================
   강서청소년회관 전체회의 자동화 — 엑셀 뷰어 (excel.js)
   SheetJS(xlsx) 기반: 파일 로드 → 시트 탭 → 테이블 렌더 → 인쇄
   ============================================================ */

/* 블록별 워크북 캐시 { 1: workbook, 2: workbook } */
const _excelWBCache = {};

/* ── 드래그·드롭 이벤트 ── */
function excelDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-active');
}
function excelDragLeave(e) {
  e.currentTarget.classList.remove('drag-active');
}
function excelDrop(e, wrapId, filenameId, tabsId, dropId) {
  e.preventDefault();
  const dropZone = document.getElementById(dropId);
  if (dropZone) dropZone.classList.remove('drag-active');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  _readExcelFile(file, wrapId, filenameId, tabsId, dropId);
}

/* ── input[file] 변경 이벤트 ── */
function loadExcelFile(input, wrapId, filenameId, tabsId) {
  const file = input.files[0];
  if (!file) return;
  // 드롭존 ID는 wrapId에서 유추 (excel-sheet-wrap-N → excel-drop-N)
  const dropId = wrapId.replace('excel-sheet-wrap-', 'excel-drop-');
  _readExcelFile(file, wrapId, filenameId, tabsId, dropId);
  input.value = ''; // 같은 파일 재선택 허용
}

/* ── 핵심: 파일 읽기 → 파싱 → 렌더 ── */
function _readExcelFile(file, wrapId, filenameId, tabsId, dropId) {
  // 확장자 체크
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls','csv'].includes(ext)) {
    alert('.xlsx / .xls / .csv 파일만 지원합니다.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let wb;
      if (ext === 'csv') {
        // CSV: 텍스트 읽기
        wb = XLSX.read(e.target.result, { type: 'string', raw: false });
      } else {
        wb = XLSX.read(e.target.result, { type: 'array', cellStyles: true, cellDates: true });
      }

      // 블록 번호 추출 (wrap id 끝 숫자)
      const blockNum = parseInt(wrapId.replace(/\D/g, ''), 10);
      _excelWBCache[blockNum] = wb;

      // 드롭존 숨기기
      const dropZone = document.getElementById(dropId);
      if (dropZone) dropZone.style.display = 'none';

      // 파일명 표시
      const fnEl = document.getElementById(filenameId);
      if (fnEl) {
        fnEl.style.display = 'flex';
        fnEl.innerHTML = `<i class="fas fa-file-excel" style="color:#217346"></i>
          <span>${escHtmlEx(file.name)}</span>
          <span class="excel-file-size">${_formatSize(file.size)}</span>`;
      }

      // 시트 탭 렌더
      _renderSheetTabs(wb, tabsId, wrapId, 0);

      // 첫 번째 시트 렌더
      _renderSheet(wb, wb.SheetNames[0], wrapId);

    } catch(err) {
      console.error('엑셀 파싱 오류:', err);
      alert('파일을 읽는 중 오류가 발생했습니다.\n' + err.message);
    }
  };

  if (ext === 'csv') {
    reader.readAsText(file, 'utf-8');
  } else {
    reader.readAsArrayBuffer(file);
  }
}

/* ── 시트 탭 렌더 ── */
function _renderSheetTabs(wb, tabsId, wrapId, activeIdx) {
  const tabsEl = document.getElementById(tabsId);
  if (!tabsEl) return;
  tabsEl.style.display = 'flex';
  tabsEl.innerHTML = wb.SheetNames.map((name, i) => `
    <button class="excel-sheet-tab ${i === activeIdx ? 'active' : ''}"
      onclick="_switchSheet(${JSON.stringify(wb.SheetNames)}, ${i}, '${tabsId}', '${wrapId}')">
      <i class="fas fa-table-cells" style="font-size:10px;margin-right:4px;"></i>${escHtmlEx(name)}
    </button>`).join('');
}

/* ── 시트 전환 ── */
function _switchSheet(names, idx, tabsId, wrapId) {
  const blockNum = parseInt(wrapId.replace(/\D/g, ''), 10);
  const wb = _excelWBCache[blockNum];
  if (!wb) return;

  // 탭 active 상태 갱신
  const tabsEl = document.getElementById(tabsId);
  if (tabsEl) {
    tabsEl.querySelectorAll('.excel-sheet-tab').forEach((btn, i) => {
      btn.classList.toggle('active', i === idx);
    });
  }

  _renderSheet(wb, names[idx], wrapId);
}

/* ── 시트 → 테이블 렌더 ── */
function _renderSheet(wb, sheetName, wrapId) {
  const ws    = wb.Sheets[sheetName];
  const wrapEl = document.getElementById(wrapId);
  if (!wrapEl) return;

  if (!ws) {
    wrapEl.innerHTML = '<p style="padding:20px;color:var(--gray-400);">시트 데이터가 없습니다.</p>';
    return;
  }

  // JSON으로 변환 (헤더 포함, 빈 셀 유지)
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    blankrows: true,
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });

  if (!rows || rows.length === 0) {
    wrapEl.innerHTML = '<p style="padding:20px;color:var(--gray-400);">데이터가 없습니다.</p>';
    return;
  }

  // 최대 열 수 계산
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);

  // 범위 정보 (병합 셀 처리용)
  const merges = ws['!merges'] || [];

  // 병합 맵 생성 { "row,col": {rowspan, colspan} }
  const mergeMap  = {};
  const skipCells = new Set();
  merges.forEach(m => {
    const rs = m.e.r - m.s.r + 1;
    const cs = m.e.c - m.s.c + 1;
    mergeMap[`${m.s.r},${m.s.c}`] = { rowspan: rs, colspan: cs };
    // 병합된 나머지 셀은 건너뜀
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r !== m.s.r || c !== m.s.c) skipCells.add(`${r},${c}`);
      }
    }
  });

  // 테이블 HTML 생성
  let html = '<div class="excel-table-scroll"><table class="excel-table"><tbody>';

  rows.forEach((row, ri) => {
    html += '<tr>';
    for (let ci = 0; ci < maxCols; ci++) {
      const key = `${ri},${ci}`;
      if (skipCells.has(key)) continue;

      const val  = (row[ci] !== undefined && row[ci] !== null) ? String(row[ci]) : '';
      const merge = mergeMap[key] || {};
      const rsAttr = merge.rowspan > 1 ? ` rowspan="${merge.rowspan}"` : '';
      const csAttr = merge.colspan > 1 ? ` colspan="${merge.colspan}"` : '';

      // 숫자 판별: 우측 정렬
      const isNum = val !== '' && !isNaN(val.replace(/,/g, ''));
      const alignCls = isNum ? ' num-cell' : '';

      // 첫 행은 헤더 스타일
      const tag = ri === 0 ? 'th' : 'td';

      html += `<${tag}${rsAttr}${csAttr} class="excel-cell${alignCls}">${escHtmlEx(val)}</${tag}>`;
    }
    html += '</tr>';
  });

  html += '</tbody></table></div>';

  // 행/열 수 정보
  html = `<div class="excel-table-meta">
    <span><i class="fas fa-th"></i> ${rows.length}행 × ${maxCols}열</span>
    <span class="excel-sheet-name-badge">${escHtmlEx(sheetName)}</span>
  </div>` + html;

  wrapEl.innerHTML = html;
}

/* ── 블록 인쇄: 전체 시트, 각 1페이지 자동 맞춤 ── */
function printExcelBlock(blockNum) {
  const wb   = _excelWBCache[blockNum];
  const fnEl = document.getElementById(`excel-filename-${blockNum}`);

  if (!wb) { alert('먼저 엑셀 파일을 불러오세요.'); return; }

  const filename = fnEl ? fnEl.textContent.trim() : `첨부자료 ${blockNum}`;

  /* ─ 시트별 테이블 HTML 생성 헬퍼 ─ */
  function sheetToTableHtml(ws) {
    const rows = XLSX.utils.sheet_to_json(ws, {
      header:1, defval:'', blankrows:true, raw:false, dateNF:'yyyy-mm-dd'
    });
    if (!rows || !rows.length) return '';
    const maxCols = rows.reduce((m,r) => Math.max(m,r.length), 0);
    if (!maxCols) return '';

    const merges = ws['!merges'] || [];
    const mmap = {}, skip = new Set();
    merges.forEach(m => {
      mmap[`${m.s.r},${m.s.c}`] = { rs: m.e.r-m.s.r+1, cs: m.e.c-m.s.c+1 };
      for (let r=m.s.r; r<=m.e.r; r++)
        for (let c=m.s.c; c<=m.e.c; c++)
          if (r!==m.s.r || c!==m.s.c) skip.add(`${r},${c}`);
    });

    let t = '<table><tbody>';
    rows.forEach((row, ri) => {
      t += '<tr>';
      for (let ci=0; ci<maxCols; ci++) {
        const k = `${ri},${ci}`;
        if (skip.has(k)) continue;
        const val = row[ci]!=null ? String(row[ci]) : '';
        const mg  = mmap[k]||{};
        const rA  = mg.rs>1 ? ` rowspan="${mg.rs}"` : '';
        const cA  = mg.cs>1 ? ` colspan="${mg.cs}"` : '';
        const num = val!=='' && !isNaN(val.replace(/,/g,''));
        const tag = ri===0 ? 'th' : 'td';
        t += `<${tag}${rA}${cA}${num?' class="num"':''}>${escHtmlEx(val)}</${tag}>`;
      }
      t += '</tr>';
    });
    return t + '</tbody></table>';
  }

  /* ─ 유효 시트 목록 ─ */
  const validSheets = wb.SheetNames
    .map(n => ({ name: n, html: sheetToTableHtml(wb.Sheets[n]) }))
    .filter(s => s.html);

  if (!validSheets.length) { alert('인쇄할 데이터가 없습니다.'); return; }

  /* ─ 각 시트 섹션 HTML ─ */
  const sectionsHtml = validSheets.map((s, i) => `
    <div class="sheet-page" id="sp${i}">
      <div class="sheet-header">
        <span class="sheet-num">${i+1}</span>${escHtmlEx(s.name)}
        <span class="sheet-total"> / 총 ${validSheets.length}시트</span>
      </div>
      <div class="fit-wrap" id="fw${i}">
        <div class="fit-inner" id="fi${i}">${s.html}</div>
      </div>
    </div>`).join('');

  /* ─ 인쇄 팝업 ─ */
  const pw = window.open('', '_blank', 'width=1200,height=820');
  pw.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escHtmlEx(filename)}</title>
<style>
/* === 리셋 === */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* === 화면 전용 툴바 === */
#toolbar{
  position:fixed;top:0;left:0;right:0;height:52px;
  background:#1a4a8a;color:#fff;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 20px;z-index:9999;gap:12px;
}
#toolbar .t-info{line-height:1.4}
#toolbar .t-title{font-size:13pt;font-weight:700}
#toolbar .t-sub{font-size:9pt;opacity:.75}
#toolbar button{
  background:#fff;color:#1a4a8a;border:none;border-radius:6px;
  padding:8px 22px;font-size:12pt;font-weight:700;cursor:pointer;
}
#toolbar button:hover{background:#dbeafe}

/* === 본문 (화면) === */
body{
  font-family:'Malgun Gothic','맑은 고딕','Apple SD Gothic Neo',sans-serif;
  background:#e8edf2;
  padding-top:64px; /* 툴바 높이 + 여유 */
}
.body-inner{padding:16px;max-width:1160px;margin:0 auto;}

/* === 시트 카드 (화면) === */
.sheet-page{
  background:#fff;border-radius:8px;
  box-shadow:0 2px 10px rgba(0,0,0,.12);
  margin-bottom:20px;overflow:hidden;
}
.sheet-header{
  display:flex;align-items:center;gap:8px;
  padding:8px 16px;background:#1a4a8a;color:#fff;
  font-size:11pt;font-weight:700;
}
.sheet-num{
  display:inline-flex;align-items:center;justify-content:center;
  width:22px;height:22px;background:rgba(255,255,255,.25);
  border-radius:50%;font-size:9pt;font-weight:800;flex-shrink:0;
}
.sheet-total{font-size:9pt;font-weight:400;opacity:.7;margin-left:4px;}

/* === fit-wrap: 테이블 스케일 컨테이너 === */
.fit-wrap{
  padding:8px;overflow:hidden;
  /* JS가 정확한 height 를 직접 주입 */
}
.fit-inner{
  display:inline-block;
  transform-origin:top left;
  /* JS가 transform:scale() 을 직접 주입 */
}

/* === 테이블 === */
table{border-collapse:collapse;}
th,td{
  border:1px solid #b0b8c4;padding:3px 7px;
  vertical-align:middle;white-space:nowrap;font-size:8.5pt;
}
th{background:#1e3a5f;color:#fff;font-weight:700;text-align:center;
   -webkit-print-color-adjust:exact;print-color-adjust:exact;}
td{background:#fff;text-align:left;}
td.num{text-align:right;font-variant-numeric:tabular-nums;}
tr:nth-child(even) td{background:#f5f7fa;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;}

/* =========================================
   인쇄 전용 스타일
   (화면 요소를 완전히 숨기고 테이블만 출력)
   ========================================= */
@media print{
  @page{size:A4 landscape;margin:8mm 6mm;}

  /* 툴바·배경 제거 */
  #toolbar{display:none!important;}
  body{background:#fff!important;padding-top:0!important;}
  .body-inner{padding:0!important;max-width:none!important;}

  /* 카드 스타일 제거 */
  .sheet-page{
    box-shadow:none!important;border-radius:0!important;
    margin-bottom:0!important;overflow:visible!important;
    /* 두 번째 시트부터 강제 페이지 나눔 */
  }
  .sheet-page + .sheet-page{page-break-before:always;}

  .sheet-header{
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
    padding:5px 10px!important;font-size:9pt!important;
  }
  .fit-wrap{padding:4px!important;}

  /* scale transform 은 JS beforeprint 에서 재계산 */
}
</style>
</head>
<body>
<div id="toolbar">
  <div class="t-info">
    <div class="t-title">📊 ${escHtmlEx(filename)}</div>
    <div class="t-sub">총 ${validSheets.length}개 시트 · 각 시트 1페이지 자동 맞춤 (A4 가로)</div>
  </div>
  <button onclick="window.print()">🖨️ 인쇄</button>
</div>
<div class="body-inner">
  ${sectionsHtml}
</div>
<script>
/* A4 landscape 인쇄 가능 영역 (96 dpi 기준)
   277mm × 190mm  →  약 1047px × 718px
   margin 8mm×2 = 16mm → 실제: ~1047px 가로, ~717px 세로
   헤더(32px) + fit-wrap padding(8px) 제외 → 콘텐츠 높이 ~677px */
var PRINT_W = 1047;   /* 가로 인쇄 가능 px */
var PRINT_H = 677;    /* 세로 인쇄 가능 px (헤더 제외) */

function calcScale(innerEl, maxW, maxH) {
  var tbl = innerEl.querySelector('table');
  if (!tbl) return 1;
  /* scale 초기화 후 실제 크기 측정 */
  innerEl.style.transform = 'scale(1)';
  var w = tbl.offsetWidth  || tbl.scrollWidth;
  var h = tbl.offsetHeight || tbl.scrollHeight;
  if (!w || !h) return 1;
  var s = Math.min(1, maxW / w, maxH / h);
  return Math.round(s * 10000) / 10000; /* 소수점 4자리 */
}

function applyFit(maxW, maxH) {
  var count = ${validSheets.length};
  for (var i=0; i<count; i++) {
    var wrap  = document.getElementById('fw'+i);
    var inner = document.getElementById('fi'+i);
    if (!wrap || !inner) continue;
    var s = calcScale(inner, maxW, maxH);
    inner.style.transform = 'scale('+s+')';
    /* wrap 높이 = 테이블 실제 높이 × scale (잘림 방지) */
    var tbl = inner.querySelector('table');
    if (tbl) {
      var h = (tbl.offsetHeight || tbl.scrollHeight) * s;
      wrap.style.height = Math.ceil(h + 10) + 'px';
    }
  }
}

/* 화면: 창 너비 기준 */
function fitScreen() {
  var bodyW = document.querySelector('.body-inner').offsetWidth;
  var maxW  = bodyW - 20;   /* fit-wrap padding 제외 */
  var maxH  = window.innerHeight * 0.85;
  applyFit(maxW, maxH);
}

/* 인쇄: A4 가로 고정 기준 */
function fitPrint() { applyFit(PRINT_W, PRINT_H); }

window.addEventListener('load', fitScreen);
window.addEventListener('resize', fitScreen);
window.addEventListener('beforeprint', fitPrint);
window.addEventListener('afterprint',  fitScreen);
<\/script>
</body>
</html>`);
  pw.document.close();
}

/* ── 블록 초기화 ── */
function clearExcelBlock(blockNum) {
  delete _excelWBCache[blockNum];

  const wrapEl  = document.getElementById(`excel-sheet-wrap-${blockNum}`);
  const fnEl    = document.getElementById(`excel-filename-${blockNum}`);
  const tabsEl  = document.getElementById(`excel-sheet-tabs-${blockNum}`);
  const dropEl  = document.getElementById(`excel-drop-${blockNum}`);
  const inputEl = document.getElementById(`excel-file-${blockNum}`);

  if (wrapEl)  wrapEl.innerHTML  = '';
  if (fnEl)  { fnEl.style.display = 'none'; fnEl.innerHTML = ''; }
  if (tabsEl){ tabsEl.style.display = 'none'; tabsEl.innerHTML = ''; }
  if (dropEl)  dropEl.style.display = 'flex';
  if (inputEl) inputEl.value = '';
}

/* ── 유틸리티 ── */
function escHtmlEx(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function _formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}
