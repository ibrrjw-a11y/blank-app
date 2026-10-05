// 전체 카테고리와 도구 목록. 홈, 카테고리 페이지, 각 페이지 상단 경로·하단 추천이 모두 이 목록을 쓴다.
// path 는 루트 기준 폴더 경로 (끝에 / 없음). 기능 하나 = 페이지 하나.

export const CATEGORIES = [
  { id: "pick", path: "pick", name: "추첨·내기", short: "추첨", desc: "룰렛, 사다리타기, 제비뽑기, 팀 나누기", keyword: "룰렛 돌리기 · 사다리타기 · 제비뽑기" },
  { id: "test", path: "test", name: "심리테스트", short: "테스트", desc: "MBTI부터 연애·애착 유형까지", keyword: "심리테스트 · MBTI · 성격 유형" },
  { id: "fortune", path: "fortune", name: "운세·꿈해몽", short: "운세", desc: "대운 차트, 꿈 풀이, 손 없는 날", keyword: "사주 · 대운 · 꿈해몽" },
  { id: "game", path: "game", name: "미니게임", short: "게임", desc: "하루 3분 딴짓, 순발력 게임", keyword: "웹게임 · 데일리 퀴즈 · 반응속도" },
  { id: "calc", path: "calc", name: "생활 계산기", short: "계산기", desc: "실수령액, 만나이, 인생 진행률", keyword: "연봉 실수령액 · 만나이 계산기" },
  { id: "together", path: "together", name: "커플·친구", short: "같이", desc: "디데이, 이름궁합, 약속 장소", keyword: "커플 디데이 · 이름궁합 · 중간지점" },
];

export const TOOLS = [
  // 추첨·내기
  { path: "roulette", cat: "pick", name: "룰렛 돌리기", desc: "아슬아슬하게 멈추는 돌림판" },
  { path: "ladder", cat: "pick", name: "사다리타기", desc: "다리를 직접 긋는 사다리 게임" },
  { path: "gacha", cat: "pick", name: "제비뽑기", desc: "캡슐 뽑기 기계로 당첨자 뽑기" },
  { path: "team-split", cat: "pick", name: "팀 나누기", desc: "카드 섞어서 공평하게 조 편성" },
  { path: "who-pays", cat: "pick", name: "구슬 레이스", desc: "아이템으로 개입하는 벌칙 레이스" },
  { path: "who-pays/battle", cat: "pick", name: "배틀로얄 추첨", desc: "좁아지는 링에서 마지막 한 명" },
  { path: "who-pays/barrel", cat: "pick", name: "통아저씨", desc: "돌아가며 꽂는 해적 룰렛" },

  // 심리테스트
  { path: "others-mbti", cat: "test", name: "남이 정해주는 MBTI", desc: "친구 3명이 답하는 나의 MBTI" },
  { path: "teto-egen", cat: "test", name: "테토·에겐 테스트", desc: "테토력과 에겐력 비율 재기" },
  { path: "attachment", cat: "test", name: "애착 유형 테스트", desc: "연애할 때 나의 애착 스타일" },
  { path: "love-type", cat: "test", name: "연애 세포 테스트", desc: "연애할 때 나는 어떤 동물?" },
  { path: "kkondae", cat: "test", name: "꼰대력 테스트", desc: "나도 모르게 쌓인 꼰대 지수" },

  // 운세·꿈해몽
  { path: "life-stock", cat: "fortune", name: "나 상장하기", desc: "사주 대운을 주가 차트로" },
  { path: "dream-saju", cat: "fortune", name: "꿈 사주", desc: "4칸으로 끝내는 꿈해몽" },

  // 미니게임
  { path: "ddanjit", cat: "game", name: "딴짓 오락실", desc: "오늘의 데일리 게임 4종 모음" },
  { path: "ddanjit/zoom", cat: "game", name: "줌아웃 퀴즈", desc: "확대된 그림 맞히기" },
  { path: "ddanjit/town", cat: "game", name: "오늘의 동네", desc: "거리·방향 힌트로 시군구 맞히기" },
  { path: "ddanjit/price", cat: "game", name: "그때 그 가격", desc: "옛날 물가 맞히기" },
  { path: "ddanjit/timeline", cat: "game", name: "추억 연대기", desc: "출시 연도 순서 맞히기" },
  { path: "one-to-fifty", cat: "game", name: "1 to 50", desc: "숫자 순서대로 빨리 누르기" },
  { path: "stack-tower", cat: "game", name: "탑 쌓기", desc: "타이밍 맞춰 블록 쌓기" },
  { path: "merge-2048", cat: "game", name: "2048", desc: "숫자 합치기 퍼즐" },
  { path: "brain-age", cat: "game", name: "뇌 나이 측정소", desc: "미니게임 5개로 재는 뇌 나이" },

  // 생활 계산기
  { path: "salary-live/net-pay", cat: "calc", name: "연봉 실수령액 계산기", desc: "2026년 4대보험·세금 반영" },
  { path: "salary-live", cat: "calc", name: "실시간 월급 카운터", desc: "지금 이 순간 버는 돈" },
  { path: "life-progress/age", cat: "calc", name: "만나이 계산기", desc: "만 나이·연 나이·살아온 날" },
  { path: "life-progress", cat: "calc", name: "인생 진행률", desc: "내 인생을 4,000칸으로" },

  // 커플·친구
  { path: "couple-dday", cat: "together", name: "커플 디데이", desc: "100일·1주년 계산과 오늘의 질문" },
  { path: "name-match", cat: "together", name: "단톡방 궁합표", desc: "이름 N명 전원 이름궁합" },
  { path: "where-to-go", cat: "together", name: "어디가?", desc: "메뉴·장소 월드컵과 중간지점" },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id);
export const toolByPath = (p) => TOOLS.find((t) => t.path === p);

// 예전 코드 호환용 (사이트별 하단 링크). 새 코드는 TOOLS 를 쓴다.
export const SITES = TOOLS.map((t) => ({ slug: t.path, name: t.name, desc: t.desc, keyword: categoryById(t.cat).name }));
