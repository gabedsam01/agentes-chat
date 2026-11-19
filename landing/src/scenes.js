/* squadchat — cenas em pixel art abaixo do hero: capítulos, cartas, cartão do código aberto e rodapé.
   Mesmo motor de robôs do app; cada cena só anima quando está visível. */
import { drawAgent, idlePose, AGENT_GRADIENTS } from "./assets/vendor/agent-engine.js";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
const C = {
  sky0: "#07061a", sky1: "#120f33", sky2: "#251a4c", glow: "#6a2d58", ember: "#ffb46a", ember2: "#ff8a6e",
  ink: "#eeecfa", ink2: "#c9c6e4", muted: "#a09dc4", panel: "#1a1940", panel2: "#13122f", line: "#2c2a5a",
  hill: "#0a0820", hill2: "#16123a", ok: "#7ee2b0", moon: "#f6ead2",
};

/* ---------- utilitários de desenho numa grade lógica de 160×120 ---------- */
function stage(canvas, gw = 160, gh = 120) {
  const ctx = canvas.getContext("2d");
  const st = { canvas, ctx, gw, gh, P: 1 };
  st.resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return false;
    canvas.width = Math.round(r.width * DPR);
    canvas.height = Math.round(r.height * DPR);
    st.P = canvas.width / gw;
    ctx.imageSmoothingEnabled = false;
    return true;
  };
  st.px = (x, y, w, h, color, a = 1) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * st.P), Math.round(y * st.P), Math.ceil(w * st.P), Math.ceil(h * st.P));
    ctx.globalAlpha = 1;
  };
  st.bot = (id, x, y, size, pose) => {
    const a = AGENTS[id];
    drawAgent(ctx, x * st.P, y * st.P, size * st.P, { color: a.color, eyes: a.eyes, pose });
  };
  return st;
}
// céu pontilhado: degradê de cima para baixo com padrão Bayer
// desenhado uma vez numa tela pequena (grade lógica) e reaproveitado em cada quadro
const skyCache = new Map();
function skyBands(st, colors, until = 1) {
  const { gw, gh } = st;
  const key = colors.join() + gw + "x" + gh + until;
  let off = skyCache.get(key);
  if (!off) {
    off = document.createElement("canvas");
    off.width = gw;
    off.height = gh;
    const o = off.getContext("2d");
    const rows = Math.round(gh * until);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < gw; x++) {
        const v = (y / rows) * (colors.length - 1);
        const i = Math.min(colors.length - 1, Math.floor(v + BAYER[((y & 3) << 2) | (x & 3)]));
        o.fillStyle = colors[Math.max(0, i)];
        o.fillRect(x, y, 1, 1);
      }
    skyCache.set(key, off);
  }
  st.ctx.imageSmoothingEnabled = false;
  st.ctx.drawImage(off, 0, 0, st.canvas.width, st.canvas.height);
}
function stars(st, t, n = 26, maxY = 0.6) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(i, 3) * st.gw), y = Math.floor(hash(i, 4) * st.gh * maxY);
    const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * (0.7 + hash(i, 5)) + i));
    st.px(x, y, 1, 1, "#e7e4ff", a * 0.8);
  }
}
function roundPanel(st, x, y, w, h, fill, border) {
  st.px(x + 1, y, w - 2, h, border);
  st.px(x, y + 1, w, h - 2, border);
  st.px(x + 1, y + 1, w - 2, h - 2, fill);
}
function moon(st, cx, cy, r) {
  for (let y = -r * 3; y <= r * 3; y++)
    for (let x = -r * 3; x <= r * 3; x++) {
      const d = Math.hypot(x, y) / r;
      if (d <= 1) st.px(cx + x, cy + y, 1, 1, C.moon);
      else if (d < 2.6 && BAYER[(((cy + y) & 3) << 2) | ((cx + x) & 3)] < (1 - (d - 1) / 1.6) * 0.3) st.px(cx + x, cy + y, 1, 1, C.moon, 0.3);
    }
}
function hills(st, base, amp, color, seed) {
  for (let x = 0; x < st.gw; x++) {
    const t = x / st.gw;
    const y = Math.round(st.gh * base - st.gh * amp * (0.6 * Math.sin(t * 5.3 + seed) + 0.4 * Math.sin(t * 13.1 + seed * 2)));
    st.px(x, y, 1, st.gh - y, color);
  }
}

