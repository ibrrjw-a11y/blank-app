/*
  IBR 브랜드·제품 데이터 — 홈페이지의 브랜드 목록과 제품 페이지가 모두 이 파일 하나를 읽습니다.

  ■ 제품 고치는 법
    { b: "브랜드 id", n: "제품명", cat: "분류", form: "그림 모양", opts: [["용량", 소비자가], ...] }
    - 가격은 소비자가(숫자, 원). 아직 모르면 null → 화면에 "소비자가 준비 중"으로 나옵니다.
    - 용량이 여러 개면 opts 에 줄을 더 넣으면 됩니다. 첫 줄이 기본으로 보입니다.
    - 향·컬러처럼 가격이 같은 종류는 vars 에 적습니다.
    - 사진이 있으면 img 에 경로를 적습니다. 없으면 form 모양으로 라벨 그림을 그립니다.
    - 나중에 상세페이지가 생기면 url: "상세페이지 주소" 를 넣으면 카드가 그 페이지로 연결됩니다.
    - 제품을 빼려면 해당 줄을 지우면 됩니다.

  ■ 분류(cat): hair 헤어 · body 바디 · skin 스킨 · food 푸드 · health 헬스 · pet 펫 · living 리빙
  ■ 그림 모양(form): oil pump tube jar honey stick box bar bottle spray pouch towel pack chair cabinet glass scale

  출처: 단품별 가격 시트(소비자가 열), 2026년 3월 IR 자료, 2025년 회사소개서
*/
window.IBR_CATS = {
  hair: "헤어", body: "바디", skin: "스킨", food: "푸드", health: "헬스", pet: "펫", living: "리빙"
};

