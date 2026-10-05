# 사이트 제작 가이드

모든 사이트가 같은 규칙으로 만들어진다. 새 사이트를 추가할 때도 이 문서를 따른다.

## 1. 구조

```
/<slug>/index.html   마크업 + SEO 메타 + SEO 본문
/<slug>/style.css    사이트 전용 스타일 (토큰만 사용)
/<slug>/app.js       ES module, ../shared/kit.js 를 import
/<slug>/*.json       데이터 (필요할 때)
/shared/             공통 디자인 시스템과 유틸 (사이트에서 수정 금지)
```

- 빌드 단계 없음. 순수 HTML/CSS/바닐라 JS(ES modules). npm 의존성 없음.
- 예외: `shared/vendor/lunar.js` (만세력 계산, 클래식 `<script>`로 로드하면 `window.Solar` 등 전역 생성).
- 기본은 서버 없이 동작. 친구 간 상태 전달은 URL(`encodeState`), 개인 기록은 `createStore`(localStorage).
- 외부 API를 쓰는 경우 실패해도 핵심 기능이 동작해야 한다(대체 경로 필수).

## 2. 디자인 시스템 (레퍼런스: "AI가 만들게 하지 말고 고르게 하라")

값을 새로 만들지 않는다. `shared/tokens.css`, `shared/components.css` 안에서 고른다.

| 영역 | 쓰는 것 |
|---|---|
| Color | 역할 토큰만: `--color-primary`, `--color-bg`, `--color-surface(-raised/-sunken)`, `--color-text(-secondary/-tertiary)`, `--color-border(-strong)`, `--color-danger`, `--color-success`, `--color-warning` |
| 사이트 색 | `:root`에서 `--brand`, `--brand-pressed`, `--brand-soft`, `--brand-on` 4개만 덮어쓴다. 테마는 `<html data-theme="light|dark">` |
| Text | `.t-display-01/02`, `.t-title-01~04`, `.t-body-01~03(-strong)`, `.t-label-01~03`, `.t-caption-01` 또는 `font: var(--title-02)` 형태 |
| Spacing | `--sp-4 / 8 / 12 / 16 / 24 / 32` 중심 (보조 2·6·10·20·40·48·64) |
| Radius | `--r-0 / 4 / 6 / 8 / 12 / 16 / 24 / full` |
| Shadow | `--shadow-s / m / l` 세 단계만 (중요도에 따라 선택) |
| Component | `.btn` (`--primary/--secondary/--outline/--ghost/--danger`, `--lg/--sm/--block/--icon`), `.field/.input`, `.card(--flat/--raised)`, `.chip`, `.badge`, `.sheet`, `toast()` |
| State | Button: Default / Pressed(`:active`) / Disabled(`:disabled`) / Loading(`.is-loading`). Input: Default / Focus / Filled / Error(`.is-error`) / Disabled |

- 임의의 hex 색, px 간격, 그림자 금지. 예외는 일러스트(Canvas/SVG 그림) 내부의 장식 색뿐이며, 그 경우에도 가능하면 `getComputedStyle`로 토큰을 읽는다.
- 화면 전용 컴포넌트가 필요하면 `style.css`에 만들되, 내부 값은 토큰으로 채운다.

## 3. 절대 원칙

1. **첫 화면은 시스템을 쉽게 이해시키는 멋있는 모션그래픽.** `section.intro` 안에서 3~4장면으로 "어떻게 동작하는지"를 보여주고 바로 아래에 시작 버튼. `runIntro()`를 쓰거나 직접 구현. 60fps, `prefers-reduced-motion` 존중.
2. **모바일 최적화.** 390px 기준 설계, 가로 스크롤 금지, 탭 영역 48px 이상, 터치로 모든 기능 사용 가능. 데스크톱은 가운데 480px 컬럼.
3. **재방문·확산 장치 필수.** 공유는 `share()`(URL 상태) + `shareImage()`(결과 카드 캔버스). 재방문은 기록·스트릭·데일리 콘텐츠.
4. **모르는 사람과의 경쟁 금지.** 전국 순위표, 랭킹 없음. 비교 대상은 어제의 나, 혹은 친구와 "같이 노는" 구조.
5. **가짜 데이터 금지.** 실시간 참여자 수, 통계, 퍼센트를 지어내지 않는다. 근사치는 근사치라고 표시. 운세·해몽류는 "재미로 보는 콘텐츠" 고지.

## 4. SEO

- `<title>`은 검색 키워드를 앞에: `만나이 계산기 | 인생 진행률 - ...`
- `description`, `keywords`, `canonical`(`https://example.com/<slug>/`, 배포 시 `scripts/set-domain.mjs`로 일괄 교체), OG 태그, JSON-LD(`WebApplication`).
- 정적 SEO 본문(`article.seo`): h2/h3 + 사용법 + FAQ(`details`). 검색 의도에 실제로 답하는 내용.
- 하단 `nav#more`에 `renderMoreSites(el, slug)`로 다른 사이트 링크.