const AGENTS = {
  dev: { color: "indigo", eyes: "round", seed: 1 },
  produto: { color: "teal", eyes: "wide", seed: 2 },
  design: { color: "rose", eyes: "dots", seed: 3 },
  ops: { color: "green", eyes: "dots", seed: 6 },
};
const pose = (id, t, extra = {}) => Object.assign(reduce ? { turn: [0.2, 0] } : idlePose(t, AGENTS[id].seed, { expressions: [] }), extra);

/* ---------- as quatro cenas ---------- */
const SCENES = {
  // 01: três agentes trocando mensagens
  talk(st, t) {
    skyBands(st, [C.sky0, C.sky1, C.sky2, C.glow], 1);
    stars(st, t, 30, 0.5);
    hills(st, 0.86, 0.04, C.hill2, 1.3);
    const ids = ["dev", "produto", "design"];
    const xs = [22, 66, 110];
    const speaker = Math.floor(t / 1.6) % 3;
    ids.forEach((id, i) => {
      const talking = i === speaker;
      st.bot(id, xs[i], 80, 28, pose(id, t, { turn: [Math.sign(xs[speaker] - xs[i]) * 0.6, 0], writing: talking && (t % 1.6) < 0.7, expression: !talking && (t % 1.6) > 1.1 ? "happy" : undefined }));
    });
    // balão de quem fala, com linhas de texto
    const bx = Math.max(4, Math.min(160 - 64, xs[speaker] - 18));
    const grow = Math.min(1, ((t % 1.6) / 0.25));
    const bw = Math.round(60 * grow), bh = 30;
    if (bw > 6) {
      roundPanel(st, bx, 40, bw, bh, C.panel, C.line);
      st.px(xs[speaker] + 10, 40 + bh - 1, 4, 4, C.panel);
      if (grow >= 1) {
        st.px(bx + 6, 47, 18, 3, C.ember);
        st.px(bx + 26, 47, 26, 3, C.ink2);
        st.px(bx + 6, 54, 44, 3, C.ink2, 0.7);
        st.px(bx + 6, 61, 30, 3, C.ink2, 0.5);
      }
    }
  },
  // 02: o Ops espera diante do escudo até alguém aprovar
  shield(st, t) {
    skyBands(st, [C.sky0, C.sky1, C.sky2], 1);
    stars(st, t, 24, 0.7);
    const cx = 92, top = 18, h = 74;
    const pulse = reduce ? 1 : 0.6 + 0.4 * Math.sin(t * 3);
    // halo pontilhado
    for (let y = -10; y < h + 10; y++)
      for (let x = -40; x <= 40; x++) {
        const d = Math.hypot(x / 40, (y - h / 2) / (h / 2 + 10));
        if (d < 1 && d > 0.75 && BAYER[(((top + y) & 3) << 2) | ((cx + x) & 3)] < 0.35 * pulse) st.px(cx + x, top + y, 1, 1, C.ember, 0.5);
      }
    // escudo: largura diminui perto da ponta
    for (let y = 0; y < h; y++) {
      const k = y / h;
      const half = Math.round(k < 0.55 ? 28 : 28 * Math.sqrt(Math.max(0, 1 - (k - 0.55) / 0.45)));
      if (half <= 0) continue;
      st.px(cx - half, top + y, half * 2, 1, C.ember);
      if (half > 3 && y > 2 && y < h - 3) st.px(cx - half + 3, top + y, half * 2 - 6, 1, k < 0.5 ? "#2a1b4a" : "#22163f");
    }
    // visto que pulsa
    const chk = [[-10, 0], [-7, 3], [-4, 6], [-1, 3], [2, 0], [5, -3], [8, -6], [11, -9]];
    chk.forEach(([x, y]) => st.px(cx + x - 2, top + 36 + y, 4, 4, C.ok, 0.5 + 0.5 * pulse));
    // o Ops olhando para o escudo
    st.bot("ops", 18, 78, 30, pose("ops", t, { turn: [0.7, -0.4] }));
    // cartão "Aprovar?" com botão piscando
    roundPanel(st, 124, 74, 32, 24, C.panel, C.line);
    st.px(128, 79, 20, 2, C.ink2);
    st.px(128, 84, 14, 2, C.ink2, 0.6);
    st.px(128, 90, 18, 5, C.ember, reduce ? 1 : 0.55 + 0.45 * Math.sin(t * 5));
    hills(st, 1.02, 0.03, C.hill, 0.4);
  },
  // 03: o Dev no navegador e no terminal
  work(st, t) {
    skyBands(st, [C.sky0, C.sky1, C.sky2], 1);
    stars(st, t, 14, 0.25);
    // monitor
    roundPanel(st, 40, 10, 110, 74, C.panel2, C.line);
    st.px(42, 12, 106, 8, C.panel);
    [0, 1, 2].forEach((i) => st.px(46 + i * 5, 15, 3, 3, i === 0 ? C.ember2 : C.muted));
    st.px(64, 14, 70, 4, C.panel2);
    st.px(66, 15, 30, 2, C.muted, 0.7);
    // formulário sendo preenchido
    const phase = (t * 0.45) % 1;
    const fields = [[52, 30], [52, 42], [52, 54]];
    fields.forEach(([x, y], i) => {
      st.px(x, y - 4, 20, 2, C.muted, 0.7);
      roundPanel(st, x, y, 60, 7, C.panel, C.line);
      const fill = Math.max(0, Math.min(1, phase * 3 - i));
      if (fill > 0) st.px(x + 2, y + 2, Math.round(40 * fill), 3, C.ink2);
    });
    const done = phase > 0.92;
    roundPanel(st, 52, 66, 24, 9, done ? C.ok : C.ember, done ? C.ok : C.ember);
    // cursor do agente
    const fi = Math.min(2, Math.floor(phase * 3));
    const cx = phase > 0.9 ? 66 : 54 + Math.round(((phase * 3) % 1) * 40);
    const cy = phase > 0.9 ? 71 : fields[fi][1] + 4;
    [[0, 0, 1, 7], [1, 1, 1, 5], [2, 2, 1, 3], [3, 3, 1, 1]].forEach(([x, y, w, h]) => st.px(cx + x, cy + y, w, h, C.ink));
    // terminal ao lado
    roundPanel(st, 118, 30, 30, 48, "#0b0a20", C.line);
    const lines = 6;
    for (let i = 0; i < lines; i++) {
      const k = (Math.floor(t * 2) + i) % 9;
      st.px(121, 34 + i * 7, 4, 2, C.ember);
      st.px(127, 34 + i * 7, 8 + ((k * 7) % 12), 2, k % 4 === 0 ? C.ok : C.ink2, 0.8);
    }
    // o Dev digitando
    st.bot("dev", 8, 84, 32, pose("dev", t, { writing: true, turn: [0.6, -0.2] }));
    st.px(0, 116, 160, 4, C.hill);
  },
  // 04: um servidor sob a lua, ligado ao celular e ao notebook
  server(st, t) {
    skyBands(st, [C.sky0, C.sky1, C.sky2, C.glow], 1);
    stars(st, t, 34, 0.55);
    moon(st, 132, 20, 7);
    hills(st, 0.8, 0.05, C.hill2, 2.2);
    hills(st, 0.92, 0.03, C.hill, 0.9);
    // rack no alto do morro
    const rx = 70, ry = 52;
    roundPanel(st, rx, ry, 22, 38, "#1a2029", "#2c3542");
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 3; c++) {
        const on = reduce ? 1 : Math.sin(t * (2 + c) + r * 1.7 + c) > -0.3;
        st.px(rx + 4 + c * 5, ry + 5 + r * 5, 3, 2, on ? C.ok : "#1f3a30");
      }
    // celular e notebook
    roundPanel(st, 12, 70, 14, 24, C.panel, C.ink2);
    st.px(14, 73, 10, 16, "#0b0a20");
    st.px(16, 76, 6, 2, C.ember);
    roundPanel(st, 126, 76, 26, 16, C.panel, C.ink2);
    st.px(128, 78, 22, 12, "#0b0a20");
    st.px(122, 92, 34, 3, C.ink2);
    st.px(131, 81, 12, 2, C.ember);
    // ligações pontilhadas com um pulso viajando
    const links = [[[rx, ry + 18], [26, 80]], [[rx + 22, ry + 18], [126, 84]]];
    links.forEach(([[ax, ay], [bx, by]], i) => {
      const len = Math.hypot(bx - ax, by - ay);
      for (let d = 0; d < len; d += 3) st.px(ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len, 1, 1, C.muted, 0.7);
      const q = reduce ? 0.5 : ((t * 0.6 + i * 0.5) % 1);
      st.px(ax + (bx - ax) * q - 1, ay + (by - ay) * q - 1, 3, 3, C.ember);
    });
    st.bot("ops", 94, 72, 18, pose("ops", t, { turn: [-0.5, 0] }));
  },
};

