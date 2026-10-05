// 팀 나누기 계산 (화면과 무관한 순수 함수)
// 조건: 팀 크기 균등, 팀장 1팀 1명, 같은 팀 금지/필수 쌍, 지난번 같은 팀이었던 쌍 줄이기
// 방법: 무작위 시작 → 두 사람 맞바꾸기 언덕 오르기 → 여러 번 다시 시작해서 가장 좋은 판을 고른다

export function secureRandom() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  } catch {
    return Math.random();
  }
}

export function shuffleArr(arr, rand = secureRandom) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// n 명을 k 팀으로: 앞 팀부터 한 명씩 더
export function teamSizes(n, k) {
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

// "팀당 p명" → 팀 수 (남는 사람은 앞 팀에 한 명씩 더)
export const teamsFromPer = (n, p) => Math.max(1, Math.floor(n / Math.max(1, p)));

export function makeTeams({ names, k, avoid = [], together = [], leaders = [], prev = null, rand = secureRandom }) {
  const n = names.length;
  const idx = new Map(names.map((nm, i) => [nm, i]));
  const pairIdx = (pairs) => pairs.map(([a, b]) => [idx.get(a), idx.get(b)]).filter(([a, b]) => a != null && b != null && a !== b);
  const AV = pairIdx(avoid);
  const TG = pairIdx(together);
  const prevPairs = [];
  if (prev && prev.length) {
    for (const team of prev) {
      const ids = team.map((nm) => idx.get(nm)).filter((x) => x != null);
      for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) prevPairs.push([ids[a], ids[b]]);
    }
  }
  const leadIds = shuffleArr(leaders.map((nm) => idx.get(nm)).filter((x) => x != null), rand).slice(0, k);
  const isLead = new Set(leadIds);
  const sizes = shuffleArr(teamSizes(n, k), rand);

  // 사람마다 걸린 조건 목록: [상대, 벌점, 종류(1=같은 팀이면 벌점, 0=다른 팀이면 벌점)]
  const adj = Array.from({ length: n }, () => []);
  const link = (a, b, w, kind) => {
    adj[a].push([b, w, kind]);
    adj[b].push([a, w, kind]);
  };
  AV.forEach(([a, b]) => link(a, b, 100, 1));
  TG.forEach(([a, b]) => link(a, b, 100, 0));
  prevPairs.forEach(([a, b]) => link(a, b, 1, 1));
  const pc = (i, team) => {
    let c = 0;
    for (const [j, w, kind] of adj[i]) if ((team[i] === team[j]) === (kind === 1)) c += w;
    return c;
  };
  const cost = (team) => {
    let c = 0;
    for (let i = 0; i < n; i++) c += pc(i, team);
    return c / 2;
  };

  let best = null;
  let bestCost = Infinity;
  const restarts = n <= 12 ? 12 : n <= 30 ? 8 : 6;
  const iters = Math.max(400, n * 80);
  for (let r = 0; r < restarts; r++) {
    const team = new Array(n).fill(-1);
    leadIds.forEach((id, t) => (team[id] = t));
    const fill = sizes.map((s, t) => s - (t < leadIds.length ? 1 : 0));
    const rest = shuffleArr([...Array(n).keys()].filter((i) => !isLead.has(i)), rand);
    let t = 0;
    for (const i of rest) {
      while (fill[t] <= 0) t++;
      team[i] = t;
      fill[t]--;
    }
    let c = cost(team);
    const movable = rest;
    for (let it = 0; it < iters && c > 0 && movable.length > 1; it++) {
      const a = movable[Math.floor(rand() * movable.length)];
      const b = movable[Math.floor(rand() * movable.length)];
      if (team[a] === team[b]) continue;
      const before = pc(a, team) + pc(b, team);
      [team[a], team[b]] = [team[b], team[a]];
      const d = pc(a, team) + pc(b, team) - before;
      if (d <= 0) c += d;
      else [team[a], team[b]] = [team[b], team[a]];
    }
    if (c < bestCost || (c === bestCost && rand() < 0.5)) {
      bestCost = c;
      best = team.slice();
    }
    if (bestCost === 0) break;
  }

  const teams = Array.from({ length: k }, () => []);
  // 팀장이 맨 앞, 나머지는 섞은 순서
  leadIds.forEach((id, t) => teams[t].push(names[id]));
  shuffleArr([...Array(n).keys()].filter((i) => !isLead.has(i)), rand).forEach((i) => teams[best[i]].push(names[i]));
  const out = (team) => team;
  const finalTeam = best;
  const issues = {
    avoid: AV.filter(([a, b]) => finalTeam[a] === finalTeam[b]).map(([a, b]) => [names[a], names[b]]),
    together: TG.filter(([a, b]) => finalTeam[a] !== finalTeam[b]).map(([a, b]) => [names[a], names[b]]),
    repeat: prevPairs.filter(([a, b]) => finalTeam[a] === finalTeam[b]).length,
    prevTotal: prevPairs.length,
  };
  return { teams: out(teams), leaders: leadIds.map((id) => names[id]), issues };
}

// 딜 순서: 팀장 먼저 한 장씩, 그다음 1팀→2팀→… 돌아가며 한 장씩 (실제 카드 돌리듯)
export function dealOrder(teams) {
  const order = [];
  const max = Math.max(...teams.map((t) => t.length));
  for (let s = 0; s < max; s++) teams.forEach((t, ti) => s < t.length && order.push({ team: ti, slot: s, name: t[s] }));
  return order;
}