## 5. 문체

- 해요체, 짧고 친근하게. 버튼은 동사형("시작하기", "결과 보기", "친구에게 보내기").

## 6. 검증

```
node scripts/shot.mjs <slug> /tmp/shot.png 2500                      # 첫 화면
node scripts/shot.mjs <slug> /tmp/shot2.png 800 "document.querySelector('#start').click()"
FULL=1 node scripts/shot.mjs <slug> /tmp/full.png 2500               # 전체 페이지
```

- 콘솔의 `[pageerror]`가 없어야 한다. (외부 CDN은 샌드박스에서 차단되므로 폰트 로드 실패 에러는 무시)

## 7. 첫 화면 모션 & "AI티 안 나게" (최우선)

첫 화면은 그 사이트가 뭘 하는지 **보여주는** 쫄깃한 모션이어야 한다. 설명 문장보다 실제 기능이 움직이는 장면이 먼저.

**쫄깃한 모션 기법**
- 스프링/오버슈트 이징: `cubic-bezier(.34,1.56,.64,1)` 또는 CSS `linear()` 스프링, JS 스프링(감쇠 진동)
- 예비동작(anticipation) → 동작 → 여운(overshoot·settle). 스쿼시 앤 스트레치(눌렸다 튀는 형태 변형)
- 시차(stagger) 등장, 마스크/클립 리빌(`clip-path`), 숫자 오도미터(자리별 롤링), 스플릿 플랩
- 키네틱 타이포: 제목 글자 단위 분해·무게 변화·늘어남. 헤드라인만 움직이고 본문은 고정
- 터치 반응: 누르면 눌리고 놓으면 튀는 버튼, 손가락 따라 기우는 요소
- 페이드업 한 가지만 반복하는 모션 금지. 리니어 이징 금지

**AI티 나는 것 금지 목록**
- 보라~남색 그라디언트, 빛나는 블롭/오브, 글래스모피즘(반투명 블러 카드)
- 모든 걸 가운데 정렬한 대칭 히어로 + 똑같은 카드 그리드
- 장식용 이모지 남발(✨🚀), "혁신적인", "새로운 경험" 같은 빈 문구
- 의미 없는 추상 일러스트

**대신 할 것**
- 사이트마다 **실제 세계의 디자인 장르 하나**를 레퍼런스로 정해 끝까지 밀고 간다(아래 표).
- 단색 면 + 강한 포인트 색 1개, 질감(종이·노이즈·스캔라인)으로 깊이감
- 제목 서체 하나를 골라 `--font-display`로 지정 (Google Fonts 한글: Black Han Sans, Do Hyeon, Jua, Gowun Batang, Song Myung, Nanum Pen Script, Gaegu, Dongle, Hahmlet, Gothic A1, IBM Plex Sans KR 등 / 숫자·영문: IBM Plex Mono, Space Grotesk, Archivo, Anton 등). 본문은 Pretendard 유지
- 의도적으로 깬 그리드, 크기 대비가 큰 타이포, 실제 콘텐츠로 채운 화면

| 사이트 | 디자인 장르 레퍼런스 |
|---|---|
| 누가 쏠래? | 스포츠·e스포츠 중계 그래픽 (F1 타이밍 타워, 사선 와이프, 기울어진 굵은 서체, 리플레이 스팅어) |
| 나 상장하기 | 증권 단말기·전광판 (블룸버그 터미널, 모노스페이스 시세, 스플릿 플랩) |
| 어디가? | 교통·길찾기 사인 시스템 (지하철 노선도, 굵은 노선색, 핀 스쿼시 바운스) |
| 딴짓 오락실 | 오락실 캐비닛·게임쇼 (CRT 스캔라인, INSERT COIN, 청키한 버튼) |
| 꿈 사주 | 한지·먹 + 밤 (먹 번짐, 세로쓰기, 부적·도장, 오방색 절제) |
| 남이 정해주는 MBTI | 진(zine)·콜라주 (스티커, 손글씨 화살표, 거울 왜곡, 테이프) |
| 실시간 월급 카운터 | 영수증·기계식 카운터 (감열지, 오도미터, 모노 흑백 + 녹색) |
| 인생 진행률 | 스위스 타이포·정보 디자인 (거대한 숫자, 점 그리드, 흑백 시네마틱) |
| 단톡방 궁합표 | 2000년대 다이어리·싸이월드 감성 (모눈 노트, 형광펜, 픽셀 하트, 스티커) |
| 뇌 나이 측정소 | 실험실 계측기 (오실로스코프, 모눈 그리드, 측정 눈금, 형광 녹색) |
| 커플 D-day 룸 | 필름 사진·편지지 (폴라로이드, 필름 그레인, 손글씨, 우표·소인) |