/* ---------- laço único para as cenas visíveis ---------- */
const live = new Set();
let raf = 0, last = 0, clock = 0, acc = 0;
function frame(now) {
  raf = 0;
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (document.hidden || !live.size) return;
  clock += dt;
  acc += dt;
  if (acc >= 0.11) { // ~9 fps: pixel art não precisa de mais
    acc = 0;
    live.forEach((s) => s.draw(clock));
  }
  raf = requestAnimationFrame(frame);
}
function wake() { if (!raf && live.size && !reduce && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
document.addEventListener("visibilitychange", wake);

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    const s = e.target.__scene;
    if (!s) return;
    if (e.isIntersecting) { live.add(s); s.draw(clock); } else live.delete(s);
  });
  wake();
}, { rootMargin: "80px 0px" });

function mountScene(canvas, drawFn, gw, gh) {
  const st = stage(canvas, gw, gh);
  const s = { draw: (t) => { st.ctx.clearRect(0, 0, canvas.width, canvas.height); drawFn(st, reduce ? 2 : t); } };
  canvas.__scene = s;
  const ro = new ResizeObserver(() => { if (st.resize()) s.draw(clock); });
  ro.observe(canvas);
  io.observe(canvas);
}

document.querySelectorAll("canvas[data-scene]").forEach((c) => {
  const fn = SCENES[c.dataset.scene];
  if (fn) mountScene(c, fn, 160, 120);
});

