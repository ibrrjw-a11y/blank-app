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
];
