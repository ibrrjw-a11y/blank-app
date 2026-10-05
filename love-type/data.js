// 연애 세포 테스트 (연애 동물 도감) 데이터. 문항·설명·학명은 모두 재미로 새로 지은 것.
// 세 축: 표현(D 직진 / S 은근), 속도(F 불꽃 / W 뭉근), 거리(C 껌딱지 / I 따로또같이)

export const AXES = [
  { a: "D", b: "S", name: "표현", la: "직진", lb: "은근" },
  { a: "F", b: "W", name: "속도", la: "불꽃", lb: "뭉근" },
  { a: "C", b: "I", name: "거리", la: "껌딱지", lb: "따로또같이" },
];

const o = (t, k, w = 1) => ({ t, s: { [k]: w } });

// 축마다 한 문항은 1.5점 (동점 방지)
export const QUESTIONS = [
  { ax: 0, q: "좋아하는 사람이 생기면 주변 반응은요?", options: [o("친구들이 먼저 알아채요. 티가 확 나요", "D"), o("아무도 몰라요. 들키면 당황해요", "S")] },
  { ax: 1, q: "처음 만난 날, 이 사람이다 싶은 느낌은요?", options: [o("몇 번은 더 만나 봐야 알아요", "W", 1.5), o("3초 만에 와요", "F", 1.5)] },
  { ax: 2, q: "연인과 보내는 이상적인 주말은요?", options: [o("토요일은 같이, 일요일은 각자 충전", "I", 1.5), o("이틀 내내 붙어 있어도 좋아요", "C", 1.5)] },
  { ax: 0, q: "마음을 전하는 방식은요?", options: [o("\"좋아해\" 네 글자를 직접 말해요", "D"), o("행동이랑 분위기로 알아채게 해요", "S")] },
  { ax: 1, q: "썸은 얼마나 타는 게 좋아요?", options: [o("2주면 충분, 짧고 굵게", "F"), o("계절 하나쯤은 천천히", "W")] },
  { ax: 2, q: "연인이 혼자 일주일 여행을 간대요.", options: [o("\"나도 같이 가면 안 돼?\"", "C"), o("잘 다녀와! 나도 그동안 할 거 많아요", "I")] },
  { ax: 0, q: "연인이 새 옷을 입고 나왔어요.", options: [o("사진을 몰래 찍어 두고 속으로 감탄해요", "S", 1.5), o("\"오 진짜 잘 어울린다!\" 바로 말해요", "D", 1.5)] },
  { ax: 1, q: "연애 초반 연락은요?", options: [o("하루 종일 대화창이 켜져 있어요", "F"), o("하루 몇 번이라도 꾸준한 게 좋아요", "W")] },
  { ax: 2, q: "연인이 세 시간째 조용해요.", options: [o("각자 바쁜 거죠. 나도 내 일 해요", "I"), o("뭐 하는지 궁금해서 먼저 연락해요", "C")] },
  { ax: 0, q: "서운한 일이 생기면요?", options: [o("그날 바로 말하고 풀어요", "D"), o("티는 나는데 말은 못 해요", "S")] },
  { ax: 1, q: "연애가 끝나고 나면요?", options: [o("한참 걸려요. 계절이 바뀌어야 괜찮아져요", "W"), o("크게 울고 금방 털어요", "F")] },
  { ax: 2, q: "연인의 친구 모임에 초대받았어요.", options: [o("좋아요! 다 같이 친해지고 싶어요", "C"), o("친구는 각자 만나는 게 편해요", "I")] },
];

