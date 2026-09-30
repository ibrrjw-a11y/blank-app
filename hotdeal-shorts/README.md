# hotdeal-shorts: 핫딜 쇼핑 쇼츠 자동화

딜 하나를 넣으면 **대본 → AI 목소리 → 자막 화면 → 세로 영상(final.mp4) → 업로드 문구(제휴 고지 포함)** 까지 만들고,
올린 뒤에는 **성과 수집 → 진단 → 잘 되는 훅을 다음 대본에 더 자주 쓰는 학습**까지 하는 CLI 도구.

UI 없음. 명령어 + 폴더 + 마크다운으로 운영한다.

## 설치 (내 PC, 처음 한 번)

1. [Python 3.10+](https://www.python.org/downloads/) 와 [ffmpeg](https://ffmpeg.org/download.html) 설치
   - Windows: `winget install Gyan.FFmpeg` / Mac: `brew install ffmpeg`
2. 이 폴더에서:
   ```bash
   pip install -e .
   cp .env.example .env      # 키가 있으면 채우기 (없어도 동작)
   hd doctor                 # 준비 상태 점검
   ```
3. (선택) 폰트: [Pretendard](https://github.com/orioncactus/pretendard) 의 `Pretendard-ExtraBold.otf` 를 `fonts/` 에 넣으면 우선 사용. 없으면 맑은고딕/애플고딕/Noto 자동 사용.

## 작업 화면 (추천)

```bash
pip install -e ".[ui,capcut,free-voice]"   # 처음 한 번
hd ui                                      # 브라우저에 작업 화면이 열림 (내 PC 안에서만)
```

- **① 딜 고르기**: 수집한 딜 표(점수·탈락 사유), 쿠팡·토스 가져오기 버튼(키 있을 때), **상품 URL 붙여넣기 → 이름·이미지·가격 자동 채움**(막힌 쇼핑몰은 직접 입력), 수익 링크·이미지 파일 직접 넣기
- **② 영상 만들기**: 상품 정보·가격 수정, 상품 사진 바꾸기, **테마 6가지 미리보기로 고르기**, 대본 편집 + 실시간 검사, **장면 추가**(게시글 / 카톡 / 커뮤니티 8종 미리보기), **줄별 사진 올리기**, 목소리 고르기, 영상 만들기·재생·받기, **캡컷으로 보내기**, 유튜브 제목·설명·고정 댓글 복사

아래 명령어들은 같은 기능을 터미널에서 쓰는 방법이다.

## 하루 작업 흐름 (명령어)

```bash
# 1) 딜 모으기 (둘 중 편한 것)
hd deals template                 # deals.csv 양식 생성 → 핫딜 게시판에서 본 딜을 한 줄씩 채움
hd deals import deals.csv
hd deals coupang --goldbox        # 쿠팡파트너스 키가 있으면: 오늘의 특가 + 수익 링크 자동
hd deals coupang --search "무선 청소기"
hd deals toss --best              # 토스쇼핑 쉐어링크 키가 있으면: 토스 베스트(상시형) / --today 하루특가

hd deals list                     # 점수순 후보 (할인율·가격대·리뷰 수·상시형 여부로 채점, 탈락 사유 표시)

# 2) 대본 (사람 확인 게이트)
hd new 3                          # 딜 #3 으로 작업 생성 + 대본 초안 + 자동 검사
#   → jobs/<날짜_상품>/script.md 를 열어 다듬기
hd script lint <작업>             # 다시 검사
hd script approve <작업>          # 승인 (ERROR 있으면 거부)

# 3) 영상
hd build <작업>                   # 목소리 → 화면 → render/final.mp4 + review.md

# 한 번에: 검사 통과하면 사람 승인 없이 바로 제작
hd make 3 --yes
```

`review.md` 에 **올리기 전 5분 점검표**와 **유튜브 제목·설명·고정 댓글·릴스 캡션**이 들어 있다. 복사해서 붙여넣으면 된다.
`render/preview_3s.gif` 로 소리 없이 첫 3초를 확인한다.

## 올린 뒤

```bash
hd video add <작업> --youtube-id <영상ID>   # youtube.com/shorts/ 뒤의 11자리
hd metrics pull                            # YouTube API 키 있으면: 조회수·좋아요·구매 의도 댓글 수집
hd metrics import stats.csv                # 키 없으면: 스튜디오 수치를 CSV로 (job,views,likes,comments,buy_intent,avg_view_pct)
hd report                                  # 주간 리포트: 배수·진단·훅별 성과·다음 주 고칠 것 1개
```

**학습 루프**: 리포트의 훅 유형별 평균 배수가 다음 `hd new` 때 훅 선택 가중치로 쓰인다(20%는 무작위 탐색).

## 목소리 바꾸기

`config.yaml` 의 `voice.provider` 만 바꾸면 된다.

| provider | 비용 | 특징 | 준비 |
|---|---|---|---|
| `edge` (기본) | 무료 | MS 음성(인터넷 필요). 대본 전체를 한 번에 읽어 억양이 자연스러움 | 없음 |
| `supertonic` | 무료 | 슈퍼톤 공개 AI 음성, **오프라인**. 여성 F1~F5 / 남성 M1~M5 | `pip install -e ".[free-voice]"`, 첫 실행 때 모델(약 400MB) 자동 다운로드 |
| `typecast` | 유료 | 한국어 AI 성우, 쇼츠에서 가장 많이 씀. 감정·속도 조절. 대본 전체 한 번에 + 단어 시각 | `.env` 에 `TYPECAST_API_KEY`, `hd voice list typecast` 로 고른 id 를 `voice.typecast.voice_id` 에 |
| `elevenlabs` | 유료 | 감정 표현 좋음, 목소리 복제. 대본 전체 한 번에 + 글자 시각 | `ELEVENLABS_API_KEY`, `hd voice list elevenlabs` → `voice.elevenlabs.voice_id` |
| `openai` | 유료(저렴) | 말투를 문장으로 지시 가능 (`voice.openai.instructions`) | `OPENAI_API_KEY` |
| `google` | 유료(저렴) | 안정적인 아나운서 톤 | `GOOGLE_TTS_API_KEY` |
| `sherpa` / `espeak` | 무료 | 인터넷 없이 (품질 낮음) | `hd voice setup-offline` |
| `manual` | - | 직접 녹음·다른 곳에서 만든 파일을 `voice_raw.mp3` 로 | - |

무료 목소리 비교: `hd voice sample` → `voice_samples/` 폴더에서 13가지 목소리를 같은 문장으로 들어보고 고른다.
유료 목소리는 **선택 사항**이다 (안 쓰면 키도 필요 없음).
한 번만 다른 목소리로 만들려면 `hd build <작업> --voice supertonic`.

## 캡컷으로 넘겨서 손보기

자동으로 만든 영상을 캡컷 프로젝트로 내보내서 효과음·전환·자막만 사람이 손본다.

```bash
pip install -e ".[capcut]"     # 처음 한 번 (pycapcut)
hd build <작업>
hd capcut <작업>               # 캡컷을 껐다 켜면 목록 맨 앞에 '상품명_MMDD'
hd capcut <작업> --baked       # 자막을 화면에 구운 판 (자막 편집 불필요할 때)
```

- 트랙: `목소리` / `효과음`(빈 트랙) / `화면`(줄마다 이미지) / `자막`(게시글형 줄, 글자 편집 가능 · 캡컷 기본 글꼴)
- 커뮤니티·카톡 장면은 화면 자체가 글이라 구운 이미지 그대로 들어감
- 소재는 초안 폴더 안 `materials/` 로 복사되므로 작업 폴더를 지워도 괜찮음
- 초안 폴더 자동 탐색: Windows `%LOCALAPPDATA%\CapCut\User Data\Projects\com.lveditor.draft`, Mac `~/Movies/CapCut/User Data/Projects/com.lveditor.draft`. 다르면 `config.yaml` 의 `capcut.drafts_dir`
- **캡컷 초안 형식은 비공개**라 오픈소스 pycapcut 으로 만든다. 캡컷 버전에 따라 안 열릴 수 있으니 첫 한 번은 직접 열어 확인

## 줄마다 AI 이미지

`.env` 에 `GEMINI_API_KEY`(기본) 또는 `OPENAI_API_KEY` 를 넣으면 `hd build` 때 게시글형 줄마다 실사풍 이미지를 만들어 사진 칸에 넣는다.
키가 없으면 건너뛰고 상품 사진으로 만든다.

```bash
hd images <작업>                 # 이미지만 따로 생성 → images/line_003.png ...
hd images <작업> --force         # 전부 다시 (마음에 안 드는 한 장은 파일만 지우고 hd images 다시 실행)
hd images <작업> --select marked # 대본에서 줄 앞에 [img] 붙인 줄만
```

- 어떤 줄: `images.select` = `every`(가격 줄 빼고 전부, 기본) / `marked`([img] 줄만) / `first`(장면마다 첫 줄)
- 무엇을: 상황·사람·장소만. **상품 자체는 그리지 않는다** (AI가 만든 상품 모습은 실제와 달라 오인 소지) → 가격 줄은 항상 실제 상품 사진
- 프롬프트: Claude 키가 있으면 줄 흐름에 맞춰 인물·장소가 이어지게 작성, 없으면 템플릿. 사용한 프롬프트는 `images/prompts.json`
- 직접 넣은 이미지도 같은 이름(`images/line_NNN.jpg`)이면 그대로 사용
- 점검표에 "업로드 시 '변경되거나 합성된 콘텐츠' 표시" 항목이 자동 추가됨 (실사풍 AI 이미지는 유튜브 표시 대상)

## 장면 섞기 (게시글형 · 커뮤니티 인용 · 카톡 상황극)

`script.md` 본문을 블록으로 나누면 장면마다 레이아웃이 바뀐다. 블록 표시가 없으면 전부 게시글형.

```
[post]
차 안에 과자 부스러기 보면 한숨부터 나오잖음

[community: 더쿠]                  # 스타일: 더쿠 디시 네이버카페 에펨코리아 인스티즈 다음카페 트위터 유튜브
source: https://원글주소            # 필수: 실제 글만 옮길 수 있음 (없으면 제작 거부)
captured: 2026-09-29               # 필수: 원글 확인 날짜
board: 자유게시판                   # 선택: 게시판 이름 (다음카페 스타일에서 표시)
tag: 추천                          # 선택, 여러 번 가능: 말머리 칩
title: 원글 제목
meta: 조회 1.2만 · 댓글 34          # 선택: 원글의 실제 수치만
body: 원글 본문 (여러 번 가능)
image: product                     # 선택: 본문 이미지 (product = 상품 사진, 또는 작업 폴더 안 파일)
comment: 원글 댓글 그대로 || 31     # 읽는 순서대로 하나씩 나타나고 강조됨. || 뒤는 실제 좋아요 수(선택)

[kakao: 차 청소 얘기]               # 채널이 만든 상황극. "연출된 대화" 표시는 끌 수 없음
친구: 너 차 청소 뭐로 해?
나: 요즘 핸디 청소기 하나 샀음      # '나' 는 오른쪽 노란 말풍선

[post]
지금 3만 9천9백원까지 떨어졌음
```

- 커뮤니티 장면: 닉네임은 자동으로 `익명N`, 화면에 `출처 · 사이트명`과 확인 날짜 표시(스크롤돼도 고정), 점검표에 원글 주소 목록이 들어감
- 지어낸 글·댓글을 커뮤니티 장면에 넣는 것은 가짜 후기(표시광고법 위반, 유튜브 사기성 콘텐츠 정책)에 해당하므로 쓰지 않는다
- 플랫폼 로고·화면을 복제하지 않은 일반형 디자인 (색·구조만 참고)

## 작업 폴더 구조

```
jobs/20260929_무선핸디청소기/
  deal.json        딜 정보 (가격 확인 시각 포함)
  script.md        대본 (맨 위 approved: true 여야 제작 진행)
  product.jpg      상품 사진 (직접 넣으면 그걸 사용, 없으면 딜의 image_url 다운로드)
  voice_raw.mp3    (선택) 직접 녹음/외부 TTS 파일을 넣으면 그걸 사용
  voice.wav        최종 목소리 (무음 정리됨)
  align.json       줄별 시작·끝 시각
  frames/          줄마다 화면 PNG
  render/final.mp4 완성 영상 (1080x1920, 30fps)
  render/preview_3s.gif
  publish.json     업로드 문구
  review.md        점검표 + 업로드 문구
  job.json         단계별 상태 / job.log
```

## 설정 (`config.yaml`)

채널명·색, 목소리(남/여, 속도), 자막 글자 수, 딜 필터(최소 할인율·가격대·리뷰 수), 제휴 고지 문구 등을 바꾼다.

| 항목 | 기본값 | 비고 |
|---|---|---|
| `voice.provider` | `edge` | 무료 MS 음성(인터넷 필요). `espeak` 은 오프라인 테스트용(기계음), `manual` 은 파일 직접 넣기 |
| `script.provider` | `claude` | `ANTHROPIC_API_KEY` 가 없으면 자동으로 템플릿 대본 (사람이 채워야 함) |
| `deals.min_discount_pct` | 30 | |
| `publish.disclosures` | 쿠팡 / 토스 / 기타 판매처별 문구 | 링크 주소로 판매처를 판별해 자동 선택. **비우면 제작 거부** (공정위 경제적 이해관계 표시 의무) |

## 안전장치

- 대본은 사람이 `approve` 하기 전엔 영상이 안 만들어짐 (`make --yes` 도 검사 ERROR 가 있으면 멈춤)
- 금지 표현(인사말·구독 요청·예고 문장), 정책 위험 단어, 첫 줄 상품명, 괄호 자리표시 자동 검사
- 제휴 고지 + "가격은 ○월 ○일 ○시 기준" 문구를 설명란·고정 댓글에 자동 삽입
- 같은 딜로 두 번 만들면 경고 (재사용 소재 주의)
- 대본 프롬프트: 입력에 없는 숫자·효능 지어내기 금지

## 외부 연동 상태

| 연동 | 상태 | 키 없을 때 |
|---|---|---|
| Claude 대본 생성 | 구현 (구조화 출력, 거절 시 자동 대체 모델) | 템플릿 대본 |
| 쿠팡파트너스 (골드박스·검색·딥링크) | 구현, **실제 키로 첫 호출 확인 필요** | CSV |
| 토스쇼핑 쉐어링크 (베스트·하루특가·링크 발급, 수익 10%) | 구현, **실제 키로 첫 호출 확인 필요**. 수익 링크는 `hd new` 때 그 상품만 발급 | CSV (쉐어링크 사이트에서 복사한 링크를 affiliate_url 에) |
| YouTube Data API (조회수·댓글) | 구현, **실제 키로 첫 호출 확인 필요** | CSV |
| 타입캐스트 / 일레븐랩스 / OpenAI / 구글 음성 | 구현 (요청·응답 처리는 가짜 서버로 테스트), **실제 키로 첫 호출 확인 필요** | edge(무료) |
| edge-tts 음성 (대본 전체 한 번에 합성, 단어 시각으로 자막 정렬) | 구현, **실제 호출 확인 필요** | `hd voice setup-offline` 후 sherpa(오프라인 AI 음성) / 파일 |
| Gemini / OpenAI 이미지 생성 | 구현 (응답 처리는 가짜 서버로 테스트), **실제 키로 첫 호출 확인 필요** | 상품 사진 |
| 유튜브 자동 업로드 | 아직 (OAuth 필요) | review.md 문구 복붙 |

## 테스트

```bash
pip install -e ".[dev]" && pytest -q
```
