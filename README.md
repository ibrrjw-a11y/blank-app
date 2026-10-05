# 놀이터

검색량이 큰 익숙한 테스트·추첨·계산기를 **변주**해서, 재방문과 확산이 일어나도록 만든 모바일 웹사이트 11개.
하나의 디자인 시스템을 공유하고, 빌드 없이 정적 파일로 어디든 배포할 수 있다.

| 경로 | 이름 | 원본 검색 키워드 | 변주 |
|---|---|---|---|
| `/who-pays/` | 누가 쏠래? | 룰렛, 사다리타기, 제비뽑기 | 아이템으로 개입하는 레이스·배틀로얄·통아저씨, 중계 자막, 벌칙 장부 |
| `/life-stock/` | 나 상장하기 | 대운, 사주, 손 없는 날 | 대운·세운을 주가 차트로, 애널리스트 리포트, M&A 궁합, 택일 캘린더 |
| `/where-to-go/` | 어디가? | 점심메뉴 추천, 중간지점 | 다같이 하는 월드컵 + 거부권 + 실제 가게/지도 연결, 점심 리포트 |
| `/ddanjit/` | 딴짓 오락실 | 데일리 퀴즈, 꼬들 | 줌아웃·오늘의 동네·그때 그 가격·추억 연대기 (혼자 하는 추리) |
| `/dream-saju/` | 꿈 사주 | 꿈해몽, 태몽 | 4기둥 아이콘 입력, 꿈 도감·일기, 상징별 SEO 페이지 자동 생성 |
| `/others-mbti/` | 남이 정해주는 MBTI | MBTI 검사 | 친구 3명이 답해야 열리는 "남이 보는 나" |
| `/salary-live/` | 실시간 월급 카운터 | 연봉 실수령액 계산기 | 지금 버는 돈 실시간 카운터, 회의 비용 타이머, 월급루팡 영수증 |
| `/life-progress/` | 인생 진행률 | 만나이 계산기 | 인생 4,000칸 그리드, 남은 크리스마스, 버킷리스트 |
| `/name-match/` | 단톡방 궁합표 | 이름궁합 | 이름 N명 전원 궁합 매트릭스, 짝사랑 지수 |
| `/brain-age/` | 뇌 나이 측정소 | 반응속도 테스트 | 미니게임 5종으로 뇌 나이, 부모님께 도전장 |

## 구조

```
index.html            허브 (전체 사이트 목록)
shared/               공통 디자인 시스템 (tokens.css, components.css, kit.js, sites.js, vendor/)
<slug>/               사이트별 index.html, style.css, app.js, 데이터, og.png
scripts/              도구 (스크린샷, OG 이미지, 사이트맵, 도메인 교체, 꿈 SEO 페이지)
docs/BUILD_GUIDE.md   사이트 제작 규칙 (디자인 시스템·절대 원칙·SEO)
```

## 디자인 시스템

레퍼런스 원칙 "AI가 UI를 만들게 하지 말고, 이미 정해둔 것 중에서 고르게 한다"를 그대로 따른다.

- **Color**: 역할 토큰(Primary / Background / Surface / Text / Border / Danger). 사이트마다 `--brand` 4개만 바꾼다.
- **Text**: Display / Title / Body / Label / Caption
- **Spacing**: 4 / 8 / 12 / 16 / 24 / 32
- **Radius**: 0 / 4 / 6 / 8 / 12 / 16 / 24 / Full
- **Shadow**: Small / Medium / Large
- **Component + State**: Button(Default/Pressed/Disabled/Loading), Input(Default/Focus/Filled/Error/Disabled), Card, Chip, Sheet, Toast

자세한 규칙은 [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md).

## 로컬 실행

```bash
npx serve .            # 또는 python3 -m http.server
# http://localhost:3000
```

## 배포

정적 호스팅이면 어디든 된다 (Vercel, Netlify, Cloudflare Pages, GitHub Pages). 빌드 명령 없음, 출력 폴더는 루트.

배포 전:

```bash
node scripts/set-domain.mjs https://내도메인.com   # canonical·sitemap 도메인 교체
node scripts/build-sitemap.mjs                      # sitemap.xml, robots.txt
node scripts/build-og.mjs                           # 사이트별 og.png (공유 미리보기)
node scripts/build-dream-pages.mjs                  # 꿈해몽 SEO 페이지 재생성 (데이터 수정 시)
```

배포 후 구글 서치콘솔·네이버 서치어드바이저에 `sitemap.xml`을 등록한다.

## 서버 없이 동작하는 방식과 한계

모든 사이트는 서버 없이 동작한다. 친구 간 데이터는 **링크(URL)에 담아 주고받고**, 개인 기록은 브라우저(localStorage)에 저장한다.

- 실시간 멀티플레이(각자 폰으로 동시 참여), 응답 자동 수집, 전국 집계를 하려면 DB가 필요하다 → Supabase/Firebase 연동이 다음 단계.
- 어디가?의 실제 가게 데이터는 기본이 OpenStreetMap이고, `where-to-go/config.js`에 카카오 JavaScript 키를 넣으면 카카오 장소 검색을 쓴다.

## 사이트별 디자인 장르 (AI티 방지)

| 사이트 | 장르 | 제목 서체 |
|---|---|---|
| 누가 쏠래? | F1·e스포츠 중계 그래픽 | Black Han Sans, Anton |
| 나 상장하기 | 증권 단말기·스플릿 플랩 | IBM Plex Mono / Sans KR |
| 어디가? | 지하철 노선도·사인 시스템 | Gothic A1, Archivo |
| 딴짓 오락실 | 오락실 캐비닛·CRT | Black Han Sans, Press Start 2P |
| 꿈 사주 | 한지·먹·도장 | Song Myung |
| 남이 정해주는 MBTI | 진(zine) 콜라주 | Black Han Sans, Nanum Pen Script |
| 실시간 월급 카운터 | 감열지 영수증·기계식 카운터 | IBM Plex Mono / Sans KR |
| 인생 진행률 | 스위스 타이포·정보 디자인 | Archivo Black, Gothic A1 |
| 단톡방 궁합표 | 2000년대 다이어리·싸이월드 | Jua, Gaegu, DotGothic16 |
| 뇌 나이 측정소 | 실험실 계측기·오실로스코프 | IBM Plex Mono / Sans KR |

## 외부 연동 (선택)

- **어디가? 실제 가게**: `where-to-go/config.js`의 `kakaoJsKey`에 카카오 JavaScript 키를 넣고, 카카오 개발자 콘솔 → 플랫폼 → Web에 배포 도메인을 등록한다. 키가 없으면 OpenStreetMap(무료) → 내장 메뉴 목록 순으로 동작한다.
- **날씨 가중치**: Open-Meteo(무료, 키 없음).
- 제목 서체는 Google Fonts, 본문은 Pretendard CDN에서 불러온다.

## 검증

```bash
node scripts/shot.mjs <slug> /tmp/shot.png 2500     # 390x844 모바일 스크린샷 + 콘솔 에러 출력
```
