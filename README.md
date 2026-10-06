# 모바일 웹 도구 모음

검색량이 큰 익숙한 테스트·추첨·계산기·게임을 **변주**해서, 재방문과 공유가 일어나도록 만든 모바일 웹 페이지들.
도메인은 같이 쓰지만 공통 홈이나 브랜드는 없다. 각 페이지가 독립된 사이트처럼 따로 방문된다. 기능 하나 = 페이지 하나.

## 페이지 목록 (내부 분류용)

| 분류 | 페이지 |
|---|---|
| 추첨·내기 | 룰렛 돌리기 `/roulette/` · 사다리타기 `/ladder/` · 제비뽑기 `/gacha/` · 팀 나누기 `/team-split/` · 구슬 레이스 `/who-pays/` · 배틀로얄 `/who-pays/battle/` · 통아저씨 `/who-pays/barrel/` |
| 심리테스트 | 남이 정해주는 MBTI `/others-mbti/` · 테토·에겐 `/teto-egen/` · 애착 유형 `/attachment/` · 연애 세포 `/love-type/` · 꼰대력 `/kkondae/` |
| 운세·꿈해몽 | 나 상장하기 `/life-stock/` · 꿈 사주 `/dream-saju/` (+ 꿈해몽 사전 48쪽) |
| 미니게임 | 딴짓 오락실 `/ddanjit/` (줌아웃·오늘의 동네·그때 그 가격·추억 연대기 각 페이지) · 1 to 50 `/one-to-fifty/` · 탑 쌓기 `/stack-tower/` · 2048 `/merge-2048/` · 뇌 나이 측정소 `/brain-age/` |
| 생활 계산기 | 연봉 실수령액 `/salary-live/net-pay/` · 실시간 월급 카운터 `/salary-live/` · 만나이 계산기 `/life-progress/age/` · 인생 진행률 `/life-progress/` |
| 커플·친구 | 단톡방 궁합표 `/name-match/` · 어디가? `/where-to-go/` |

목록의 원본은 `shared/sites.js` 하나다. 페이지 하단 "이것도 해보기" 링크 3개가 이 목록에서 나온다. 루트(`/`)는 noindex 링크 목록일 뿐이다.

## 구조

```
index.html                      noindex 링크 목록 (브랜드·디자인 없음)
shared/                         디자인 시스템 (tokens.css, components.css, kit.js, sites.js, vendor/)
test-kit/                       심리테스트 공용 엔진
<도구>/                         각 페이지 (index.html, style.css, app.js, 데이터, og.png)
scripts/                        스크린샷, OG 이미지, 사이트맵, 도메인 교체, 꿈해몽 페이지 생성
docs/BUILD_GUIDE.md             제작 규칙 (디자인 시스템 · 첫 화면 모션 · AI티 금지 · SEO)
```

## 디자인 원칙

- 값은 `shared/tokens.css`에서만 정의하고 화면은 역할 토큰을 골라 쓴다 (Color 역할, Text 역할, Spacing 4/8/12/16/24/32, Radius, Shadow S/M/L, 버튼·입력 상태).
- 페이지마다 실제 세계의 디자인 장르 하나를 끝까지 민다 (예능 세트, 칠판, 문방구 뽑기 기계, 카드 테이블, 증권 단말기, 한지와 먹, 사내 결재 서류, 엘리베이터 버튼판, 공사장 크레인, 원목 타일 등).
- 첫 화면은 기능이 실제로 움직이는 쫄깃한 모션. 시작 버튼은 장르 안의 물건. 본문은 실제 계산 예시가 든 장르 문서.
- 모르는 사람과의 순위 경쟁, 지어낸 통계 금지.

자세한 규칙: [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md) · 새 채팅으로 옮길 때: [`docs/HANDOFF.md`](docs/HANDOFF.md)

## 로컬 실행

```bash
npx serve .            # 또는 python3 -m http.server
```

## 배포

정적 호스팅(Vercel, Netlify, Cloudflare Pages, GitHub Pages). 빌드 명령 없음, 출력 폴더는 루트.

```bash
node scripts/set-domain.mjs https://내도메인.com   # canonical·sitemap 도메인 교체
node scripts/build-sitemap.mjs                      # sitemap.xml, robots.txt
node scripts/build-og.mjs                           # 없는 og.png 생성 (--force 로 전부 다시)
node scripts/build-dream-pages.mjs                  # 꿈해몽 사전 페이지 재생성
```

배포 후 구글 서치콘솔·네이버 서치어드바이저에 `sitemap.xml` 등록.

## 서버 없이 동작하는 방식과 한계

- 친구 간 데이터는 링크(URL)에 담아 주고받고, 개인 기록은 브라우저(localStorage)에 저장한다.
- 카카오톡 인앱 브라우저와 크롬은 저장소가 따로라 기록이 나뉠 수 있다.
- 친구 응답 자동 집계·실시간 참여는 DB(Supabase 등)를 붙이면 가능하다.
- 어디가?의 실제 가게 정보: `where-to-go/config.js`에 카카오 JavaScript 키를 넣으면 카카오 장소 검색, 없으면 OpenStreetMap → 내장 메뉴 목록.

## 검증

```bash
node scripts/shot.mjs <경로> /tmp/shot.png 2500     # 390x844 모바일 스크린샷 + 콘솔 에러 출력
```
