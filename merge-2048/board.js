// 2048 규칙 + 나무 타일 렌더러. 첫 화면 데모와 실제 게임이 같은 코드를 쓴다.
export const SIZE = 4;
const DIRS = {
  left: [0, -1],
  right: [0, 1],
  up: [-1, 0],
  down: [1, 0],
};

let uid = 1;
const tile = (v, r, c) => ({ id: uid++, v, r, c });

export class Game {
  constructor(rand = Math.random) {
    this.rand = rand;
    this.reset();
  }

  reset() {
    this.cells = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    this.score = 0;
    this.won = false;
    this.over = false;
    this.spawn();
    this.spawn();
  }

  // [[v|0,...]] 형태로 저장/복원
  toGrid() {
    return this.cells.map((row) => row.map((t) => (t ? t.v : 0)));
  }
  load(grid, score = 0) {
    this.cells = grid.map((row, r) => row.map((v, c) => (v ? tile(v, r, c) : null)));
    this.score = score;
    this.over = !this.canMove();
  }

  get tiles() {
    return this.cells.flat().filter(Boolean);
  }
  get max() {
    return Math.max(0, ...this.tiles.map((t) => t.v));
  }

  empty() {
    const out = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!this.cells[r][c]) out.push([r, c]);
    return out;
  }

  spawn() {
    const e = this.empty();
    if (!e.length) return null;
    const [r, c] = e[Math.floor(this.rand() * e.length)];
    // 90% 는 2, 10% 는 4
    const t = tile(this.rand() < 0.9 ? 2 : 4, r, c);
    this.cells[r][c] = t;
    return t;
  }

  canMove() {
    if (this.empty().length) return true;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const v = this.cells[r][c].v;
        if ((c + 1 < SIZE && this.cells[r][c + 1].v === v) || (r + 1 < SIZE && this.cells[r + 1][c].v === v)) return true;
      }
    return false;
  }

  // 이동 결과를 미리 계산 (데모 AI 용, 상태는 바꾸지 않음)
  peek(dir) {
    const g = new Game(this.rand);
    g.load(this.toGrid(), this.score);
    const res = g.move(dir, { spawn: false });
    return res;
  }

  move(dir, { spawn = true } = {}) {
    const [dr, dc] = DIRS[dir];
    const order = [...Array(SIZE).keys()];
    const rows = dr === 1 ? order.slice().reverse() : order;
    const cols = dc === 1 ? order.slice().reverse() : order;
    const merged = new Set();
    const merges = []; // { into: tile, from: tile }
    const removed = [];
    let moved = false;
    let gained = 0;
    for (const r of rows) {
      for (const c of cols) {
        const t = this.cells[r][c];
        if (!t) continue;
        let nr = r;
        let nc = c;
        while (true) {
          const tr = nr + dr;
          const tc = nc + dc;
          if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE) break;
          const o = this.cells[tr][tc];
          if (!o) {
            nr = tr;
            nc = tc;
            continue;
          }
          if (o.v === t.v && !merged.has(o.id)) {
            // 합치기: t 가 o 자리로 들어가 부딪친다
            this.cells[r][c] = null;
            t.r = tr;
            t.c = tc;
            removed.push(t);
            o.v *= 2;
            merged.add(o.id);
            merges.push(o);
            gained += o.v;
            moved = true;
            if (o.v === 2048) this.won = true;
            nr = null;
          }
          break;
        }
        if (nr === null) continue;
        if (nr !== r || nc !== c) {
          this.cells[r][c] = null;
          this.cells[nr][nc] = t;
          t.r = nr;
          t.c = nc;
          moved = true;
        }
      }
    }
    if (!moved) return { moved: false };
    this.score += gained;
    const born = spawn ? this.spawn() : null;
    this.over = !this.canMove();
    return { moved: true, gained, merges, removed, born };
  }
}

/* ---------- 렌더러 ---------- */
export class BoardView {
  constructor(el) {
    this.el = el;
    el.classList.add("tray");
    el.innerHTML = `<div class="tray__cells">${Array.from({ length: SIZE * SIZE }, () => "<i></i>").join("")}</div><div class="tray__tiles"></div>`;
    this.layer = el.querySelector(".tray__tiles");
    this.nodes = new Map();
    this.ghosts = [];
  }

  node(t) {
    let n = this.nodes.get(t.id);
    if (!n) {
      n = document.createElement("div");
      n.className = "tile";
      n.innerHTML = `<span class="tile__face"><b></b></span>`;
      n.face = n.firstChild;
      n.num = n.querySelector("b");
      // 나뭇결 위치를 타일마다 다르게
      n.style.setProperty("--gx", `${Math.floor(Math.random() * 300)}px`);
      n.style.setProperty("--gy", `${Math.floor(Math.random() * 300)}px`);
      this.layer.appendChild(n);
      this.nodes.set(t.id, n);
    }
    return n;
  }

  place(n, t) {
    n.style.setProperty("--r", t.r);
    n.style.setProperty("--c", t.c);
  }

  label(n, v) {
    n.dataset.v = v > 2048 ? "big" : v;
    n.dataset.d = String(v).length;
    n.num.textContent = v;
  }

