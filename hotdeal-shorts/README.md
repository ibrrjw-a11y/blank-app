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

## 하루 작업 흐름

```bash
# 1) 딜 모으기 (둘 중 편한 것)
hd deals template                 # deals.csv 양식 생성 → 핫딜 게시판에서 본 딜을 한 줄씩 채움
hd deals import deals.csv
hd deals coupang --goldbox        # 쿠팡파트너스 키가 있으면: 오늘의 특가 + 수익 링크 자동
hd deals coupang --search "무선 청소기"

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
| `publish.disclosure` | 쿠팡 파트너스 문구 | **비우면 제작 거부** (공정위 경제적 이해관계 표시 의무) |

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
| YouTube Data API (조회수·댓글) | 구현, **실제 키로 첫 호출 확인 필요** | CSV |
| edge-tts 음성 | 구현 | espeak / 파일 |
| 유튜브 자동 업로드 | 아직 (OAuth 필요) | review.md 문구 복붙 |

## 테스트

```bash
pip install -e ".[dev]" && pytest -q
```
