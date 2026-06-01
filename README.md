# 강서청소년회관 전체회의 자료 자동화 시스템

> 강서청소년회관 전체회의 자료를 자동 생성·관리하는 순수 정적 웹앱 (HTML/CSS/JS)

---

## ✅ 현재 구현된 기능

### 🏗️ 7단계 위자드 UI
| 단계 | 키 | 내용 |
|------|-----|------|
| 1 | `info` | 기본 정보 입력 (연도·월·일시·장소), 안건 편집 (드래그 순서변경·추가·삭제·고정항목) |
| 2 | `dozan` | 도산의 말씀 입력·실시간 미리보기 |
| 3 | `team-0` | 운영지원팀 보고 (담당자 추가·삭제·접기, 전월/당월 프로그램 입력) |
| 4 | `team-1` | 교육·홍보팀 보고 |
| 5 | `team-2` | 청소년사업팀 보고 |
| 6 | `etc` | 기타 공지·생일자 관리 |
| 7 | `summary` | **팀별 집계 시트** — 기타 공지·생일 이후 마지막에 전월/당월 청소년·성인·지도자 자동 집계표 |

### 📋 프로그램 모달 (최신 구조)
- **프로그램명** 입력
- **하위 항목(세부 내용)** : 항목별로 개별 **일자·시간·장소·청소년·성인·지도자** 입력
  - 세부항목에 인원 입력 시 → **자동합산 모드** (modal 인원 입력 비활성화, 중복 방지)
- **전체 일시·시간·장소** : 프로그램 전체 일정 (3-col 그리드)
- **대상/인원** : 청소년(명) + 성인(명) + 지도자(명) 자동합계
- **비고/특이사항** 입력

### 📊 실적 통계 페이지
- **상단 4-카드** : 총 청소년 / 총 성인 / 총 지도자 / 전체 합계
  - 각 카드 하단에 **전월 N명 / 당월 N명** 소계 뱃지 표시
- **전월/당월 구분 바** : 전월 합계 칩 + 당월 합계 칩 (청소년·성인·지도자·합계)
- **팀별 블록** : 팀 소계 + 프로그램별 표
  - **전월 활동 보고** 그룹 행 (orange) → 프로그램 행들 → 전월 소계 행
  - **당월 활동 계획** 그룹 행 (green) → 프로그램 행들 → 당월 소계 행
  - **팀 합계** 소계 행
- 하위 항목 들여쓰기 표시 (일자·시간·장소·인원)
- 새로고침 버튼으로 최신 데이터 반영

### 👥 참가자 3원 분류
| 구분 | 색상 | 아이콘 |
|------|------|--------|
| 청소년 | 파랑 (primary) | `fa-child` |
| 성인 | 초록 (green) | `fa-person` |
| 지도자 | 보라 (purple) | `fa-chalkboard-user` |

### 🔧 기타
- 사이드바 팀 탭 **드래그·드롭** 순서 변경
- 연도/월 선택 시 **전월·당월 라벨** 자동 갱신
- **LocalStorage** 자동저장 (임시저장) + 이력 저장/불러오기
- **미리보기** 문서 생성 + 인쇄 기능
- 회의 이력 관리 (저장·불러오기·삭제)

---

## 🗂️ 파일 구조

```
index.html          — 메인 페이지 (7단계 위자드 + 통계 페이지 + 모달)
css/
  style.css         — 전체 스타일
js/
  data.js           — appState, TEAMS, genId(), 초기 데이터
  app.js            — 모든 UI 로직·렌더링 함수
```

---

## 📐 데이터 모델