  clearGhosts() {
    this.ghosts.forEach((g) => g.remove());
    this.ghosts = [];
  }

  // 전체 다시 그리기 (불러오기, 새 판)
  sync(game, { pop = true } = {}) {
    this.clearGhosts();
    const live = new Set();
    for (const t of game.tiles) {
      const n = this.node(t);
      live.add(t.id);
      this.label(n, t.v);
      this.place(n, t);
      n.classList.remove("is-merged", "is-late");
      if (pop) {
        n.classList.remove("is-new");
        void n.offsetWidth;
        n.classList.add("is-new");
      }
    }
    for (const [id, n] of this.nodes) if (!live.has(id)) {
      n.remove();
      this.nodes.delete(id);
    }
  }

  // 한 번 민 결과를 애니메이션
  apply(res) {
    this.clearGhosts();
    if (!res.moved) {
      this.el.classList.remove("is-stuck");
      void this.el.offsetWidth;
      this.el.classList.add("is-stuck");
      return;
    }
    // 합쳐지는 쪽 타일: 목표 칸으로 미끄러진 뒤 사라진다
    for (const t of res.removed) {
      const n = this.nodes.get(t.id);
      if (!n) continue;
      this.nodes.delete(t.id);
      n.classList.add("is-ghost");
      this.place(n, t);
      this.ghosts.push(n);
      setTimeout(() => {
        n.remove();
        this.ghosts = this.ghosts.filter((g) => g !== n);
      }, 140);
    }
    for (const [id, n] of this.nodes) {
      const t = this.find(id);
      if (t) this.place(n, t);
    }
    // 부딪침: 살짝 늦게 숫자가 바뀌며 스프링으로 튄다
    for (const t of res.merges) {
      const n = this.nodes.get(t.id);
      if (!n) continue;
      n.classList.remove("is-merged", "is-new", "is-late");
      setTimeout(() => {
        this.label(n, t.v);
        void n.offsetWidth;
        n.classList.add("is-merged");
      }, 95);
    }
    if (res.born) {
      const n = this.node(res.born);
      this.label(n, res.born.v);
      this.place(n, res.born);
      n.classList.add("is-new", "is-late");
    }
    const big = res.merges.reduce((m, t) => Math.max(m, t.v), 0);
    if (big >= 128) {
      this.el.classList.remove("is-thump");
      void this.el.offsetWidth;
      this.el.classList.add("is-thump");
    }
  }

  bind(game) {
    this.game = game;
  }
  find(id) {
    return this.game?.tiles.find((t) => t.id === id);
  }
}

// 데모용: 아래·왼쪽 모서리를 지키는 단순한 전략
export function autoMove(game) {
  const pref = ["down", "left", "right", "up"];
  let best = null;
  let bestScore = -1;
  for (const d of pref.slice(0, 3)) {
    const r = game.peek(d);
    if (!r.moved) continue;
    const s = r.gained + (d === "down" ? 3 : d === "left" ? 2 : 0) + Math.random() * 2;
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  return best || (game.peek("up").moved ? "up" : null);
}

// 나뭇결 텍스처 (캔버스 → data URL). 결을 어두운 반투명 선으로 그려서 어떤 바탕색 위에도 얹을 수 있다.
export function grainURL({ size = 300, lines = 70, seed = 3, knots = 2 } = {}) {
  try {
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d");
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    // 가로·세로로 이어 붙여도 이음매가 안 보이게 주기를 size 에 맞춘다
    const TAU = Math.PI * 2;
    for (let i = 0; i < lines; i++) {
      const y0 = rnd() * size;
      const amp = 1 + rnd() * 3.5;
      const k = 1 + Math.floor(rnd() * 2);
      const ph = rnd() * TAU;
      ctx.strokeStyle = `rgba(50,24,6,${0.05 + rnd() * 0.18})`;
      ctx.lineWidth = 0.4 + rnd() * 2.2;
      for (const oy of [-size, 0, size]) {
        ctx.beginPath();
        for (let x = 0; x <= size; x += 4) {
          const y = oy + y0 + Math.sin((x / size) * TAU * k + ph) * amp + Math.sin((x / size) * TAU * 9 + i) * 0.8;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    for (let kk = 0; kk < knots; kk++) {
      const kx = rnd() * size;
      const ky = rnd() * size;
      for (const [ox, oy] of [[0, 0], [-size, 0], [size, 0], [0, -size], [0, size]]) {
        for (let r = 2; r < 18; r += 2.5) {
          ctx.strokeStyle = `rgba(50,24,6,${0.22 - r * 0.01})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(kx + ox, ky + oy, r * 2.2, r * 0.7, 0, 0, TAU);
          ctx.stroke();
        }
      }
    }
    // 미세한 섬유 노이즈
    const img = ctx.getImageData(0, 0, size, size);
    for (let p = 0; p < img.data.length; p += 4) {
      if (rnd() > 0.7) {
        img.data[p] = 60;
        img.data[p + 1] = 30;
        img.data[p + 2] = 8;
        img.data[p + 3] = Math.max(img.data[p + 3], rnd() * 22);
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL("image/png");
  } catch {
    return "";
  }
}
