/*
  IR · 소식 목록 — ir.html 이 이 파일 하나를 읽습니다. 날짜(date)가 최신인 글이 위로 자동 정렬됩니다.

  ■ 글 하나 = { ... } 한 덩어리, 덩어리 사이는 쉼표.
    id      : 영문·숫자·하이픈. 주소에 쓰입니다(ir.html#post-아이디). 다른 글과 겹치면 안 됩니다.
    date    : "2026-10-02" 형식
    type    : "news" 언론 보도 · "press" 보도자료 · "notice" 공지 · "ir" IR 자료
    title   : 제목
    source  : 매체명 (언론 보도일 때)
    url     : 외부 기사 주소. 있으면 목록에서 누를 때 새 창으로 기사가 열립니다.
    summary : 목록에 보이는 두세 줄 요약
    img     : 대표 이미지 "assets/img/ir/파일명.webp" (없어도 됩니다)
    body    : 사이트 안에서 보여 줄 본문. 빈 줄로 문단을 나누고, "## " 로 시작하는 줄은 소제목이 됩니다.
              url 이 없고 body 가 있으면 사이트 안에서 글이 열립니다.
    file    : 내려받을 자료 "assets/ir/파일명.pdf" (IR 자료·보도자료 원문 등)

  ■ 예시 (맨 앞의 // 를 지우면 보입니다)
  // { id: "2026-10-news-1", date: "2026-10-01", type: "news", title: "기사 제목", source: "매체명", url: "https://기사주소", summary: "기사 요약 두세 줄" },
  // { id: "2026-10-press-1", date: "2026-10-01", type: "press", title: "보도자료 제목", summary: "요약", body: "첫 문단\n\n## 소제목\n\n둘째 문단", file: "assets/ir/보도자료.pdf" },
*/
window.IBR_IR = [
  /* 언론 보도 (검색으로 제목·매체·주소를 확인한 기사, 2026.10 정리) */
  {"id": "news-01", "date": "2025-03-17", "type": "news", "title": "아이비알커머스, 자사 브랜드 ‘드노아’ 앞세워 글로벌 D2C 시장 공략 나서", "source": "한국경제", "url": "https://plus.hankyung.com/apps/newsinside.view?aid=2025031781705", "summary": "아이비알커머스가 민감성 피부 전문 브랜드 드노아를 중심으로 베트남·중국 등에서 온·오프라인 유통을 넓히며 소비자 직접 판매(D2C) 방식의 해외 시장 공략에 나섰다는 소식입니다.", "brand": "denoah"},
  {"id": "news-02", "date": "2024-04-12", "type": "news", "title": "드노아(de noah), ‘위로와 기념의 여정’ 서울숲 아트세트 팝업 지난 7일 성황리에 마감", "source": "한국경제TV", "url": "https://www.wowtv.co.kr/NewsCenter/News/Read?articleId=A202404120135", "summary": "드노아가 서울숲에서 판매보다 브랜드 경험에 초점을 둔 아트세트 팝업을 열고, 개막일에는 공동 개발자인 피부과 원장이 팬들과 만나는 시간을 가졌습니다.", "brand": "denoah"},
  {"id": "news-03", "date": "2023-11-21", "type": "news", "title": "마이베프, ‘2023 메가주 일산’ 통해 해외 판로 확보", "source": "머니투데이", "url": "https://news.mt.co.kr/mtview.php?no=2023112111493095761", "summary": "마이베프가 메가주 일산의 수출 상담 부스에서 해외 바이어와 상담을 진행했습니다. 반려동물 간식 ‘츌립(CHOOLIP)’으로 미국에 진출한 데 이어 아시아 수출 문의도 받고 있다고 전했습니다.", "brand": "myvef"},
  {"id": "news-04", "date": "2023-11-09", "type": "news", "title": "아이비알커머스 ‘웰뉴라이프 프레스티지’, 미국 론칭 한달 만 매출 300만불 달성", "source": "스포츠경향", "url": "https://sports.khan.co.kr/article/202311091448003", "summary": "아이비알커머스가 미국 아마존에 선보인 인체공학 의자 ‘웰뉴라이프 프레스티지’가 출시 약 한 달 만에 좋은 성과를 냈다는 소식입니다."},
  {"id": "news-05", "date": "2023-07-17", "type": "news", "title": "아이비알, 생활용품·반려동물 브랜드 사업 주력으로 매출 성장세 이어가", "source": "머니투데이", "url": "https://news.mt.co.kr/mtview.php?no=2023071710535999276", "summary": "아이비알이 2023년 상반기에도 매출 성장세를 이어 가고 있으며, 생활용품과 자체 반려동물 브랜드 마이베프를 주력 사업으로 키우고 있다고 소개했습니다."},
  {"id": "news-06", "date": "2023-05-19", "type": "news", "title": "마이베프, ‘2023 메가주’ 펫페어에서 신제품 선봬", "source": "머니투데이", "url": "https://news.mt.co.kr/mtview.php?no=2023051922375520062", "summary": "마이베프가 일산 킨텍스에서 열린 펫 전시회 ‘2023 메가주’에서 고양이 헤어볼 영양제 ‘필랩 헤어볼 릴리즈’를 처음 공개했습니다.", "brand": "myvef"},
  {"id": "news-07", "date": "2023-04-10", "type": "news", "title": "[마이펫페어] 마이베프, 강아지 관절영양제 ‘필랩 조인트업’ 소개", "source": "전자신문", "url": "https://www.etnews.com/20230410000138", "summary": "마이베프가 마이펫페어에서 강아지 관절 건강을 위한 영양제 ‘필랩 조인트업’을 소개했습니다.", "brand": "myvef"},
  {"id": "news-08", "date": "2022-12-14", "type": "news", "title": "건강기능식품 닥터다니엘, ‘아누카 사과 추출분말’ 함유", "source": "머니투데이", "url": "https://news.mt.co.kr/mtview.php?no=2022121419082554659", "summary": "닥터다니엘이 이탈리아산 아누카 사과 추출분말에 검은콩·맥주효모 등을 더한 모발 건강용 스틱형 분말 제품을 선보였습니다.", "brand": "drdaniel"},
  {"id": "news-09", "date": "2022-06-22", "type": "news", "title": "사할리스낵, 롯데홈쇼핑 ‘최유라쇼’ 단독 진행", "source": "서울경제TV", "url": "https://www.sentv.co.kr/article/view/sentv202206220044", "summary": "미국 프리미엄 시즈닝 견과 브랜드 사할리스낵이 롯데홈쇼핑 ‘최유라쇼’에서 단독 구성과 신제품을 담은 여름 프로모션 방송을 진행한다는 소식입니다.", "brand": "sahale"},
  {"id": "news-10", "date": "2021-06-29", "type": "news", "title": "[마이캣페어 2021] 마이베프, 별자리 스틱 소개", "source": "전자신문", "url": "https://www.etnews.com/20210629000175", "summary": "마이베프가 마이캣페어 2021에서 신장·간·두뇌를 위한 별자리 스틱 신제품을 선보이며 7종 시리즈를 완성했습니다.", "brand": "myvef"},
  {"id": "news-11", "date": "2019-11-20", "type": "news", "title": "일산 케이펫페어 수의사가 만든 수제간식브랜드 마이베프 참가", "source": "한국경제TV", "url": "https://www.wowtv.co.kr/NewsCenter/News/Read?articleId=A201911200350", "summary": "수의사가 만든 반려동물 간식 브랜드 마이베프가 일산 킨텍스 케이펫페어에 참가해 강아지·고양이용 퓨레 간식을 선보였습니다.", "brand": "myvef"},
  {"id": "news-12", "date": "2024-08", "type": "news", "title": "Super Zoo 2024, 신제품 쇼케이스에 가다", "source": "뉴스펫", "url": "https://www.newspet.co.kr/news/articleView.html?idxno=9422", "summary": "북미 반려동물 산업 전시회 슈퍼주 2024의 신제품 쇼케이스 소식으로, 츌립의 ‘베리 굿 밀크’가 고양이 부문 1위에 오른 내용을 다뤘습니다.", "brand": "choolip"},
  {"id": "news-13", "date": "", "type": "news", "title": "에이르보(Arvo), 유명 스위스 향료사와 협력한 헤어 오일 2종 출시", "source": "이데일리", "url": "https://www.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=02348486635774888", "summary": "에이르보가 스위스 향료사와 협업한 헤어 오일 ‘플로럴 선샤인’과 ‘포레스트 포그’를 선보였습니다. 가볍고 잔여감 없는 텍스처를 그대로 살렸습니다.", "brand": "arvo"},
  {"id": "news-14", "date": "", "type": "news", "title": "㈜아이비알, 아이뷰티케어 브랜드 OOHA(오하) 신규 론칭", "source": "이데일리", "url": "https://www.edaily.co.kr/News/Read?mediaCodeNo=257&newsId=02555126638754768", "summary": "㈜아이비알이 컬러렌즈를 중심으로 한 아이뷰티 브랜드 ‘OOHA(오하)’를 선보이고 국내 판매와 해외 수출을 함께 추진한다는 소식입니다."},
  {"id": "news-15", "date": "", "type": "news", "title": "빵 굽는 수의사의 반려동물 영양간식, ‘마이베프’", "source": "벤처스퀘어", "url": "https://www.venturesquare.net/823185", "summary": "수의사가 제품 기획부터 영양 배합까지 직접 참여하는 반려동물 영양간식 브랜드 마이베프의 운영 방식과 제품을 소개한 기사입니다.", "brand": "myvef"},
  {"id": "news-16", "date": "", "type": "news", "title": "‘젊음과 패기로 이끈 1년의 성과’, 앞으로가 더욱 기대되는 마이베프의 거침없는 질주", "source": "한국애견신문", "url": "http://www.koreadognews.co.kr/m/page/view.php?no=4636", "summary": "‘빵 굽는 수의사’ 블로그에서 출발한 반려동물 영양간식 브랜드 마이베프의 첫 1년 성과와 제품군을 소개한 기사입니다.", "brand": "myvef"},
];