window.IBR_BRANDS = [
  /* ── 자사 브랜드 ─────────────────────────────── */
  { id: "arvo", ko: "에이르보", en: "Árvo", group: "own", origin: "KR", cat: ["hair"], mark: "serif",
    tint: "#E7E2D6", ink: "#2B2A24",
    line: "나무를 매개로 찾은 나만의 리듬. 전문 헤어 살롱에서 시작해 올리브영까지 넓힌 퍼퓸 헤어케어." },
  { id: "choolip", ko: "츌립", en: "CHOOLIP", group: "own", origin: "US", cat: ["pet"], mark: "round",
    tint: "#F3D9DF", ink: "#7A1E3A",
    line: "수의사가 설계한 북미 프리미엄 펫푸드. 출시 3개월 만에 Amazon's Choice, SuperZoo 신제품 어워드." },
  { id: "myvef", ko: "마이베프", en: "myvef", group: "own", origin: "KR", cat: ["pet"], mark: "round",
    tint: "#DCE6F2", ink: "#1E3F6E",
    line: "수의사가 만든 건강 영양 간식. 홍콩·대만·싱가포르·일본으로 수출하는 반려동물 간식 브랜드." },
  { id: "denoah", ko: "드노아", en: "de noah", group: "own", origin: "KR", cat: ["skin"], mark: "serif",
    tint: "#EDE6E1", ink: "#4D3B33",
    line: "피부 전문의와 함께 개발한 재생·진정 스킨케어. 나를 채우는 아름다운 휴식." },
  { id: "drdaniel", ko: "닥터다니엘", en: "Dr. Daniel", group: "own", origin: "KR", cat: ["health"], mark: "serif",
    tint: "#E3E8EC", ink: "#1F2D3A",
    line: "세계적인 원료와 독자 포뮬러로 만든 건강기능식품. 건강한 일상을 위해." },
  { id: "chungdam", ko: "청담뉴트리션", en: "CHUNGDAM NUTRITION", group: "own", origin: "KR", cat: ["health", "food"], mark: "caps",
    tint: "#E4ECE6", ink: "#20402F",
    line: "청담동에서 시작한 건강기능식품. 이학박사가 직접 개발한 포뮬러로 순수함을 담았습니다." },
  { id: "zeroguide", ko: "제로가이드", en: "ZERO GUIDE", group: "own", origin: "KR", cat: ["health", "hair"], mark: "heavy",
    tint: "#E6E6E6", ink: "#111111",
    line: "콤플렉스를 Zero로. 구강 유산균, 코골이 방지 스프레이처럼 개인의 고민을 푸는 카테고리 1위 제품." },
  { id: "marybee", ko: "메리비", en: "Mary B.", group: "own", origin: "AU", cat: ["food"], mark: "script",
    tint: "#F2E3C4", ink: "#5B3A0A",
    line: "호주 최대 마누카꿀 제조사 하이브웰니스와 공동 소유한 브랜드. 세계 최초 마누카 허니콤." },
  { id: "kimguksan", ko: "김국산", en: "KIM GUKSAN", group: "own", origin: "KR", cat: ["living"], mark: "caps",
    tint: "#E9E3E3", ink: "#3B2525",
    line: "100% 한국산 위생·생활용품 브랜드." },
  { id: "ooha", ko: "OOHA", en: "OOHA", group: "own", origin: "KR", cat: ["skin"], mark: "heavy",
    tint: "#E9E1F0", ink: "#3E2457",
    line: "한국·동남아·일본에 동시 출시한 저자극 컬러 콘택트렌즈. 일본 Qoo10 렌즈 카테고리 1위." },

  /* ── 글로벌 소싱 · 독점 유통 ──────────────────── */
  { id: "attiki", ko: "아티키", en: "Attiki", group: "global", origin: "GR", cat: ["food"], mark: "serif",
    tint: "#DCE4EE", ink: "#183766",
    line: "그리스 No.1 꿀. 한국·일본·대만 브랜드 독점, 홈쇼핑 22회 연속 매진." },
  { id: "botanist", ko: "보타니스트", en: "BOTANIST", group: "global", origin: "JP", cat: ["hair", "body"], mark: "caps",
    tint: "#E6EBDF", ink: "#2E3B22",
    line: "식물 유래 성분으로 만든 일본 헤어·바디케어." },
  { id: "lamaison", ko: "라 메종 뒤 미엘", en: "La Maison du Miel", group: "global", origin: "FR", cat: ["food"], mark: "serif",
    tint: "#EFE6D0", ink: "#4A3510",
    line: "1898년 파리에서 시작한 꿀 전문 브랜드. 단일 꽃꿀부터 다화꿀까지 폭넓게 선보입니다." },
  { id: "bronnley", ko: "브론리", en: "Bronnley", group: "global", origin: "UK", cat: ["body"], mark: "serif",
    tint: "#F4ECC4", ink: "#4D4410",
    line: "영국 정통 솝·바디케어. 레몬 라인으로 사랑받는 브랜드." },
  { id: "airborne", ko: "에어본", en: "Airborne", group: "global", origin: "NZ", cat: ["food"], mark: "caps",
    tint: "#E8E2D5", ink: "#3A2F1A",
    line: "뉴질랜드 꿀. 너도밤나무 숲의 허니듀 허니." },
  { id: "harker", ko: "하커허벌", en: "Harker Herbals", group: "global", origin: "NZ", cat: ["health"], mark: "serif",
    tint: "#E1EBE4", ink: "#1E4430",
    line: "뉴질랜드 허벌 브랜드. 마누카 꿀을 담은 목 케어." },
  { id: "magis", ko: "마지스", en: "MAGIS", group: "global", origin: "IT", cat: ["living"], mark: "heavy",
    tint: "#E8E8E3", ink: "#1A1A1A",
    line: "이탈리아 디자인 가구. 세계적인 디자이너와 만든 의자와 수납." },
  { id: "driade", ko: "드리아데", en: "Driade", group: "global", origin: "IT", cat: ["living"], mark: "serif",
    tint: "#EFE7DD", ink: "#3D2C1C",
    line: "예술적인 가구를 만드는 이탈리아 디자인 회사." },
  { id: "kvetna", ko: "크베트나", en: "Květná", group: "global", origin: "CZ", cat: ["living"], mark: "serif",
    tint: "#E2E9EE", ink: "#20323E",
    line: "체코 핸드메이드 글라스. 컬러 와인잔 아우리가 컬렉션." },
  { id: "sahale", ko: "사할리 스낵", en: "Sahale Snacks", group: "global", origin: "US", cat: ["food"], mark: "caps",
    tint: "#F1E2D3", ink: "#5A2E10",
    line: "미국 시애틀에서 온 견과 스낵. 과일과 향신료를 더한 글레이즈드 넛." },
  { id: "freshmac", ko: "프레시맥", en: "Freshmac", group: "global", origin: "AU", cat: ["food"], mark: "caps",
    tint: "#EDE4D2", ink: "#4A3618",
    line: "호주산 껍질째 마카다미아." },
  { id: "salonia", ko: "살로니아", en: "SALONIA", group: "global", origin: "JP", cat: ["hair"], mark: "caps",
    line: "살롱급 결과를 집에서. 일본 헤어 스타일링 기기 브랜드." },
  { id: "yolu", ko: "요루", en: "YOLU", group: "global", origin: "JP", cat: ["hair"], mark: "caps",
    line: "자는 동안 모발을 케어하는 일본 나이트 헤어케어." },
  { id: "nutworks", ko: "넛웍스", en: "Nutworks", group: "global", origin: "AU", cat: ["food"], mark: "caps",
    line: "호주 마카다미아 전문 가공·공급 회사." },
  { id: "hefel", ko: "헤펠", en: "Hefel", group: "global", origin: "AT", cat: ["living"], mark: "caps",
    line: "오스트리아 프리미엄 침구." },
  { id: "wedderspoon", ko: "웨더스푼", en: "Wedderspoon", group: "global", origin: "NZ", cat: ["food"], mark: "serif",
    line: "뉴질랜드 마누카 허니." },

  /* ── 유통 브랜드 ─────────────────────────────── */
  { id: "yuhan", ko: "유한양행", en: "Yuhan", group: "dist", origin: "KR", cat: ["health"], mark: "caps",
    tint: "#E1E8EF", ink: "#173452",
    line: "제품 컨셉 개발부터 마케팅·유통까지 IBR이 독점 대행한 당큐락. 누적 매출 400억 원." },
  { id: "claraco", ko: "클라라앤코", en: "Clara & Co.", group: "dist", origin: "KR", cat: ["health"], mark: "serif",
    tint: "#F2E1E4", ink: "#5A2330",
    line: "먹는 뷰티 콜라겐." },
  { id: "oat", ko: "오트", en: "OAT", group: "dist", origin: "", cat: ["food"], mark: "caps",
    tint: "#EEE7DA", ink: "#4A3A1E",
    line: "간편하게 바르는 스프레드." },
  { id: "atply", ko: "앳플리", en: "atply", group: "dist", origin: "", cat: ["living"], mark: "round",
    tint: "#E3E7EA", ink: "#24303A",
    line: "스마트 헬스 디바이스." }
];

