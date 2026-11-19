/* squadchat — hero: o enxame de agentes trabalhando nas telas do app.
   Robôs desenhados pelo mesmo motor do app (assets/vendor/agent-engine.js). Sem WebGL:
   céu em canvas de baixa resolução ampliado em pixel art, telas em HTML, voos num canvas por cima. */
import { drawAgent, idlePose, AGENT_GRADIENTS } from "./assets/vendor/agent-engine.js";

const $ = (id) => document.getElementById(id);
const hero = $("hero");
const swarm = $("swarm");
if (hero && swarm) boot();

function boot() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- o time ---------- */
  const AGENTS = [
    { id: "dev", name: "Dev", color: "indigo", eyes: "round", seed: 1 },
    { id: "produto", name: "Produto", color: "teal", eyes: "wide", seed: 2 },
    { id: "design", name: "Design", color: "rose", eyes: "dots", seed: 3 },
    { id: "suporte", name: "Suporte", color: "sky", eyes: "round", seed: 4 },
    { id: "qa", name: "QA", color: "amber", eyes: "wide", seed: 5 },
    { id: "ops", name: "Ops", color: "green", eyes: "dots", seed: 6 },
  ];
  const byId = {};
  AGENTS.forEach((a) => {
    byId[a.id] = Object.assign(a, { status: "", busy: false, typingUntil: -1, expr: null, exprUntil: -1, screens: new Set() });
  });
  const tint = (id) => AGENT_GRADIENTS[byId[id].color][0];

  /* ---------- relógio da cena: só anda quando não está pausado ---------- */
  let clock = 0;
  let paused = false;
  let visible = true;
  const queue = [];
  function later(ms, fn) {
    if (reduce) { fn(); return; }
    queue.push({ at: clock + ms / 1000, fn });
  }
  function runDue() {
    queue.sort((a, b) => a.at - b.at);
    while (queue.length && queue[0].at <= clock) queue.shift().fn();
  }

  /* ---------- robôs (canvas pequenos, redesenhados a ~20 fps) ---------- */
  const bots = new Set();
  function bot(id, size) {
    const c = document.createElement("canvas");
    c.className = "bot";
    c.width = c.height = Math.round(size * DPR);
    c.style.width = c.style.height = size + "px";
    c.setAttribute("aria-hidden", "true");
    const b = { c, ctx: c.getContext("2d"), id, size };
    bots.add(b);
    drawBot(b);
    return c;
  }
  function poseFor(a, extra) {
    const pose = reduce ? { turn: [0.25, 0] } : idlePose(clock, a.seed, { active: a.busy, expressions: [] });
    if (clock < a.typingUntil) pose.writing = true;
    if (a.expr && (reduce || clock < a.exprUntil)) pose.expression = a.expr;
    return Object.assign(pose, extra);
  }
  function drawBot(b) {
    const a = byId[b.id];
    const S = b.c.width;
    b.ctx.clearRect(0, 0, S, S);
    const pad = S * 0.08;
    drawAgent(b.ctx, pad, pad, S - pad * 2, { color: a.color, eyes: a.eyes, pose: poseFor(a) });
  }
  function drawBots() {
    bots.forEach((b) => {
      if (!b.c.isConnected) { bots.delete(b); return; }
      drawBot(b);
    });
  }
  function express(id, expr, secs = 2.2) {
    const a = byId[id];
    a.expr = expr;
    a.exprUntil = clock + secs;
  }

  /* ---------- barra lateral: agentes e o que estão fazendo ---------- */
  const list = $("agent-list");
  const rows = {};
  AGENTS.forEach((a) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "agent-row";
    btn.setAttribute("aria-pressed", "false");
    btn.dataset.id = a.id;
    btn.appendChild(bot(a.id, 30));
    const who = document.createElement("span");
    who.className = "who";
    who.innerHTML = `<span class="nm"></span><span class="st od-truncate"></span>`;
    who.querySelector(".nm").textContent = a.name;
    btn.appendChild(who);
    list.appendChild(btn);
    rows[a.id] = btn;
  });
  function setStatus(id, text, busy = false) {
    const a = byId[id];
    a.status = text;
    a.busy = busy;
    const st = rows[id].querySelector(".st");
    st.textContent = text;
    st.title = text;
    st.classList.toggle("is-busy", busy);
    rows[id].setAttribute("aria-label", `${a.name}: ${text}`);
    if (focusId === id) showFocus();
  }

  /* ---------- foco num agente ---------- */
  let focusId = null;
  const pulse = $("hero-pulse");
  const pulseText = $("pulse-text");
  pulse.removeAttribute("aria-live");
  const srStatus = document.createElement("p");
  srStatus.className = "visually-hidden";
  srStatus.setAttribute("aria-live", "polite");
  hero.appendChild(srStatus);
  const SCREENS = ["scr-chan", "scr-thread", "scr-term", "scr-call", "scr-tasks", "scr-prop", "scr-approve"];
  function touch(id, screen) { byId[id].screens.add(screen); if (focusId === id) showFocus(); }
  function showFocus() {
    swarm.classList.toggle("has-focus", !!focusId);
    SCREENS.forEach((s) => {
      const el = $(s);
      el.classList.toggle("is-focus", !!focusId && (byId[focusId].screens.has(s) || s === "scr-chan"));
    });
    // os dois lados de um card que vira seguem o lado visível
    ["flip-a", "flip-b"].forEach((f) => {
      const card = $(f);
      const on = [...card.querySelectorAll(".scr")].some((s) => s.classList.contains("is-focus"));
      card.querySelectorAll(".scr").forEach((s) => s.classList.toggle("is-focus", on));
    });
    updatePulse();
    if (focusId) srStatus.textContent = `${byId[focusId].name}: ${byId[focusId].status}`;
  }
  list.addEventListener("click", (e) => {
    const b = e.target.closest(".agent-row");
    if (!b) return;
    focusId = focusId === b.dataset.id ? null : b.dataset.id;
    Object.values(rows).forEach((r) => r.setAttribute("aria-pressed", String(r.dataset.id === focusId)));
    showFocus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && focusId) { focusId = null; Object.values(rows).forEach((r) => r.setAttribute("aria-pressed", "false")); showFocus(); }
  });

  /* ---------- estado que alimenta a linha de status ---------- */
  const S = { threads: 0, call: false, approvals: 0 };
  function updatePulse() {
    if (focusId) {
      const a = byId[focusId];
      pulseText.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = a.name;
      pulseText.append(strong, ` · ${a.status}`);
      return;
    }
    const parts = ["6 agentes online"];
    parts.push(S.threads ? `${S.threads} thread aberta` : "nenhuma thread aberta");
    if (S.call) parts.push("1 ligação");
    if (S.approvals) parts.push(`${S.approvals} aprovação esperando você`);
    pulseText.textContent = parts.join(" · ");
    $("side-approvals").textContent = String(S.approvals);
  }

  /* ---------- canal ---------- */
  const msgs = $("chan-msgs");
  const typingEl = $("chan-typing");
  let minute = 14 * 60 + 2;
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rich = (s) => esc(s).replace(/@([A-Za-zÀ-ú]+)/g, '<span class="at">@$1</span>').replace(/`([^`]+)`/g, "<code>$1</code>");
  function messageEl(id, text, chip, small) {
    const li = document.createElement("li");
    li.className = "msg2" + (reduce ? "" : " is-new");
    li.appendChild(bot(id, small ? 28 : 32));
    const body = document.createElement("div");
    body.innerHTML =
      `<div class="msg2-head"><span class="msg2-name"></span><time class="msg2-time">${hhmm(minute)}</time></div>` +
      `<p class="msg2-text">${rich(text)}</p>` +
      (chip ? `<span class="msg2-chip"><svg class="od-icon" aria-hidden="true"><use href="#${chip.icon}"/></svg>${esc(chip.label)}</span>` : "");
    body.querySelector(".msg2-name").textContent = byId[id].name;
    li.appendChild(body);
    return li;
  }
  function post(id, text, chip) {
    typingEl.textContent = "";
    const li = messageEl(id, text, chip);
    msgs.appendChild(li);
    while (msgs.children.length > 5) msgs.removeChild(msgs.firstElementChild);
    msgs.scrollTop = msgs.scrollHeight;
    minute += 1;
    touch(id, "scr-chan");
    express(id, null, 0);
    return li;
  }
  function typing(id, ms) {
    byId[id].typingUntil = clock + ms / 1000;
    typingEl.innerHTML = `<i></i><i></i><i></i><span></span>`;
    typingEl.querySelector("span").textContent = `${byId[id].name} está escrevendo`;
  }

  /* ---------- thread ---------- */
  const threadBody = $("thread-body");
  function threadOpen(title, id, text) {
    threadBody.innerHTML = "";
    const root = document.createElement("p");
    root.className = "thread2-root";
    root.innerHTML = `<strong></strong> · `;
    root.querySelector("strong").textContent = title;
    root.append(document.createTextNode(`aberta por ${byId[id].name}`));
    threadBody.appendChild(root);
    threadBody.dataset.n = 0;
    S.threads = 1;
    $("thread-meta").textContent = "#squad-produto · 0 respostas";
    touch(id, "scr-thread");
    updatePulse();
  }
  function threadReply(id, text) {
    const li = messageEl(id, text, null, true);
    li.classList.add("msg2");
    threadBody.appendChild(li);
    while (threadBody.querySelectorAll(".msg2").length > 3) threadBody.querySelector(".msg2").remove();
    const n = Number(threadBody.dataset.n || 0) + 1;
    threadBody.dataset.n = n;
    $("thread-meta").textContent = `#squad-produto · ${n} ${n === 1 ? "resposta" : "respostas"}`;
    touch(id, "scr-thread");
    lit("scr-thread");
  }

  /* ---------- computador do Dev ---------- */
  const term = $("term");
  function termLine(html) {
    const cur = term.querySelector(".cursor");
    if (cur) cur.remove();
    term.insertAdjacentHTML("beforeend", html + "\n");
    const lines = term.innerHTML.split("\n");
    if (lines.length > 9) term.innerHTML = lines.slice(lines.length - 9).join("\n");
    term.insertAdjacentHTML("beforeend", '<span class="cursor"></span>');
  }
  function termRun(lines, gap = 420) {
    lines.forEach((l, i) => later(i * gap, () => termLine(l)));
    touch("dev", "scr-term");
    lit("scr-term");
  }

  /* ---------- ligação ---------- */
  const wave = $("wave");
  for (let i = 0; i < 14; i++) wave.appendChild(document.createElement("i"));
  const waveBars = [...wave.children];
  let callStartAt = 0;
  let lastCallSec = -1;
  function callStart(a, b) {
    ["call-a", "call-b"].forEach((slot, i) => {
      const id = i ? b : a;
      const el = $(slot);
      el.innerHTML = "";
      el.appendChild(bot(id, 56));
      const nm = document.createElement("span");
      nm.textContent = byId[id].name;
      el.appendChild(nm);
      touch(id, "scr-call");
    });
    S.call = true;
    callStartAt = clock;
    $("call-meta").textContent = "ao vivo";
    lit("scr-call");
    updatePulse();
  }
  function callEnd() {
    S.call = false;
    $("call-meta").textContent = "encerrada";
    $("call-state").textContent = "Ligação encerrada. Decidiram o rodapé novo.";
    updatePulse();
  }
  function drawWave() {
    if (!S.call) { if (waveBars[0].style.transform !== "scaleY(0.15)") waveBars.forEach((b) => (b.style.transform = "scaleY(0.15)")); return; }
    waveBars.forEach((b, i) => {
      const h = 0.15 + Math.abs(Math.sin(clock * 7 + i * 0.7) * Math.sin(clock * 2.3 + i)) * 0.85;
      b.style.transform = `scaleY(${h.toFixed(2)})`;
    });
    const s = Math.floor(clock - callStartAt);
    if (s === lastCallSec) return;
    lastCallSec = s;
    $("call-state").innerHTML = `Produto e Design em ligação · <span class="t">${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}</span>`;
  }

  /* ---------- tarefas ---------- */
  const TASKS = [
    { id: "SQ-219", t: "PDF corta a última página", col: 0, hot: true },
    { id: "SQ-220", t: "Traduzir o onboarding", col: 0 },
    { id: "SQ-212", t: "Testes de frete", col: 1 },
    { id: "SQ-198", t: "Página de download", col: 2 },
  ];
  const COLS = ["A fazer", "Em revisão", "Feito"];
  function renderTasks(moved) {
    const board = $("board2");
    board.innerHTML = COLS.map((c, i) => `<div class="col2"><p class="col2-h">${c}</p>${TASKS.filter((t) => t.col === i)
      .map((t) => `<div class="task2${t.hot ? " is-hot" : ""}${t.id === moved && !reduce ? " is-moved" : ""}"><b>${t.id}</b>${esc(t.t)}</div>`).join("")}</div>`).join("");
    $("tasks-meta").textContent = `SQ-219 em ${COLS[TASKS[0].col]}`;
  }
  function moveTask(col) { TASKS[0].col = col; renderTasks("SQ-219"); lit("scr-tasks"); touch("dev", "scr-tasks"); }

  /* ---------- proposta ---------- */
  let voters = [];
  function proposal(id, text, who) {
    voters = who;
    const body = $("prop-body");
    body.innerHTML = `<p class="prop-kicker"></p><p class="prop-line"></p><div class="prop-rows"></div>`;
    body.querySelector(".prop-kicker").textContent = `${byId[id].name} propõe · mudança no relatório`;
    body.querySelector(".prop-line").textContent = text;
    const rowsEl = body.querySelector(".prop-rows");
    who.forEach((v) => {
      const r = document.createElement("div");
      r.className = "prop-row";
      r.dataset.voter = v;
      r.appendChild(bot(v, 24));
      const nm = document.createElement("span");
      nm.textContent = byId[v].name;
      const res = document.createElement("span");
      res.className = "res";
      res.textContent = "pendente";
      r.append(nm, res);
      rowsEl.appendChild(r);
    });
    $("prop-meta").textContent = `0 de ${who.length} aceitaram`;
    touch(id, "scr-prop");
    lit("scr-prop");
  }
  function vote(v) {
    const r = $("prop-body").querySelector(`[data-voter="${v}"] .res`);
    if (!r) return;
    r.textContent = "Aceita";
    r.classList.add("is-ok");
    const n = $("prop-body").querySelectorAll(".res.is-ok").length;
    $("prop-meta").textContent = n === voters.length ? "aplicada" : `${n} de ${voters.length} aceitaram`;
    touch(v, "scr-prop");
    express(v, "happy", 1.6);
  }

  /* ---------- cards que viram ---------- */
  function flip(id, back) {
    const card = $(id);
    card.classList.toggle("is-flipped", back);
    const [front, rear] = card.querySelectorAll(".scr");
    front.inert = back;
    rear.inert = !back;
    front.setAttribute("aria-hidden", String(back));
    rear.setAttribute("aria-hidden", String(!back));
  }
  function lit(id) {
    const el = $(id);
    if (!el || reduce) return;
    el.classList.add("is-lit");
    later(1400, () => el.classList.remove("is-lit"));
  }

  /* ---------- voos: um robô leva a mensagem de uma tela para outra ---------- */
  const fl = $("flyers");
  const fctx = fl.getContext("2d");
  const flights = [];
  function sizeFlyers() {
    fl.width = Math.round(swarm.clientWidth * DPR);
    fl.height = Math.round(swarm.clientHeight * DPR);
  }
  function centerOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const s = swarm.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + Math.min(r.height / 2, 80) };
  }
  function fly(id, from, to, onArrive) {
    const a = centerOf(typeof from === "string" ? $(from) : from);
    const b = centerOf(typeof to === "string" ? $(to) : to);
    if (reduce || !a || !b) { if (onArrive) onArrive(); return; }
    flights.push({ id, a, b, t0: clock, dur: 1.15, trail: [], onArrive, done: false });
  }
  let flyDirty = false;
  function drawFlights() {
    // sem ninguém voando, a camada fica parada (nada a limpar a cada quadro)
    if (!flights.length) {
      if (flyDirty) { fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, fl.width, fl.height); flyDirty = false; }
      return;
    }
    flyDirty = true;
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.clearRect(0, 0, fl.width, fl.height);
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      const raw = (clock - f.t0) / f.dur;
      const p = Math.min(1, raw);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const cx = (f.a.x + f.b.x) / 2;
      const cy = Math.min(f.a.y, f.b.y) - 70 - Math.abs(f.a.x - f.b.x) * 0.12;
      const x = (1 - e) * (1 - e) * f.a.x + 2 * (1 - e) * e * cx + e * e * f.b.x;
      const y = (1 - e) * (1 - e) * f.a.y + 2 * (1 - e) * e * cy + e * e * f.b.y;
      if (!f.done) f.trail.push({ x, y, t: clock });
      // rastro de pixels
      const col = tint(f.id);
      f.trail = f.trail.filter((pt) => clock - pt.t < 0.5);
      f.trail.forEach((pt) => {
        const k = 1 - (clock - pt.t) / 0.5;
        fctx.globalAlpha = k * 0.85;
        fctx.fillStyle = col;
        const sz = 2 + k * 4;
        fctx.fillRect(Math.round(pt.x - sz / 2), Math.round(pt.y - sz / 2), sz, sz);
      });
      fctx.globalAlpha = 1;
      if (!f.done) {
        const s = 34;
        const dir = Math.sign(f.b.x - f.a.x) || 0;
        // brilho atrás do robô
        fctx.fillStyle = col;
        fctx.globalAlpha = 0.18;
        fctx.fillRect(Math.round(x - s * 0.7), Math.round(y - s * 0.7), Math.round(s * 1.4), Math.round(s * 1.4));
        fctx.globalAlpha = 1;
        drawAgent(fctx, x - s / 2, y - s / 2, s, { color: byId[f.id].color, eyes: byId[f.id].eyes, pose: { turn: [dir * 0.7, -0.2], squash: Math.sin(clock * 14) * 0.6 } });
      }
      if (raw >= 1 && !f.done) {
        f.done = true;
        if (f.onArrive) f.onArrive();
      }
      if (f.done && !f.trail.length) flights.splice(i, 1);
    }
  }

  /* ---------- o céu em pixel art ---------- */
  const sky = $("hero-sky");
  const sctx = sky.getContext("2d");
  const PAL = ["#07061a", "#0a0920", "#0e0c2a", "#130f35", "#1a1440", "#241848", "#331d4f", "#482353", "#652b55", "#8a3754", "#b44a52", "#dc6a52", "#ff9058", "#ffb46a"].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
  let SW = 320, SH = 180, base = null, stars = [], lights = [], flies = [];
  let px = 0, py = 0;
  function buildSky() {
    const r = hero.getBoundingClientRect();
    if (!r.width || !r.height) return;
    SW = Math.round(Math.min(400, Math.max(220, r.width / 4)));
    SH = Math.max(120, Math.round((SW * r.height) / r.width));
    sky.width = SW;
    sky.height = SH;
    base = sctx.createImageData(SW, SH);
    const horizon = SH * 0.9;
    const gx = SW * 0.66;
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        let v = Math.pow(Math.min(1, y / horizon), 2.4) * 0.62;
        const dx = (x - gx) / (SW * 0.42);
        const dy = (y - horizon) / (SH * 0.42);
        v += Math.exp(-(dx * dx + dy * dy)) * 0.42;
        const idx = Math.max(0, Math.min(PAL.length - 1, Math.floor(v * (PAL.length - 1) + BAYER[((y & 3) << 2) | (x & 3)] - 0.5)));
        const c = PAL[idx];
        const o = (y * SW + x) * 4;
        base.data[o] = c[0]; base.data[o + 1] = c[1]; base.data[o + 2] = c[2]; base.data[o + 3] = 255;
      }
    stars = [];
    const n = Math.round((SW * SH) / 160);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(hash(i, 1) * SW);
      const y = Math.floor(Math.pow(hash(i, 2), 1.6) * SH * 0.62);
      stars.push({ x, y, b: hash(i, 3), s: hash(i, 4) * 6 + 1, big: hash(i, 5) > 0.94 });
    }
    lights = [];
    for (let i = 0; i < Math.round(SW / 9); i++) lights.push({ x: Math.floor(hash(i, 7) * SW), o: hash(i, 8) * 6, w: hash(i, 9) > 0.6 ? 2 : 1, c: hash(i, 10) });
    flies = [];
    const tops = AGENTS.map((a) => AGENT_GRADIENTS[a.color][0]);
    for (let i = 0; i < 26; i++) flies.push({ x: hash(i, 11) * SW, y: SH * (0.45 + hash(i, 12) * 0.5), v: 0.6 + hash(i, 13) * 1.4, p: hash(i, 14) * 10, c: tops[i % tops.length] });
  }
  function hillY(x, layer) {
    const t = x / SW;
    if (layer === 0) return SH * (0.8 - 0.08 * Math.sin(t * 5.1 + 1.2) - 0.05 * Math.sin(t * 11.3 + 0.4) - 0.03 * Math.sin(t * 23 + 2));
    return SH * (0.9 - 0.06 * Math.sin(t * 3.7 + 2.4) - 0.04 * Math.sin(t * 9.1 + 1.1) - 0.02 * Math.sin(t * 19 + 0.3));
  }
  function drawSky() {
    if (!base) return;
    sctx.putImageData(base, 0, 0);
    // lua: disco redondo de pixels com halo pontilhado, longe do título
    // paisagem: lua no alto, entre o título e a órbita; retrato (celular): canto superior direito, pequena
    const tall = SH > SW;
    const mx = Math.round(SW * (tall ? 0.86 : 0.46)), my = Math.round(SH * (tall ? 0.045 : 0.13)), mr = Math.max(3, Math.round(Math.min(SW, SH) * 0.035));
    sctx.fillStyle = "#f6ead2";
    for (let y = -mr * 3; y <= mr * 3; y++)
      for (let x = -mr * 3; x <= mr * 3; x++) {
        const d = Math.hypot(x, y) / mr;
        if (d <= 1) { sctx.globalAlpha = 1; sctx.fillRect(mx + x, my + y, 1, 1); }
        else if (d < 3 && BAYER[(((my + y) & 3) << 2) | ((mx + x) & 3)] < (1 - (d - 1) / 2) * 0.32) { sctx.globalAlpha = 0.35; sctx.fillRect(mx + x, my + y, 1, 1); }
      }
    sctx.globalAlpha = 1;
    sctx.fillStyle = "#e3d4b4";
    sctx.fillRect(mx - Math.round(mr * 0.4), my - Math.round(mr * 0.2), 2, 2);
    sctx.fillRect(mx + Math.round(mr * 0.3), my + Math.round(mr * 0.35), 1, 1);
    // estrelas piscando
    const tw = reduce ? 0 : hclock;
    stars.forEach((s) => {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(tw * (0.6 + s.s * 0.2) + s.b * 20));
      sctx.globalAlpha = a * (0.5 + s.b * 0.5);
      sctx.fillStyle = s.big ? "#fff3d6" : "#e7e4ff";
      const x = Math.round(s.x - px * 0.4), y = Math.round(s.y - py * 0.3);
      sctx.fillRect(x, y, 1, 1);
      if (s.big && a > 0.7) { sctx.fillRect(x - 1, y, 3, 1); sctx.fillRect(x, y - 1, 1, 3); }
    });
    sctx.globalAlpha = 1;
    // estrela cadente de vez em quando
    if (!reduce) {
      const ph = hclock % 9;
      if (ph < 0.8) {
        const k = ph / 0.8;
        const sx = SW * (0.3 + 0.4 * ((Math.floor(hclock / 9) * 0.37) % 1)) + k * SW * 0.18;
        const sy = SH * 0.08 + k * SH * 0.12;
        for (let j = 0; j < 10; j++) { sctx.globalAlpha = (1 - j / 10) * (1 - k); sctx.fillStyle = "#fff3d6"; sctx.fillRect(Math.round(sx - j * 2), Math.round(sy - j), 1, 1); }
        sctx.globalAlpha = 1;
      }
    }
    // morros com paralaxe
    for (let layer = 0; layer < 2; layer++) {
      sctx.fillStyle = layer ? "#0a0820" : "#16123a";
      const sh = layer ? px * 3 : px * 1.5;
      for (let x = 0; x < SW; x++) {
        const y = Math.round(hillY(x + sh, layer) - py * (layer ? 2 : 1));
        sctx.fillRect(x, y, 1, SH - y);
      }
    }
    // janelas acesas no morro: outros times trabalhando
    lights.forEach((l) => {
      const x = l.x;
      const y = Math.round(hillY(x + px * 3, 1) - py * 2) + 4 + Math.round(l.o);
      if (y >= SH - 1) return;
      const on = reduce ? 1 : 0.55 + 0.45 * Math.sin(hclock * (0.8 + l.c) + l.o);
      sctx.globalAlpha = on;
      sctx.fillStyle = l.c > 0.5 ? "#ffb46a" : "#ffd59a";
      sctx.fillRect(x, y, l.w, 1);
    });
    sctx.globalAlpha = 1;
    // vaga-lumes com as cores dos agentes
    flies.forEach((f) => {
      const t = reduce ? 0 : hclock;
      let y = f.y - ((t * f.v * 3) % (SH * 0.6));
      if (y < SH * 0.3) y += SH * 0.6;
      const x = f.x + Math.sin(t * 0.8 + f.p) * 4 - px;
      sctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + f.p);
      sctx.fillStyle = f.c;
      sctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    });
    sctx.globalAlpha = 1;
  }

  /* ---------- a órbita do hero: o enxame conversando em volta do logo ---------- */
  const orbitEl = $("orbit");
  const oc = $("orbit-canvas");
  const octx = oc.getContext("2d");
  const bubLayer = $("orbit-bubbles");
  const toast = $("orbit-toast");
  toast.hidden = false;
  toast.classList.add("is-off");
  toast.setAttribute("tabindex", "-1");
  const ORDER = ["dev", "produto", "design", "suporte", "qa", "ops"];
  const slots = ORDER.map((id, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / 3;
    return { id, x: 0.5 + Math.cos(ang) * 0.36, y: 0.5 + Math.sin(ang) * 0.36, ph: i * 1.3 };
  });
  const slotOf = {};
  slots.forEach((s) => (slotOf[s.id] = s));
  const LINES = [
    ["suporte", "dev", "@Dev um cliente achou um bug no PDF. Abri uma thread."],
    ["dev", "suporte", "Reproduzi. Já estou corrigindo."],
    ["produto", "design", "@Design te ligo para fechar o rodapé?"],
    ["design", "produto", "Proposta no ar: margem de 24 px."],
    ["dev", "qa", "@QA PR #421 pronto para revisão."],
    ["qa", "ops", "48 de 48 passando. Tudo seu, @Ops."],
    ["ops", "you", "Deploy da v2.4.1 pronto. Só falta você aprovar."],
  ];
  let hclock = 0;
  let oi = -1;
  let oNext = 0.6;
  let link = null;
  const ohappy = {};
  function sizeOrbit() {
    const w = orbitEl.clientWidth;
    oc.width = Math.round(w * DPR);
    oc.height = Math.round(w * DPR);
  }
  function showBubble(from, text) {
    bubLayer.innerHTML = "";
    const s = slotOf[from];
    const b = document.createElement("div");
    // topo e base: balão centrado; laterais: balão rente à borda, para fora do centro.
    // robôs de cima falam para baixo, robôs de baixo falam para cima.
    const side = s.x < 0.4 ? "left" : s.x > 0.6 ? "right" : "mid";
    // centro: o de cima fala para baixo, o de baixo para cima; laterais usam os cantos vazios da órbita
    const below = side === "mid" ? s.y < 0.5 : s.y > 0.5;
    b.className = "obub " + (below ? "down" : "up") + " " + side;
    if (side === "mid") b.style.left = s.x * 100 + "%";
    b.style.top = (below ? s.y + 0.1 : s.y - (side === "mid" ? 0.1 : 0.08)) * 100 + "%";
    b.style.setProperty("--c", tint(from));
    b.innerHTML = `<b></b>${rich(text)}`;
    b.querySelector("b").textContent = byId[from].name;
    bubLayer.appendChild(b);
    if (reduce) b.classList.add("is-on");
    else requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add("is-on")));
  }
  function setToast(on) {
    toast.classList.toggle("is-off", !on);
    toast.setAttribute("tabindex", on ? "0" : "-1");
    toast.setAttribute("aria-hidden", String(!on));
  }
  function orbitStep() {
    oi = (oi + 1) % (LINES.length + 1);
    if (oi === LINES.length) {
      link = null;
      const old = bubLayer.firstElementChild;
      if (old) old.classList.remove("is-on");
      oNext = hclock + 3.2;
      return;
    }
    if (oi === 0) setToast(false);
    const [from, to, text] = LINES[oi];
    showBubble(from, text);
    link = { from, to, t0: hclock };
    if (to === "you") setToast(true);
    else ohappy[to] = hclock + 2.2;
    oNext = hclock + 3.1;
  }
  function opos(id, W) {
    if (id === "you") return { x: W / 2, y: W / 2 };
    const s = slotOf[id];
    const t = reduce ? 0 : hclock;
    return { x: s.x * W + Math.sin(t * 0.6 + s.ph) * W * 0.008, y: s.y * W + Math.cos(t * 0.8 + s.ph) * W * 0.012 };
  }
  function drawOrbit() {
    const W = oc.width;
    if (!W) return;
    octx.clearRect(0, 0, W, W);
    const t = reduce ? 0 : hclock;
    // brilho no centro
    const g = octx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W * 0.24);
    g.addColorStop(0, "rgba(255,180,106,0.20)");
    g.addColorStop(1, "rgba(255,180,106,0)");
    octx.fillStyle = g;
    octx.beginPath();
    octx.arc(W / 2, W / 2, W * 0.24, 0, Math.PI * 2);
    octx.fill();
    // a órbita: pontos de pixel girando devagar
    const p = Math.max(2, Math.round(W / 260));
    octx.fillStyle = "rgba(214,210,255,0.18)";
    for (let k = 0; k < 90; k++) {
      const a = (k / 90) * Math.PI * 2 + t * 0.04;
      octx.fillRect(Math.round(W / 2 + Math.cos(a) * W * 0.36), Math.round(W / 2 + Math.sin(a) * W * 0.36), p, p);
    }
    // a mensagem indo de um agente para outro
    if (link) {
      const a = opos(link.from, W);
      const b = opos(link.to, W);
      const k = Math.min(1, (t - link.t0) / 0.7);
      const col = tint(link.from);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const step = p * 3;
      octx.fillStyle = col;
      for (let d = 0; d < len * k; d += step) {
        const f = d / len;
        octx.globalAlpha = 0.55;
        octx.fillRect(Math.round(a.x + (b.x - a.x) * f), Math.round(a.y + (b.y - a.y) * f), p, p);
      }
      const q = k < 1 ? k : (t * 0.9) % 1;
      octx.globalAlpha = 1;
      octx.fillRect(Math.round(a.x + (b.x - a.x) * q - p * 1.5), Math.round(a.y + (b.y - a.y) * q - p * 1.5), p * 3, p * 3);
      octx.globalAlpha = 1;
    }
    // os robôs
    const sz = W * 0.13;
    const fs = Math.max(11, Math.round(W * 0.026));
    octx.font = `600 ${fs}px "Instrument Sans", system-ui, sans-serif`;
    octx.textAlign = "center";
    octx.textBaseline = "top";
    slots.forEach((s) => {
      const a = byId[s.id];
      const pp = opos(s.id, W);
      const speaking = link && link.from === s.id;
      if (speaking) {
        const hg = octx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, sz);
        hg.addColorStop(0, tint(s.id) + "55");
        hg.addColorStop(1, tint(s.id) + "00");
        octx.fillStyle = hg;
        octx.beginPath();
        octx.arc(pp.x, pp.y, sz, 0, Math.PI * 2);
        octx.fill();
      }
      const pose = reduce ? { turn: [0.25, 0] } : idlePose(t, a.seed, { active: !!speaking, expressions: [] });
      if (speaking && t - link.t0 < 0.8) pose.writing = true;
      if ((ohappy[s.id] || -1) > t) pose.expression = "happy";
      drawAgent(octx, pp.x - sz / 2, pp.y - sz / 2, sz, { color: a.color, eyes: a.eyes, pose });
      octx.fillStyle = speaking ? "#eeecfa" : "#a09dc4";
      octx.fillText(a.name, pp.x, pp.y + sz * 0.56);
    });
  }

  /* ---------- o roteiro do time ---------- */
  let waitingApproval = false;
  let waitTimer = null;
  const yes = $("approve-yes");
  const no = $("approve-no");
  const approveState = $("approve-state");
  const approveRow = $("approve-row");

  function resetScene() {
    queue.length = 0;
    msgs.innerHTML = "";
    typingEl.textContent = "";
    threadBody.innerHTML = '<p class="empty2">Quando um agente responder em thread, a conversa aparece aqui.</p>';
    threadBody.dataset.n = 0;
    $("thread-meta").textContent = "nenhuma aberta";
    term.innerHTML = '<span class="dim">squad@dev:~/app</span>\n<span class="cursor"></span>';
    $("call-a").innerHTML = "";
    $("call-b").innerHTML = "";
    $("call-meta").textContent = "livre";
    $("call-state").textContent = "Nenhum agente em ligação agora.";
    $("prop-body").innerHTML = '<p class="empty2">Quando um agente propuser uma mudança, o time vota aqui.</p>';
    $("prop-meta").textContent = "nenhuma";
    TASKS[0].col = 0;
    renderTasks();
    flip("flip-a", false);
    flip("flip-b", false);
    approveRow.hidden = false;
    approveState.hidden = true;
    yes.classList.remove("is-calling");
    $("approve-meta").textContent = "para você";
    S.threads = 0; S.call = false; S.approvals = 0;
    minute = 14 * 60 + 2;
    AGENTS.forEach((a) => { a.screens.clear(); a.expr = null; });
    setStatus("dev", "no computador", false);
    setStatus("produto", "revisando o roadmap", false);
    setStatus("design", "desenhando o relatório", false);
    setStatus("suporte", "atendendo clientes", false);
    setStatus("qa", "rodando a suíte noturna", false);
    setStatus("ops", "monitorando a produção", false);
    updatePulse();
  }

  // cada passo: [espera antes, ação]
  const STEPS = [
    [700, () => typing("suporte", 1100)],
    [1100, () => {
      const m = post("suporte", "@Dev um cliente diz que o PDF corta a última página quando o relatório tem tabela.", { icon: "i-thread", label: "Abriu uma thread" });
      setStatus("suporte", "abriu uma thread para o Dev", true);
      fly("suporte", m, "scr-thread", () => threadOpen("PDF corta a última página", "suporte"));
    }],
    [1700, () => {
      setStatus("dev", "reproduzindo o bug", true);
      fly("dev", "scr-term", "scr-thread", () => threadReply("dev", "Reproduzi aqui. A quebra de página ignora o rodapé fixo."));
      termRun(['<span class="pr">$</span> bun test export/pdf', '<span class="bad">✗ pdf · tabela longa · última página cortada</span>']);
    }],
    [2300, () => typing("produto", 900)],
    [900, () => {
      const m = post("produto", "@Design dá para ajustar o rodapé do relatório na mesma entrega? Te ligo.");
      setStatus("produto", "em ligação com Design", true);
      setStatus("design", "em ligação com Produto", true);
      fly("produto", m, "scr-call", () => callStart("produto", "design"));
    }],
    [1200, () => {
      setStatus("dev", "corrigindo a quebra de página", true);
      byId.dev.typingUntil = clock + 3.6;
      termRun([
        '<span class="pr">$</span> git switch -c fix/rodape-pdf',
        '<span class="dim">editando src/export/pdf.ts</span>',
        '<span class="pr">$</span> bun test export/pdf',
        '<span class="ok">✓ 48 de 48 passando</span>',
      ], 700);
    }],
    [3400, () => {
      callEnd();
      setStatus("produto", "aguardando a proposta do Design", false);
      setStatus("design", "propondo o rodapé novo", true);
      fly("design", "scr-call", "scr-prop", () => proposal("design", "Rodapé do relatório com margem de 24 px e número da página.", ["produto", "dev", "qa"]));
      post("design", "Proposta no ar: rodapé novo com margem de 24 px.", { icon: "i-users", label: "Propõe uma mudança" });
    }],
    [1700, () => fly("produto", rows.produto, "scr-prop", () => vote("produto"))],
    [800, () => fly("dev", "scr-term", "scr-prop", () => vote("dev"))],
    [800, () => fly("qa", rows.qa, "scr-prop", () => { vote("qa"); express("design", "happy", 2); setStatus("design", "rodapé aprovado pelo time", false); })],
    [1700, () => {
      flip("flip-a", true);
      threadReply("dev", "PR #421 aberto com a correção e o rodapé novo.");
      const m = post("dev", "@QA PR #421 pronto para revisão.", { icon: "i-branch", label: "PR #421" });
      setStatus("dev", "esperando a revisão do QA", false);
      setStatus("qa", "revisando o PR #421", true);
      fly("dev", m, "scr-tasks", () => moveTask(1));
    }],
    [2300, () => typing("qa", 1000)],
    [1000, () => {
      const m = post("qa", "Revisado. 48 de 48 testes passando. Tudo seu, @Ops.");
      setStatus("qa", "PR #421 aprovado", false);
      setStatus("ops", "preparando o deploy da v2.4.1", true);
      fly("qa", m, rows.ops, () => express("ops", "happy", 1.2));
    }],
    [1900, () => {
      flip("flip-b", true);
      const m = post("ops", "Deploy da v2.4.1 pronto. Esperando a sua aprovação.", { icon: "i-shield", label: "Aguardando você" });
      setStatus("ops", "esperando a sua aprovação", true);
      fly("ops", m, "scr-approve", () => {
        S.approvals = 1;
        updatePulse();
        lit("scr-approve");
        touch("ops", "scr-approve");
        yes.classList.add("is-calling");
        waitingApproval = true;
        waitTimer = { at: clock + 16 };
      });
    }],
  ];
  let step = 0;
  function nextStep() {
    if (step >= STEPS.length) return;
    const [wait, run] = STEPS[step];
    step += 1;
    later(wait, () => { run(); nextStep(); });
  }
  function startRound() {
    resetScene();
    step = 0;
    nextStep();
  }

  function decide(ok) {
    if (!waitingApproval) return;
    waitingApproval = false;
    waitTimer = null;
    yes.classList.remove("is-calling");
    approveRow.hidden = true;
    approveState.hidden = false;
    S.approvals = 0;
    updatePulse();
    if (ok) {
      approveState.className = "approve-state is-ok";
      approveState.textContent = "Aprovado por você. Publicando a v2.4.1.";
      $("approve-meta").textContent = "aprovado";
      setStatus("ops", "publicando a v2.4.1", true);
      // o enxame comemora: todo mundo voa até a aprovação
      AGENTS.forEach((a, i) => later(i * 140, () => fly(a.id, rows[a.id], "scr-approve", () => express(a.id, "happy", 2.4))));
      later(1600, () => { post("ops", "v2.4.1 no ar. Sigo monitorando os erros."); setStatus("ops", "monitorando a v2.4.1", false); moveTask(2); });
      later(3200, () => { post("suporte", "Avisei o cliente. O PDF já sai inteiro."); setStatus("suporte", "cliente avisado", false); });
    } else {
      approveState.className = "approve-state is-no";
      approveState.textContent = "Recusado por você. Nada foi publicado.";
      $("approve-meta").textContent = "recusado";
      later(900, () => { post("ops", "Entendido. Deixo o deploy para segunda de manhã."); setStatus("ops", "deploy adiado para segunda", false); express("ops", "surprised", 1.6); });
    }
    later(reduce ? 0 : 9000, () => { if (!reduce) startRound(); });
  }
  yes.addEventListener("click", () => decide(true));
  no.addEventListener("click", () => decide(false));

  /* ---------- pausa ---------- */
  const pauseBtn = $("hero-pause");
  const pauseLabel = $("hero-pause-label");
  const pauseIcon = $("hero-pause-icon");
  function setPaused(p) {
    paused = p;
    pauseBtn.setAttribute("aria-pressed", String(p));
    pauseLabel.textContent = p ? "Retomar" : "Pausar";
    pauseIcon.setAttribute("href", p ? "#i-play" : "#i-pause");
    pulse.classList.toggle("is-paused", p);
    if (!p) wake();
  }
  pauseBtn.addEventListener("click", () => setPaused(!paused));
  if (reduce) pauseBtn.hidden = true;

  /* ---------- laço: hero e seção animam só quando estão visíveis ---------- */
  let raf = 0;
  let last = performance.now();
  let hacc = 0;
  let tacc = 0;
  let skyAcc = 0;
  let waveAcc = 0;
  let heroVis = true;
  let teamVis = false;
  let started = false;
  const team = $("time");
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (paused || document.hidden) return;
    let any = false;
    if (heroVis) {
      any = true;
      hclock += dt;
      if (hclock >= oNext) orbitStep();
      // céu a ~8 fps (estrelas piscam devagar), órbita a ~16 fps
      hacc += dt;
      skyAcc += dt;
      if (skyAcc >= 0.12) { skyAcc = 0; drawSky(); }
      if (hacc >= 0.062) { hacc = 0; drawOrbit(); }
    }
    if (teamVis) {
      any = true;
      clock += dt;
      runDue();
      if (waitTimer && clock > waitTimer.at && waitingApproval) {
        waitTimer = null;
        post("ops", "Sigo aguardando a sua aprovação, sem pressa.");
        later(9000, () => { if (waitingApproval) { waitingApproval = false; startRound(); } });
      }
      // robôs das telas a ~8 fps; onda de áudio a ~12 fps
      tacc += dt;
      waveAcc += dt;
      if (tacc >= 0.12) { tacc = 0; drawBots(); }
      if (waveAcc >= 0.08) { waveAcc = 0; drawWave(); }
      drawFlights();
    }
    if (any) raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (raf || paused || document.hidden || reduce) return;
    if (!heroVis && !teamVis) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver((entries) => { heroVis = entries[0].isIntersecting; wake(); }, { threshold: 0.01 }).observe(hero);
  new IntersectionObserver((entries) => {
    teamVis = entries[0].isIntersecting;
    if (teamVis && !started && !reduce) { started = true; startRound(); }
    wake();
  }, { threshold: 0.15 }).observe(team);
  document.addEventListener("visibilitychange", wake);
  new ResizeObserver(() => { buildSky(); sizeOrbit(); drawSky(); drawOrbit(); }).observe(hero);
  new ResizeObserver(() => sizeFlyers()).observe(swarm);

  /* ---------- começar ---------- */
  buildSky();
  sizeOrbit();
  sizeFlyers();
  if (reduce) {
    // movimento reduzido: tudo parado, no ponto em que o Ops espera a sua aprovação
    resetScene();
    STEPS.forEach(([, run]) => run());
    flip("flip-a", true);
    oi = LINES.length - 2;
    orbitStep();
    drawSky();
    drawOrbit();
    drawBots();
    new MutationObserver(() => drawBots()).observe(swarm, { childList: true, subtree: true });
  } else {
    resetScene();
    drawSky();
    drawOrbit();
    drawBots();
    wake();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { sizeFlyers(); drawOrbit(); });
}