/* ---------- robôs das cartas: desenhados uma vez ---------- */
document.querySelectorAll("canvas[data-bot]").forEach((c, i) => {
  const ctx = c.getContext("2d");
  const S = c.width;
  drawAgent(ctx, S * 0.1, S * 0.1, S * 0.8, { color: c.dataset.bot, eyes: c.dataset.eyes || "round", pose: { turn: [((i % 5) - 2) * 0.25, -0.15] } });
});

/* ---------- robôs espiando por cima do cartão do código aberto ---------- */
document.querySelectorAll("canvas[data-peek]").forEach((c) => {
  const order = [["green", "dots"], ["amber", "wide"], ["sky", "round"], ["rose", "dots"], ["teal", "wide"], ["indigo", "round"]];
  mountScene(c, (st, t) => {
    const W = st.canvas.width, H = st.canvas.height;
    // cabe sempre: no celular os robôs encolhem para caber os seis
    const size = Math.min(H * 1.05, (W * 0.92) / (order.length + (order.length - 1) * 0.18));
    const gap = size * 0.18;
    const total = order.length * size + (order.length - 1) * gap;
    const x0 = W - total - W * 0.04;
    order.forEach(([color, eyes], i) => {
      const bob = reduce ? 0 : Math.max(0, Math.sin(t * 1.4 + i * 0.9)) * H * 0.12;
      const p = reduce ? { turn: [0.2, -0.3] } : idlePose(t, i + 11, { expressions: [] });
      p.turn = [p.turn[0], -0.35];
      drawAgent(st.ctx, x0 + i * (size + gap), H - size * 0.62 - bob, size, { color, eyes, pose: p });
    });
  }, 1, 1);
});