window.IBR_PRODUCTS = [
  /* 에이르보 */
  { b: "arvo", n: "07 플로럴 선샤인 헤어오일", cat: "hair", form: "oil", img: "assets/img/products/arvo-07-oil.webp", top: 1,
    opts: [["100ml", 30000], ["50ml", 17000], ["20ml", 10000]] },
  { b: "arvo", n: "10 블룸 오브 샤론 헤어오일", cat: "hair", form: "oil", img: "assets/img/products/arvo-10-oil.webp", top: 1,
    opts: [["100ml", 30000], ["50ml", 17000], ["20ml", 10000]] },
  { b: "arvo", n: "11 포레스트 포그 헤어오일", cat: "hair", form: "oil", img: "assets/img/products/arvo-11-oil.webp", top: 1,
    opts: [["50ml", 17000], ["20ml", 10000]] },
  { b: "arvo", n: "10 블룸 오브 샤론 리페어 샴푸", cat: "hair", form: "pump", img: "assets/img/products/arvo-10-shampoo.webp", opts: [["500ml", 30000]] },
  { b: "arvo", n: "10 블룸 오브 샤론 리페어 헤어마스크", cat: "hair", form: "tube", img: "assets/img/products/arvo-10-mask.webp", opts: [["200g", 30000]] },
  { b: "arvo", n: "10 스칼프 샴푸", cat: "hair", form: "pump", img: "assets/img/products/arvo-scalp-1000.webp", opts: [["1,000ml", 45000]] },
  { b: "arvo", n: "01 클렌즈 샴푸", cat: "hair", form: "pump", opts: [["1,000ml", 79000]] },
  { b: "arvo", n: "피톤포레 너리싱 샴푸", cat: "hair", form: "pump", img: "assets/img/products/arvo-phyton.webp", opts: [["500ml", 30000]] },
  { b: "arvo", n: "05 딥 모이스트 마스크", cat: "hair", form: "jar", opts: [["500g", 180000]], check: "가격 확인 필요" },
  { b: "arvo", n: "09 리브인 컬링 에센스 크림", cat: "hair", form: "tube", img: "assets/img/products/arvo-curl.webp", opts: [["200g", 28000]] },
  { b: "arvo", n: "포레스트 포그 그루밍 토닉", cat: "hair", form: "spray", opts: [["150ml", 25000]] },
  { b: "arvo", n: "헤어 타월", cat: "hair", form: "towel", opts: [["1장", 12000]] },

  /* 보타니스트 */
  { b: "botanist", n: "보타니컬 샴푸", cat: "hair", form: "pump", top: 1,
    opts: [["460ml", 40000], ["리필 400ml", 35000], ["리필 1,200ml", 80000]],
    vars: ["데미지케어 · 프리지아&카시스", "모이스트 · 살구&자스민", "볼륨케어 · 모란&오렌지", "스무스 · 그린애플&로즈", "두피케어 · 라임&리프그린"],
    note: "1,200ml 리필은 데미지케어·모이스트·스무스" },
  { b: "botanist", n: "보타니컬 트리트먼트", cat: "hair", form: "pump",
    opts: [["460ml", 40000], ["리필 400ml", 35000], ["리필 1,200ml", 80000]],
    vars: ["데미지케어 · 작약&베리", "모이스트 · 애플&베리", "볼륨케어 · 배&캐모마일", "스무스 · 애플&베리", "두피케어 · 자몽&세이지"],
    note: "1,200ml 리필은 데미지케어·모이스트·스무스" },
  { b: "botanist", n: "보타니컬 헤어오일 데미지케어", cat: "hair", form: "oil", opts: [["80ml", 45000]], vars: ["아이리스&베리"] },
  { b: "botanist", n: "보타니컬 헤어오일 모이스트", cat: "hair", form: "oil", opts: [["80ml", 35000]], vars: ["살구&로즈"], check: "시트마다 가격 다름" },
  { b: "botanist", n: "보타니컬 헤어 마스크 데일리 데미지 리페어", cat: "hair", form: "jar", opts: [["200g", 45000]] },
  { b: "botanist", n: "보타니컬 바디솝", cat: "body", form: "pump",
    opts: [["490ml", 35000], ["리필 425ml", 30000]],
    vars: ["딥모이스트 · 워터릴리&라즈베리", "마일드케어 · 배&화이트릴리"] },

  /* 메리비 */
  { b: "marybee", n: "로우 마누카 허니콤", cat: "food", form: "honey", top: 1, opts: [["200g", 70000]], check: "시트마다 가격 다름" },
  { b: "marybee", n: "로우 MGO 1300+ 마누카꿀", cat: "food", form: "honey", opts: [["250g", 500000]], check: "시트마다 가격 다름" },
  { b: "marybee", n: "로우 마누카 허니 캔디 레몬생강향", cat: "food", form: "pouch", opts: [["5g × 10개", 26000]] },
  { b: "marybee", n: "마누카 애플 사이다 비니거 위드 더 마더", cat: "food", form: "bottle", opts: [["300ml", 50000]] },

  /* 아티키 */
  { b: "attiki", n: "그릭 허니 블루라벨", cat: "food", form: "honey", top: 1,
    opts: [["병 500g", 100000], ["병 250g", 55000], ["스틱 8g × 30개", 60000]] },
  { b: "attiki", n: "피노 오렌지라벨", cat: "food", form: "honey",
    opts: [["병 500g", 100000], ["병 250g", 55000], ["스틱 8g × 30개", 60000]] },
  { b: "attiki", n: "다크브라운 그린라벨", cat: "food", form: "honey",
    opts: [["병 250g", 55000], ["스틱 8g × 30개", 60000]] },

  /* 라 메종 뒤 미엘 · 브론리 · 에어본 · 하커허벌 · 클라라앤코 */
  { b: "lamaison", n: "블랑 드 라벤더", cat: "food", form: "honey", top: 1, opts: [["250g", 70000]] },
  { b: "bronnley", n: "레몬 브라이트닝 핸드 밤", cat: "body", form: "tube", top: 1, opts: [["75ml", 85000]] },
  { b: "bronnley", n: "레몬 솝", cat: "body", form: "bar", opts: [["100g", 30000]] },
  { b: "airborne", n: "비치우드 허니듀 허니", cat: "food", form: "honey", opts: [["250g", 100000]] },
  { b: "harker", n: "딥 리프레쉬 마누카 로젠지", cat: "health", form: "box", opts: [["3g × 6개", 30000]] },
  { b: "claraco", n: "스퍼 글로우 영 콜라겐", cat: "health", form: "stick", opts: [["20g × 15포", 50000]] },

  /* ── 아래는 가격 시트에 소비자가가 비어 있는 제품입니다 (null) ── */

  /* 츌립 · 마이베프 */
  { b: "choolip", n: "비타스틱", cat: "pet", form: "stick", top: 1, opts: [["15g × 7개", null]],
    vars: ["연어&대구 · 스킨", "연어&랍스터 · 간", "참치&대구 · 신장", "참치&연어 · 심장", "치킨&비프 · 두뇌", "치킨&연어 · 관절", "치킨&참치 · 눈", "버라이어티"] },
  { b: "myvef", n: "마이데일리 덴탈 츄", cat: "pet", form: "pouch", opts: [["13g × 50개", null]] },
  { b: "myvef", n: "마이데일리 퓨레스틱", cat: "pet", form: "stick", opts: [["11g × 48개", null]] },

  /* 드노아 */
  { b: "denoah", n: "클리어 리커버리 크림", cat: "skin", form: "jar", opts: [["65ml", null]] },
  { b: "denoah", n: "클리어 더블 카밍 세럼", cat: "skin", form: "oil", opts: [["30ml", null]] },
  { b: "denoah", n: "더블 부스팅 에센스", cat: "skin", form: "bottle", opts: [["80ml", null]] },
  { b: "denoah", n: "하이드레이팅 올 링클 크림", cat: "skin", form: "tube", opts: [["16ml", null]] },
  { b: "denoah", n: "MD 인텐시브 더마 로션", cat: "skin", form: "pump", opts: [["200g", null]] },
  { b: "denoah", n: "하이드로 앰플 선블록", cat: "skin", form: "tube", opts: [["50ml", null]] },
  { b: "denoah", n: "글로우톡스 콜라겐 마스크팩", cat: "skin", form: "pouch", opts: [["65ml", null]] },
  { b: "denoah", n: "마데케어 연고", cat: "skin", form: "tube", opts: [["20g", null], ["50g", null]] },

  /* 닥터다니엘 */
  { b: "drdaniel", n: "브이파워 더블맥스", cat: "health", form: "box", opts: [["1,000mg × 60정", null]] },
  { b: "drdaniel", n: "브이파워 퀸플러스", cat: "health", form: "box", opts: [["740mg × 60캡슐", null]] },
  { b: "drdaniel", n: "수용성 리포좀 커큐민", cat: "health", form: "box", opts: [["600mg × 30정", null]] },
  { b: "drdaniel", n: "햄프씨드오일 파이토 대마종자유 100", cat: "health", form: "box", opts: [["300mg × 30캡슐", null]] },

  /* 청담뉴트리션 */
  { b: "chungdam", n: "콘드로이친 1200 소연골", cat: "health", form: "box", top: 1, opts: [["600mg × 60정", null]] },
  { b: "chungdam", n: "뮤코다당단백 콘드로이친", cat: "health", form: "box", opts: [["1,100mg × 60정", null]] },
  { b: "chungdam", n: "센시오메가 초임계 알티지 오메가3", cat: "health", form: "box", opts: [["500mg × 60캡슐", null]] },
  { b: "chungdam", n: "골드이뮨 리포좀 비타민C+", cat: "health", form: "stick", opts: [["6g × 30포", null]] },
  { b: "chungdam", n: "장용성 리포좀 비타민 C+D", cat: "health", form: "box", opts: [["550mg × 60정", null]] },
  { b: "chungdam", n: "커큐베일 커큐민", cat: "health", form: "box", opts: [["550mg × 60정", null]] },
  { b: "chungdam", n: "엘라스틴 슈퍼액티브", cat: "health", form: "box", opts: [["500mg × 60정", null]] },
  { b: "chungdam", n: "포스파티딜세린 300", cat: "health", form: "stick", opts: [["2g × 30포", null]] },
  { b: "chungdam", n: "건강해질 유산균", cat: "health", form: "box", opts: [["350mg × 30캡슐", null]] },
  { b: "chungdam", n: "SCZ 바나바잎 추출물 츄어블", cat: "health", form: "box", opts: [["450mg × 60정", null]] },
  { b: "chungdam", n: "테프 발효 효소", cat: "health", form: "box", opts: [["3g × 30정", null]] },
  { b: "chungdam", n: "파로 곡물 발효효소 300 골드", cat: "health", form: "stick", opts: [["2g × 30포", null]] },
  { b: "chungdam", n: "보은대추 쌍화차", cat: "food", form: "pouch", opts: [["90ml × 7포", null]] },
  { b: "chungdam", n: "산양유 단백질 스테비아 커피믹스", cat: "food", form: "stick", opts: [["9.8g × 60포", null]] },

  /* 제로가이드 */
  { b: "zeroguide", n: "레프제로 구강유산균 엠지", cat: "health", form: "box", opts: [["900mg × 30정", null]], vars: ["오리지널", "레몬"] },
  { b: "zeroguide", n: "레프제로 바이오 구강케어 고체치약", cat: "health", form: "box", opts: [["700mg × 5정", null]] },
  { b: "zeroguide", n: "스노제로 코골이 방지 스프레이", cat: "health", form: "spray", opts: [["20ml", null]] },
  { b: "zeroguide", n: "엠티제로 헤어쿠션", cat: "hair", form: "jar", opts: [["15g", null]], vars: ["내추럴 블랙"] },

  /* 김국산 */
  { b: "kimguksan", n: "핫팩 핫칠공", cat: "living", form: "pack", opts: [["150g × 10개", null], ["100g × 20개", null]] },

  /* 유한양행 (유통) */
  { b: "yuhan", n: "당큐락", cat: "health", form: "box", opts: [["1개월 · 30캡슐", null], ["2주 · 14캡슐", null]] },
  { b: "yuhan", n: "와이즈바이옴 당큐락 플러스 유산균", cat: "health", form: "box", opts: [["28정", null]] },
  { b: "yuhan", n: "율리아나 카무트 효소", cat: "health", form: "box", opts: [["3g × 30정", null]] },
  { b: "yuhan", n: "율리아나 퍼펙트케어", cat: "health", form: "box", opts: [["510mg × 120캡슐", null]] },

  /* 가구 · 리빙 */
  { b: "magis", n: "360 컨테이너 5단 수납장", cat: "living", form: "cabinet", opts: [["5단", null]],
    vars: ["블랙", "화이트", "그레이", "레드", "블루", "그린", "옐로우", "핑크"] },
  { b: "magis", n: "퍼피 체어 M", cat: "living", form: "chair", opts: [["M", null]], vars: ["화이트", "오렌지", "달마시안 화이트"] },
  { b: "driade", n: "롤리폴리 암체어", cat: "living", form: "chair", opts: [["1인", null]], vars: ["Charcoal", "Flesh", "Ochre Yellow"] },
  { b: "kvetna", n: "아우리가 유니버셜 와인잔", cat: "living", form: "glass", opts: [["1개", null]], vars: ["레드", "블루", "옐로우", "오렌지"] },
  { b: "atply", n: "T8 스마트 체중계", cat: "living", form: "scale", opts: [["1대", null]] },

  /* 스낵 · 식품 */
  { b: "sahale", n: "허니 아몬드", cat: "food", form: "pouch", opts: [["113g", null], ["42.5g", null]] },
  { b: "sahale", n: "석류 피스타치오", cat: "food", form: "pouch", opts: [["113g", null], ["42.5g", null]] },
  { b: "sahale", n: "메이플 피칸", cat: "food", form: "pouch", opts: [["113g", null], ["42.5g", null]] },
  { b: "sahale", n: "허니 시나몬 캐슈넛", cat: "food", form: "pouch", opts: [["113g", null]] },
  { b: "sahale", n: "석류 바닐라 캐슈넛", cat: "food", form: "pouch", opts: [["42.5g", null]] },
  { b: "sahale", n: "탠저린 마카다미아", cat: "food", form: "pouch", opts: [["42.5g", null]] },
  { b: "freshmac", n: "마카다미아 인-쉘", cat: "food", form: "pouch", opts: [["180g", null]], vars: ["씨솔트", "오븐 로스티드", "바닐라"] },
  { b: "oat", n: "오트 스프레드", cat: "food", form: "stick", opts: [["32g × 10개", null]] }
];