// 8종. 순서 = 도감 번호
export const TYPES = [
  {
    key: "retriever", code: "DFC", plate: "I", name: "리트리버", latin: "Canis devotus",
    head: "꼬리부터 먼저 흔드는 직진형",
    desc: "좋아하는 마음을 숨기지 못하고, 숨길 생각도 없어요. 마음이 빨리 붙고, 붙으면 하루 종일 옆에 있고 싶어 해요. 연인의 기분 변화를 금방 알아채고 먼저 다가가요.",
    habitat: "연인의 퇴근길 마중 장소, 단골 산책로",
    food: "같이 걷기, 같이 먹기, 같이 아무거나",
    alarm: "읽고 답 없는 대화창",
    note: "만나면 반갑다고 세 번쯤 말한다.",
    best: "otter", worst: "cat",
  },
  {
    key: "cheetah", code: "DFI", plate: "II", name: "치타", latin: "Acinonyx subitus",
    head: "시작은 0초 만에, 거리는 확실하게",
    desc: "마음이 생기면 누구보다 빨리 움직이고 표현도 분명해요. 그런데 내 시간과 내 일도 똑같이 중요해서, 연애 중에도 각자의 영역을 지키고 싶어 해요.",
    habitat: "운동 끝난 저녁, 갑자기 잡은 당일치기 여행",
    food: "즉흥 데이트, 새로운 장소",
    alarm: "일정을 하나하나 묻는 연락",
    note: "고백 후 3초 안에 다음 약속을 잡는다.",
    best: "fox", worst: "hedgehog",
  },
  {
    key: "penguin", code: "DWC", plate: "III", name: "펭귄", latin: "Aptenodytes fidelis",
    head: "한 번 정하면 조약돌을 물어 오는 타입",
    desc: "마음이 생기기까지는 시간이 걸리지만, 정하고 나면 표현이 확실하고 오래 곁에 있어요. 작은 선물과 기념일을 잘 챙기고, 함께 만든 루틴을 소중히 여겨요.",
    habitat: "매주 가는 같은 식당, 둘만의 기념일 달력",
    food: "익숙한 장소에서 하는 긴 대화",
    alarm: "갑작스러운 계획 변경",
    note: "첫 데이트 장소를 1년 뒤에도 기억한다.",
    best: "hedgehog", worst: "fox",
  },
  {
    key: "wolf", code: "DWI", plate: "IV", name: "늑대", latin: "Canis lupus cautus",
    head: "신중하게 고르고, 고르면 분명하게",
    desc: "아무에게나 마음을 열지 않아요. 오래 지켜본 뒤에 확신이 서면 분명하게 말해요. 연애 중에도 각자 할 일을 존중하고, 필요할 때는 확실히 곁에 있어 줘요.",
    habitat: "조용한 바, 밤 산책",
    food: "말 많지 않아도 편한 시간",
    alarm: "확인되지 않은 소문, 과한 질투",
    note: "약속은 적게 하고 전부 지킨다.",
    best: "cat", worst: "otter",
  },
  {
    key: "otter", code: "SFC", plate: "V", name: "수달", latin: "Lutra manutenens",
    head: "잘 때도 손을 잡고 싶은 은근 껌딱지",
    desc: "말로 하는 고백은 쑥스럽지만 마음은 금방 깊어져요. 대신 행동이 다정해요. 맛있는 걸 보면 사 오고, 옆에 붙어 앉고, 손을 슬쩍 잡아요.",
    habitat: "소파 한가운데, 둘이 덮는 담요 속",
    food: "집 데이트, 같이 보는 예능",
    alarm: "\"오늘은 혼자 있고 싶어\"",
    note: "좋아한다는 말 대신 간식을 건넨다.",
    best: "retriever", worst: "wolf",
  },
  {
    key: "fox", code: "SFI", plate: "VI", name: "여우", latin: "Vulpes ludens",
    head: "다 들키는데 안 들킨 척하는 밀당 장인",
    desc: "마음이 빨리 생기지만 바로 보여 주진 않아요. 살짝 당기고 살짝 놓는 재미를 알고, 연애 중에도 자기 세계가 분명해요. 그래서 상대를 오래 궁금하게 만들어요.",
    habitat: "분위기 좋은 술집, 늦은 밤 메시지",
    food: "가벼운 장난, 예상 못 한 이벤트",
    alarm: "너무 빨리 정해지는 관계 이름",
    note: "답장을 5분 기다렸다 보낸다. 사실 바로 읽었다.",
    best: "cheetah", worst: "penguin",
  },
  {
    key: "hedgehog", code: "SWC", plate: "VII", name: "고슴도치", latin: "Erinaceus lentus",
    head: "가시를 내리는 데 오래 걸리지만, 내리면 말랑",
    desc: "처음엔 경계가 많아서 마음을 여는 데 시간이 걸려요. 표현도 서툴러요. 그런데 한 번 마음을 열면 누구보다 가까이 붙어 있고 싶어 해요.",
    habitat: "익숙한 동네 카페, 늘 앉는 창가 자리",
    food: "천천히 쌓이는 연락, 꾸준한 안부",
    alarm: "첫 만남부터 훅 들어오는 스킨십",
    note: "세 번째 만남에서야 웃는 얼굴을 보여 준다.",
    best: "penguin", worst: "cheetah",
  },
  {
    key: "cat", code: "SWI", plate: "VIII", name: "고양이", latin: "Felis secreta",
    head: "관심 없는 척, 사실 다 보고 있어요",
    desc: "천천히 마음을 열고, 말보다 곁에 머무는 걸로 표현해요. 혼자만의 시간이 꼭 필요하지만, 그 시간이 지나면 슬쩍 다가와 옆에 앉아요.",
    habitat: "볕 드는 창가, 각자 책 읽는 주말 오후",
    food: "조용히 같이 있는 시간",
    alarm: "\"우리 무슨 사이야?\" 재촉",
    note: "먼저 연락은 안 하지만 답장은 1분 안에 한다.",
    best: "wolf", worst: "retriever",
  },
];

export const typeByKey = (k) => TYPES.find((t) => t.key === k);
export const typeByCode = (c) => TYPES.find((t) => t.code === c);

export function relation(a, b) {
  if (a.key === b.key) return { label: "같은 종", note: "같은 습성을 가진 두 개체예요. 말 안 해도 통하는 게 많아요." };
  if (a.best === b.key || b.best === a.key) return { label: "공생 관계", note: "서로 없는 습성을 채워 주는 사이예요. 같이 있으면 둘 다 편해져요." };
  if (a.worst === b.key || b.worst === a.key) return { label: "천적 관계", note: "세 가지 습성이 모두 반대예요. 서로 이해하려면 통역이 조금 필요해요." };
  const same = [...a.code].filter((c, i) => c === b.code[i]).length;
  return same === 2
    ? { label: "가까운 친척", note: "세 습성 중 두 개가 같아요. 다른 하나만 서로 맞춰 주면 돼요." }
    : { label: "먼 친척", note: "세 습성 중 하나만 같아요. 서로 다른 부분이 재미가 되는 사이예요." };
}