### appState (전역 단일 소스)
```js
appState = {
  currentStep: 'info',            // 현재 단계 키
  completedSteps: Set,            // 완료된 단계 집합
  agenda: [ { text, fixed } ],   // 안건 목록
  teamOrder: [0,1,2],             // 팀 표시 순서
  programs: {
    0: [ MemberObj, ... ],        // 운영지원팀 담당자 배열
    1: [ MemberObj, ... ],        // 교육·홍보팀
    2: [ MemberObj, ... ]         // 청소년사업팀
  },
  notices:   [ string ],
  birthdays: [ { name, date } ],
  dozan:     { content, source },
  modal:     { teamIdx, mIdx, type, editIdx }
}
```

### MemberObj
```js
{
  id:    string,   // genId()
  name:  string,
  title: string,
  prev:  [ ProgramObj ],   // 전월 활동 보고
  next:  [ ProgramObj ]    // 당월 활동 계획
}
```

### ProgramObj (최신 구조)
```js
{
  name:   string,          // 프로그램명
  subs:   [ SubItem ],     // 하위 항목
  dates:  string,          // 전체 일시
  time:   string,          // 전체 시간
  place:  string,          // 장소
  youth:  number,          // 청소년 인원
  adult:  number,          // 성인 인원
  leader: number,          // 지도자 인원
  notes:  string           // 비고
}
```

### SubItem (최신 구조)
```js
{
  text:   string,   // 세부 항목명
  date:   string,   // 개별 일자
  time:   string,   // 개별 시간
  place:  string,   // 개별 장소
  youth:  number,   // 청소년 수
  adult:  number,   // 성인 수
  leader: number    // 지도자 수
}
```

---

## 🔑 주요 함수 목록

| 함수 | 역할 |
|------|------|
| `showPage(name)` | 페이지 전환 (input/history/preview/stats) |
| `goStep(key)` | 위자드 단계 이동 |
| `getStepSequence()` | teamOrder 기반 7단계 배열 반환 |
| `renderMemberList(teamIdx)` | 팀의 담당자 카드 전체 렌더 |
| `buildMemberCard()` | 담당자 카드 DOM 생성 |
| `openProgramModal()` | 프로그램 추가/수정 모달 오픈 |
| `confirmProgram()` | 모달 확인 → 데이터 저장 |
| `addSubItemWithValue(s)` | 하위 항목 행 추가 (date/time/place/youth/adult/leader) |
| `calcTotal()` | 인원 합계 자동 표시 + 자동합산 모드 전환 |
| `buildProgramCardHtml()` | 프로그램 카드 HTML 생성 |
| `buildTeamStatsSections(prev,curr)` | 전월/당월 구분 집계 테이블 공통 빌더 |
| `renderStats()` | 실적 통계 페이지 렌더링 (전월/당월 구분 포함) |
| `renderTeamSummary()` | 위자드 6단계 팀별 집계 시트 렌더링 |
| `buildDocProgram()` | 미리보기 문서 내 프로그램 HTML |
| `generatePreview()` | 전체 회의자료 미리보기 생성 |
| `renderTeamStepTabs()` | 사이드바 팀 탭 드래그 렌더 |
| `updateMonthLabels()` | 전월/당월 라벨 일괄 갱신 |
| `collectData()` / `restoreData()` | 데이터 수집/복원 |
| `autoSave()` / `saveMeeting()` | 자동저장 / 이력 저장 |

---

## 🔗 진입 URL

| 경로 | 설명 |
|------|------|
| `/index.html` | 메인 (자료 입력 탭이 기본) |
| `/index.html` → 실적 통계 탭 | 팀별 전월/당월 구분 인원 통계 |

---

## ⚠️ 주의 / 구버전 호환

- `participants` / `result` 필드는 제거됨 (구버전 저장 데이터에서 `participants` 폴백 처리)
- `subs[]`의 구버전 string 형식도 미리보기에서 안전하게 처리
- localStorage 키: `kgyc_draft` (임시저장), `kgyc_history` (이력)

---

## 🚀 배포

**Publish 탭**에서 원클릭 배포 후 라이브 URL 확인 가능.

---

*최종 업데이트: 2026-06-01*
