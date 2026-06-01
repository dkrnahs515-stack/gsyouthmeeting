/* ============================================
   기본 데이터 (도산 말씀 풀, 팀 정보, 프로그램 템플릿)
   ============================================ */

const DOZAN_PRESETS = [
  {
    label: "지도자의 자격",
    text: '"지도자의 자격은 협동에 앞선자이다"\n\n오늘에 지도자의 자격이 없다고 말하는 사람은\n아직도 그 지도자가 무엇인지를 모르는 때문인가 합니다.\n\n지도자의 자격을 무엇으로 판정하는가\n어떠한 협동이든지 그 협동 중에 앞선 사람은\n곧 지도자의 자격을 가진 자외다.',
    source: '도산 안창호 선생이 1924년 중국 북경에서 구술한 글, 「동광(東光)」잡지 1926년 8월호 수록 (「안도산전서」, 526쪽)'
  },
  {
    label: "나를 사랑하는 자",
    text: '"나를 사랑하거든 나를 따르지 말고 나와 함께 일하라"',
    source: '도산 안창호'
  },
  {
    label: "거짓 없는 삶",
    text: '"거짓말을 하지 말자. 이것이 우리 민족의 고질이다.\n나는 일생을 통하여 이것과 싸우기로 했다."',
    source: '도산 안창호'
  },
  {
    label: "힘을 기르자",
    text: '"우리가 힘이 없어서 나라를 잃었으니 힘을 기르자.\n교육, 실업, 단결, 이 세 가지가 우리의 살 길이다."',
    source: '도산 안창호'
  },
  {
    label: "낙망하지 말자",
    text: '"낙망은 청년의 죽음이요, 청년이 낙망하면 그 나라는 쇠하고 마느니라.\n청년은 기상이 있어야 한다."',
    source: '도산 안창호'
  }
];

/* 팀 기본 정보 */
const TEAMS = [
  { id: 0, name: '운영지원팀',    icon: 'fas fa-users-gear',          color: '#2a67c0', colorClass: 'team-ops'   },
  { id: 1, name: '교육·홍보팀',   icon: 'fas fa-chalkboard-teacher',  color: '#2e8a57', colorClass: 'team-edu'   },
  { id: 2, name: '청소년사업팀',  icon: 'fas fa-child-reaching',       color: '#7c3aed', colorClass: 'team-youth' }
];

/*
  programs 구조 (팀별 담당자 배열):
  {
    0: [  ← 팀 인덱스
      {
        id: 'uuid',
        name: '홍길동',
        title: '주임',
        prev: [ { name, subs, dates, time, participants, result, notes }, ... ],
        next: [ ... ]
      },
      ...
    ],
    1: [...],
    2: [...]
  }
*/

/* 앱 전역 상태 */
let appState = {
  currentStep:    'info',
  completedSteps: new Set(),
  teamOrder:      [0, 1, 2],
  agenda:         [],
  programs: {        // 팀별 담당자 배열
    0: [],
    1: [],
    2: []
  },
  notices:   [],
  birthdays: [],
  modal: {
    teamIdx:    null,
    memberIdx:  null,
    type:       null,   // 'prev' | 'next'
    editIdx:    null
  }
};

/* 고유 ID 생성 */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
