// 전체 카테고리와 도구 목록. 홈, 카테고리 페이지, 각 페이지 상단 경로·하단 추천이 모두 이 목록을 쓴다.
// path 는 루트 기준 폴더 경로 (끝에 / 없음). 기능 하나 = 페이지 하나.
// Guess What 통합(2026-10-06): 1 to 50 · 탑 쌓기 · 2048 · 만나이 계산기는 컨셉과 멀어 목록에서 뺌(폴더는 남김).

export const CATEGORIES = [
  { id: "pick", path: "pick", name: "추첨·내기", short: "추첨", desc: "룰렛, 사다리타기, 제비뽑기, 팀 나누기", keyword: "룰렛 돌리기 · 사다리타기 · 제비뽑기" },
  { id: "test", path: "test", name: "심리테스트", short: "테스트", desc: "MBTI부터 연애·애착 유형까지", keyword: "심리테스트 · MBTI · 성격 유형" },
  { id: "fortune", path: "fortune", name: "운세·꿈해몽", short: "운세", desc: "대운 차트, 꿈 풀이, 손 없는 날", keyword: "사주 · 대운 · 꿈해몽" },
  { id: "game", path: "game", name: "미니게임", short: "게임", desc: "하루 3분 딴짓, 순발력 게임", keyword: "웹게임 · 데일리 퀴즈 · 반응속도" },
  { id: "calc", path: "calc", name: "생활 계산기", short: "계산기", desc: "실수령액, 만나이, 인생 진행률", keyword: "연봉 실수령액 · 만나이 계산기" },
  { id: "together", path: "together", name: "커플·친구", short: "같이", desc: "이름궁합, 약속 장소·메뉴 정하기", keyword: "이름궁합 · 중간지점 · 점심메뉴" },
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
  { path: "who-pays/balloon", cat: "pick", name: "풍선 터뜨리기", desc: "모두의 풍선이 동시에, 먼저 터지면 당첨" },
  { path: "who-pays/duck", cat: "pick", name: "오리 레이스", desc: "물살·소용돌이에 순위가 계속 바뀌는 고무오리" },
  { path: "who-pays/dodge", cat: "pick", name: "똥 피하기", desc: "쏟아지는 똥, 먼저 맞으면 당첨" },
  { path: "who-pays/bomb", cat: "pick", name: "폭탄 돌리기", desc: "언제 터질지 모르는 폭탄 넘기기" },
  { path: "random/winner", cat: "pick", name: "당첨자 추첨기", desc: "명단 붙여 넣고 N명, 예비 당첨까지" },
  { path: "random/number", cat: "pick", name: "번호 추첨기", desc: "범위·개수·뺄 번호 정하고 랜덤 번호" },
  { path: "random", cat: "pick", name: "랜덤 추첨기 모음", desc: "상황에 맞는 추첨 14가지" },

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
  { path: "daily", cat: "game", name: "오늘의 Guess", desc: "그림·동네·가격·연도·비율 하루 5문제" },
  { path: "eorim", cat: "game", name: "어림짐작", desc: "정답 대신 범위로 맞히는 상식 퀴즈" },
  { path: "apple", cat: "game", name: "사과 게임", desc: "합이 10이 되게 묶는 2분 게임" },
  { path: "baseball", cat: "game", name: "숫자 야구", desc: "숫자 세 개를 9회 안에 맞히기" },
  { path: "mole", cat: "game", name: "규칙 두더지", desc: "10초마다 규칙이 바뀌는 두더지 잡기" },
  { path: "word-baseball", cat: "game", name: "단어 야구", desc: "두 글자 단어를 자음·모음 S·B로 맞히기" },
  { path: "timber", cat: "game", name: "나무꾼", desc: "가지 피해서 도끼질, 점점 빨라짐" },
  { path: "tiles", cat: "game", name: "검은 건반", desc: "검은 칸만 차례로, 누를수록 빨라짐" },
  { path: "knife", cat: "game", name: "칼 꽂기", desc: "돌아가는 통나무에 칼 던지기" },
  { path: "flappy", cat: "game", name: "날개 퍼덕", desc: "기둥 틈 지나가기, 갈수록 좁아짐" },
  { path: "stick", cat: "game", name: "막대 다리", desc: "막대 늘려서 딱 맞게 건너기" },
  { path: "bricks", cat: "game", name: "벽돌깨기", desc: "공 하나로, 칠수록 빨라짐" },
  { path: "merge-2048", cat: "game", name: "2048", desc: "나무 타일 숫자 합치기" },
  { path: "one-to-fifty", cat: "game", name: "1 to 50", desc: "1부터 50까지 순서대로 누르기" },
  { path: "stack-tower", cat: "game", name: "탑 쌓기", desc: "크레인 블록, 몇 층까지" },
  { path: "ddanjit", cat: "game", name: "딴짓 오락실", desc: "오늘의 데일리 게임 4종 모음" },
  { path: "ddanjit/zoom", cat: "game", name: "줌아웃 퀴즈", desc: "확대된 그림 맞히기" },
  { path: "ddanjit/town", cat: "game", name: "오늘의 동네", desc: "거리·방향 힌트로 시군구 맞히기" },
  { path: "ddanjit/price", cat: "game", name: "그때 그 가격", desc: "옛날 물가 맞히기" },
  { path: "ddanjit/timeline", cat: "game", name: "추억 연대기", desc: "출시 연도 순서 맞히기" },
  { path: "brain-age", cat: "game", name: "뇌 나이 측정소", desc: "미니게임 5개로 재는 뇌 나이" },
  { path: "brain-age/reaction", cat: "game", name: "반응속도 테스트", desc: "초록불에 탭, 밀리초까지" },
  { path: "brain-age/memory", cat: "game", name: "순간기억력 테스트", desc: "불 들어온 순서 따라 누르기" },
  { path: "brain-age/color", cat: "game", name: "색감 테스트", desc: "색이 다른 칸 하나 찾기" },
  { path: "brain-age/hearing", cat: "game", name: "고주파 청력 테스트", desc: "몇 Hz까지 들리나" },
  { path: "brain-age/mental-math", cat: "game", name: "암산 테스트", desc: "30초 동안 몇 문제" },
  { path: "brain-age/dynamic-vision", cat: "game", name: "동체시력 테스트", desc: "휙 지나간 숫자 맞히기" },

  // 생활 계산기
  { path: "salary-live/net-pay", cat: "calc", name: "연봉 실수령액 계산기", desc: "2026년 4대보험·세금 반영" },
  { path: "salary-live", cat: "calc", name: "실시간 월급 카운터", desc: "지금 이 순간 버는 돈" },
  { path: "life-progress", cat: "calc", name: "인생 진행률", desc: "내 인생을 4,000칸으로" },
  { path: "calc/weekly-holiday", cat: "calc", name: "주휴수당 계산기", desc: "시급·주 시간으로 주휴수당, 먼저 짐작" },
  { path: "calc/hourly-monthly", cat: "calc", name: "시급 → 월급 계산기", desc: "주휴 포함 월급 + 최저임금 비교" },
  { path: "calc/annual-leave", cat: "calc", name: "연차 계산기", desc: "입사일로 내 연차 며칠" },
  { path: "calc/vat", cat: "calc", name: "부가세 계산기", desc: "가격 속 숨은 부가세 10%" },
  { path: "calc/savings", cat: "calc", name: "예금·적금 이자 계산기", desc: "세금 떼고 받는 이자·만기 금액" },
  { path: "calc/loan", cat: "calc", name: "대출 이자 계산기", desc: "갚는 방식별 총이자 비교" },
  { path: "calc/severance", cat: "calc", name: "퇴직금 계산기", desc: "평균임금 30일분 × 근속연수" },
  { path: "calc/unemployment", cat: "calc", name: "실업급여 계산기", desc: "하루 얼마·며칠·총액" },
  { path: "calc/parental-leave", cat: "calc", name: "육아휴직 급여 계산기", desc: "달마다 상한, 총 얼마" },
  { path: "calc/jeonse-monthly", cat: "calc", name: "전세 vs 월세 계산기", desc: "한 달 실제 비용 비교" },
  { path: "calc/gift-tax", cat: "calc", name: "증여세 계산기", desc: "가족끼리 세금 없이 얼마까지" },
  { path: "calc/insta-engagement", cat: "calc", name: "인스타 참여율 계산기", desc: "좋아요·댓글 ÷ 팔로워" },

  // 커플·친구
  { path: "name-match", cat: "together", name: "단톡방 궁합표", desc: "이름 N명 전원 이름궁합" },
  { path: "group-saju", cat: "together", name: "우리 모임 사주", desc: "친구들 특징과 모임 궁합을 생일로" },
  { path: "where-to-go", cat: "together", name: "어디가?", desc: "메뉴·장소 월드컵과 중간지점" },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id);
export const toolByPath = (p) => TOOLS.find((t) => t.path === p);

// 예전 코드 호환용 (사이트별 하단 링크). 새 코드는 TOOLS 를 쓴다.
export const SITES = TOOLS.map((t) => ({ slug: t.path, name: t.name, desc: t.desc, keyword: categoryById(t.cat).name }));
