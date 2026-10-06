// 점수 → "뇌 나이" 환산
// ─────────────────────────────────────────────────────────────
// 여기 있는 곡선은 전부 재미용 경험칙(rough entertainment heuristic)이에요.
// 의학·심리학 규준(norm)이 아니고, 연령별 표본으로 보정한 값도 아니에요.
// 원칙: (1) 성적이 좋을수록 나이가 단조롭게 낮아지고 (2) 흔히 알려진 경향과 크게 어긋나지 않게
// 앵커 몇 개를 찍고 그 사이를 직선으로 잇는다(piecewise linear). 범위 밖은 15세/80세로 고정.
// ─────────────────────────────────────────────────────────────

export const KEYS = ["rt", "mem", "color", "hear", "math"];

export const META = {
  rt: { code: "CH1", name: "반응속도", short: "반응", better: "low", fmt: (v) => `${Math.round(v)}ms` },
  mem: { code: "CH2", name: "순간기억", short: "기억", better: "high", fmt: (v) => `${v}칸` },
  color: { code: "CH3", name: "색 구분", short: "색감", better: "high", fmt: (v) => `${v}단계` },
  hear: {
    code: "CH4",
    name: "고주파 청력",
    short: "청력",
    better: "high",
    fmt: (v) => (v ? `${(v / 1000).toLocaleString("ko-KR")}kHz` : "건너뜀"),
  },
  math: { code: "CH5", name: "순간계산", short: "계산", better: "high", fmt: (v) => `${v}문제` },
  // 동체시력은 따로 하는 측정 전용. 나이 환산 곡선이 없어 종합 뇌 나이(KEYS)에는 넣지 않는다
  dyn: { code: "CH6", name: "동체시력", short: "동체", better: "high", fmt: (v) => `${v}단계` },
};

// [측정값, 나이] 앵커. x 오름차순.
const CURVES = {
  // 반응속도(ms, 가장 느린 1회 제외 평균 + 실수 페널티).
  // 대략 250~260ms ≈ 20세, 이후 1년에 2~2.5ms 정도 느려진다고 가정.
  // 스마트폰은 터치/화면 지연(수십 ms)이 더해지므로 PC 측정치보다 10ms 정도 너그럽게 잡았다.
  rt: [[200, 15], [260, 20], [310, 40], [360, 58], [420, 75], [480, 80]],
  // 순간기억(따라 누른 최대 길이). 공간 순서 기억 폭은 젊은 성인 기준 대략 6~7칸이라는 통념에 맞춤.
  mem: [[2, 80], [3, 74], [4, 62], [5, 50], [6, 38], [7, 28], [8, 21], [9, 17], [10, 15]],
  // 색 구분(30초 동안 통과한 단계 수). 게임 난이도에 맞춘 임의 곡선.
  color: [[2, 80], [6, 72], [10, 60], [14, 48], [18, 36], [22, 27], [26, 20], [30, 15]],
  // 고주파 청력(들린 최고 주파수, Hz). 흔히 쓰이는 노인성 난청 경험칙에 맞춤:
  // 17kHz 이상 ≈ 25세 미만, 15kHz ≈ 40세 전후, 12kHz ≈ 50세 이상.
  hear: [[7000, 80], [8000, 72], [10000, 62], [12000, 52], [14000, 45], [15000, 40], [16000, 32], [17000, 24], [18000, 20], [19000, 15]],
  // 순간계산(30초 동안 맞힌 개수). 게임 난이도에 맞춘 임의 곡선.
  math: [[0, 80], [3, 72], [6, 60], [9, 48], [12, 37], [15, 28], [18, 21], [22, 15]],
};

// 종합 가중치. 청력은 기기 영향이 커서 조금 낮게. 건너뛰면 0, 무음 문제에 "들려요"를 누르면 절반.
const WEIGHTS = { rt: 0.25, mem: 0.2, color: 0.2, hear: 0.15, math: 0.2 };

export const AGE_MIN = 15;
export const AGE_MAX = 80;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function interp(x, pts) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) {
      const [x0, y0] = pts[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

export function ageFor(key, raw) {
  if (raw == null || !CURVES[key]) return null;
  return clamp(interp(raw, CURVES[key]), AGE_MIN, AGE_MAX);
}

// 레이더 차트용 0~100 능력치 (15세 = 100, 80세 = 0)
export const skillFromAge = (age) => (age == null ? null : Math.round(clamp(((AGE_MAX - age) / (AGE_MAX - AGE_MIN)) * 100, 0, 100)));

// raw: { rt, mem, color, hear(null=건너뜀), math }, flags: { hearUnsure }
export function computeAll(raw, flags = {}) {
  const ages = {};
  const skills = {};
  let sum = 0;
  let wsum = 0;
  KEYS.forEach((k) => {
    const a = ageFor(k, raw[k]);
    ages[k] = a == null ? null : Math.round(a);
    skills[k] = skillFromAge(a);
    if (a == null) return;
    const w = WEIGHTS[k] * (k === "hear" && flags.hearUnsure ? 0.5 : 1);
    sum += a * w;
    wsum += w;
  });
  const brain = wsum ? Math.round(clamp(sum / wsum, AGE_MIN, AGE_MAX)) : null;
  const played = KEYS.filter((k) => skills[k] != null);
  const sorted = played.slice().sort((a, b) => skills[b] - skills[a]);
  return { ages, skills, brain, best: sorted[0], weak: sorted[sorted.length - 1] };
}

export function ageBand(age) {
  if (age < 20) return "10대";
  const d = Math.floor(age / 10) * 10;
  const r = age % 10;
  return `${d}대 ${r <= 3 ? "초반" : r <= 6 ? "중반" : "후반"}`;
}

// 결과 화면 팁 (가볍게, 의학적 조언 아님)
export const TIPS = {
  rt: {
    best: "순발력이 좋아요. 게임이나 운동에서 빛나는 타입이에요.",
    weak: "피곤하거나 잠이 부족하면 반응이 느려지기 쉬워요. 푹 쉬고 다시 재보세요.",
  },
  mem: {
    best: "순서를 척척 기억해요. 전화번호도 한 번에 외우는 타입!",
    weak: "3칸씩 끊어서 덩어리로 외워보세요. 훨씬 쉬워져요.",
  },
  color: {
    best: "눈썰미가 좋아요. 미세한 차이도 금방 잡아내요.",
    weak: "화면 밝기를 올리고 밝은 곳에서 해보면 결과가 달라질 수 있어요.",
  },
  hear: {
    best: "높은 소리까지 잘 들었어요. 기기와 이어폰에 따라 달라질 수 있어요.",
    weak: "스마트폰 스피커는 높은 소리를 잘 못 내요. 이어폰으로 다시 해보세요.",
  },
  math: {
    best: "암산이 빨라요. 더치페이 계산은 맡겨도 되겠어요.",
    weak: "장 볼 때 합계를 먼저 어림해보는 습관이 재밌는 연습이 돼요.",
  },
};