/* ---------- morros do rodapé: desenhados uma vez (e de novo ao redimensionar) ---------- */
document.querySelectorAll("canvas[data-skyline]").forEach((c) => {
  const ctx = c.getContext("2d");
  const draw = () => {
    const r = c.getBoundingClientRect();
    if (!r.width) return;
    const gw = Math.round(Math.min(420, Math.max(200, r.width / 4)));
    const gh = Math.max(30, Math.round((gw * r.height) / r.width));
    c.width = gw;
    c.height = gh;
    const img = ctx.createImageData(gw, gh);
    const pal = ["#07061a", "#0e0c2a", "#1a1440", "#331d4f", "#652b55", "#b44a52", "#ff9058"].map((h) => [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16)));
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const dx = (x - gw * 0.5) / (gw * 0.6), dy = (y - gh) / (gh * 0.9);
        const v = Math.exp(-(dx * dx + dy * dy)) * 0.95 + (y / gh) * 0.15;
        const i = Math.max(0, Math.min(pal.length - 1, Math.floor(v * (pal.length - 1) + BAYER[((y & 3) << 2) | (x & 3)] - 0.5)));
        const o = (y * gw + x) * 4;
        img.data[o] = pal[i][0]; img.data[o + 1] = pal[i][1]; img.data[o + 2] = pal[i][2]; img.data[o + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < gw / 6; i++) { ctx.fillStyle = "rgba(231,228,255," + (0.3 + hash(i, 9) * 0.5) + ")"; ctx.fillRect(Math.floor(hash(i, 7) * gw), Math.floor(hash(i, 8) * gh * 0.45), 1, 1); }
    const hill = (base, amp, color, seed) => {
      ctx.fillStyle = color;
      for (let x = 0; x < gw; x++) {
        const t = x / gw;
        const y = Math.round(gh * base - gh * amp * (0.6 * Math.sin(t * 4.1 + seed) + 0.4 * Math.sin(t * 11.7 + seed * 2)));
        ctx.fillRect(x, y, 1, gh - y);
      }
    };
    hill(0.62, 0.16, "#16123a", 0.8);
    hill(0.8, 0.12, "#0a0820", 2.1);
    for (let i = 0; i < gw / 8; i++) {
      const x = Math.floor(hash(i, 21) * gw);
      const t = x / gw;
      const y = Math.round(gh * 0.8 - gh * 0.12 * (0.6 * Math.sin(t * 4.1 + 2.1) + 0.4 * Math.sin(t * 11.7 + 4.2))) + 3 + Math.floor(hash(i, 22) * 6);
      if (y < gh - 1) { ctx.fillStyle = hash(i, 23) > 0.5 ? "#ffb46a" : "#ffd59a"; ctx.fillRect(x, y, hash(i, 24) > 0.6 ? 2 : 1, 1); }
    }
  };
  new ResizeObserver(draw).observe(c);
});
