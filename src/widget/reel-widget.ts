import { App } from "@modelcontextprotocol/ext-apps";

type SpinMode = "slot" | "wheel" | "cards";

interface SpinData {
  title: string;
  options: string[];
  mode: SpinMode;
  resultIndex: number;
  resultLabel: string;
  drawId: string;
}

declare global {
  interface Window {
    openai?: { toolOutput?: unknown; [k: string]: unknown };
  }
}

function coerce(data: unknown): SpinData | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.options) || typeof d.resultIndex !== "number") return null;
  const options = d.options.filter((o): o is string => typeof o === "string");
  if (options.length < 2) return null;
  const idx = Math.min(Math.max(0, Math.floor(d.resultIndex)), options.length - 1);
  const mode = d.mode === "wheel" || d.mode === "cards" ? d.mode : "slot";
  return {
    title: typeof d.title === "string" && d.title ? d.title : "试试手气",
    options,
    mode,
    resultIndex: idx,
    resultLabel: options[idx] ?? "",
    drawId: typeof d.drawId === "string" ? d.drawId : ""
  };
}

const MODE_LABEL: Record<SpinMode, string> = { slot: "SLOT", wheel: "WHEEL", cards: "CARDS" };
const HINT: Record<SpinMode, string> = {
  slot: "点右边按钮，让老虎机替你决定",
  wheel: "点中间 GO，转盘替你决定",
  cards: "凭直觉抽一张牌"
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function confetti(host: HTMLElement) {
  const colors = ["#e96ba8", "#8b8bef", "#fdd9ec", "#e1e1fe"];
  const rect = host.getBoundingClientRect();
  for (let i = 0; i < 12; i += 1) {
    const c = el("span", "cf");
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
    const dist = 46 + Math.random() * 46;
    c.style.setProperty("--x", `${rect.width / 2}px`);
    c.style.setProperty("--y", `${rect.height / 2}px`);
    c.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    c.style.setProperty("--dy", `${Math.sin(angle) * dist - 18}px`);
    c.style.setProperty("--c", colors[i % colors.length] ?? "#e96ba8");
    host.appendChild(c);
    setTimeout(() => c.remove(), 950);
  }
}

/* ---------------- SLOT ---------------- */
const ITEM_H = 42;

function renderSlot(stage: HTMLElement, data: SpinData, onDone: () => void) {
  const wrap = el("div", "slot");
  const frame = el("div", "reel-frame");
  const marker = el("div", "reel-marker");
  const track = el("div", "reel-track idle");

  const fill = (items: string[]) => {
    track.innerHTML = "";
    for (const label of items) {
      track.appendChild(el("div", "reel-item", label));
    }
  };

  // Idle loop: options duplicated for a seamless slow scroll.
  fill([...data.options, ...data.options]);
  track.style.setProperty("--idle-shift", `${-data.options.length * ITEM_H}px`);
  track.style.setProperty("--idle-dur", `${Math.max(4, data.options.length * 1.4)}s`);

  const lever = el("button", "lever", "SPIN");
  lever.setAttribute("aria-label", "spin");

  lever.addEventListener("click", () => {
    lever.disabled = true;
    track.classList.remove("idle");

    const loops = 7;
    const sequence: string[] = [];
    for (let i = 0; i < loops; i += 1) sequence.push(...data.options);
    sequence.push(...data.options.slice(0, data.resultIndex + 1));
    sequence.push(...data.options.slice(data.resultIndex + 1, data.resultIndex + 3).concat(
      data.options.slice(0, Math.max(0, 2 - (data.options.length - data.resultIndex - 1)))
    ));
    fill(sequence);

    const targetIdx = loops * data.options.length + data.resultIndex;
    const offset = -(targetIdx - 1) * ITEM_H;
    track.style.transform = "translateY(0px)";
    // Force reflow so the transition animates from 0.
    void track.offsetHeight;
    track.style.transition = "transform 3s cubic-bezier(.12,.8,.18,1)";
    track.style.transform = `translateY(${offset}px)`;

    track.addEventListener(
      "transitionend",
      () => {
        const winEl = track.children[targetIdx] as HTMLElement | undefined;
        if (winEl) winEl.classList.add("win");
        confetti(frame);
        onDone();
      },
      { once: true }
    );
  });

  frame.append(marker, track);
  wrap.append(frame, lever);
  stage.appendChild(wrap);
}

/* ---------------- WHEEL ---------------- */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

function truncate(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function renderWheel(stage: HTMLElement, data: SpinData, onDone: () => void) {
  const n = data.options.length;
  const seg = 360 / n;
  const C = 120;
  const R = 116;
  const fills = ["var(--accent-soft)", "var(--bg-tint-2)", "var(--bg-tint)", "var(--accent-2-soft)"];

  const wrap = el("div", "wheel-wrap");
  const box = el("div", "wheel-box");
  const pointer = el("div", "pointer");

  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("width", "240");
  svg.setAttribute("height", "240");
  svg.setAttribute("viewBox", "0 0 240 240");
  svg.classList.add("wheel-svg");

  const rot = document.createElementNS(svgNs, "g");
  rot.classList.add("wheel-rot");

  const sectors: SVGPathElement[] = [];
  for (let i = 0; i < n; i += 1) {
    const a0 = -90 + i * seg;
    const a1 = a0 + seg;
    const path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", arcPath(C, C, R, a0, a1));
    let fill = fills[i % fills.length] ?? "var(--bg-tint)";
    if (n % fills.length === 1 && i === n - 1) fill = fills[1] ?? fill;
    path.setAttribute("fill", fill);
    path.setAttribute("stroke", "var(--surface)");
    path.setAttribute("stroke-width", "2");
    rot.appendChild(path);
    sectors.push(path);

    const mid = a0 + seg / 2;
    const g = document.createElementNS(svgNs, "g");
    g.setAttribute("transform", `rotate(${mid + 90} ${C} ${C})`);
    const text = document.createElementNS(svgNs, "text");
    text.setAttribute("x", String(C));
    text.setAttribute("y", "26");
    text.setAttribute("text-anchor", "middle");
    text.textContent = truncate(data.options[i] ?? "", n > 8 ? 4 : 6);
    g.appendChild(text);
    rot.appendChild(g);
  }

  const hubRing = document.createElementNS(svgNs, "circle");
  hubRing.setAttribute("cx", String(C));
  hubRing.setAttribute("cy", String(C));
  hubRing.setAttribute("r", "36");
  hubRing.setAttribute("fill", "var(--surface)");
  hubRing.setAttribute("stroke", "var(--border-strong)");
  svg.appendChild(rot);
  svg.appendChild(hubRing);

  const hub = el("div", "hub-btn");
  const go = el("button", "", "GO");
  hub.appendChild(go);

  go.addEventListener("click", () => {
    go.disabled = true;
    const mid = -90 + (data.resultIndex + 0.5) * seg;
    const jitter = (Math.random() - 0.5) * seg * 0.55;
    const target = 5 * 360 + (-90 - mid) + jitter;
    rot.style.transition = "transform 3.4s cubic-bezier(.1,.72,.14,1)";
    rot.style.transform = `rotate(${target}deg)`;
    rot.addEventListener(
      "transitionend",
      () => {
        const winSector = sectors[data.resultIndex];
        if (winSector) {
          winSector.setAttribute("fill", "var(--accent)");
          winSector.setAttribute("opacity", "0.85");
        }
        confetti(box);
        onDone();
      },
      { once: true }
    );
  });

  box.append(pointer, svg, hub);
  wrap.appendChild(box);
  stage.appendChild(wrap);
}

/* ---------------- CARDS ---------------- */
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

function renderCards(stage: HTMLElement, data: SpinData, onDone: () => void) {
  const wrap = el("div", "cards");
  const others = shuffled(data.options.filter((_, i) => i !== data.resultIndex));
  let drawn = false;

  data.options.forEach((_, i) => {
    const card = el("div", "cardItem");
    card.style.animationDelay = `${i * 70}ms`;
    const back = el("div", "face back");
    back.appendChild(el("div", "mark"));
    const front = el("div", "face front");
    card.append(back, front);

    card.addEventListener("click", () => {
      if (drawn) return;
      drawn = true;
      front.textContent = data.resultLabel;
      front.classList.add("winface");
      card.classList.add("flip");

      let k = 0;
      [...wrap.children].forEach((siblingNode) => {
        const sibling = siblingNode as HTMLElement;
        if (sibling === card) return;
        const frontFace = sibling.querySelector(".front") as HTMLElement | null;
        if (frontFace) frontFace.textContent = others[k] ?? "";
        k += 1;
        setTimeout(() => sibling.classList.add("flip", "dim"), 420 + k * 110);
      });
      setTimeout(() => {
        confetti(wrap);
        onDone();
      }, 650);
    });

    wrap.appendChild(card);
  });

  stage.appendChild(wrap);
}

/* ---------------- SHELL ---------------- */
let rendered = false;

function render(data: SpinData, platform: "chatgpt" | "claude") {
  rendered = true;
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = "";
  root.className = `platform-${platform}`;

  const card = el("div", "card");
  const head = el("div", "head");
  head.appendChild(el("div", "eyebrow"));
  head.appendChild(el("div", "title", data.title));
  const badge = el("div", "mode-badge");
  badge.appendChild(el("span", "", MODE_LABEL[data.mode]));
  head.appendChild(badge);

  const stage = el("div", "stage");
  const hint = el("div", "hint", HINT[data.mode]);

  const result = el("div", "result");
  const resBadge = el("div", "res-badge");
  resBadge.appendChild(el("span", "", "RESULT"));
  result.appendChild(resBadge);
  result.appendChild(el("div", "res-label", data.resultLabel));
  if (data.drawId) result.appendChild(el("div", "res-id", `#${data.drawId}`));

  const onDone = () => {
    hint.textContent = "天意如此 ✿ 想重抽就让 AI 再转一次";
    result.classList.add("show");
  };

  if (data.mode === "wheel") renderWheel(stage, data, onDone);
  else if (data.mode === "cards") renderCards(stage, data, onDone);
  else renderSlot(stage, data, onDone);

  card.append(head, stage, hint, result);
  root.appendChild(card);
}

function showError(msg: string) {
  if (rendered) return;
  const root = document.getElementById("root");
  if (root) root.innerHTML = `<div class="err">${msg}</div>`;
}

function renderToolResult(params: { structuredContent?: unknown; content?: Array<{ type: string; text?: string }> }, platform: "chatgpt" | "claude") {
  let data = coerce(params?.structuredContent);
  if (!data && Array.isArray(params?.content)) {
    for (const block of params.content) {
      if (block.type === "text" && block.text) {
        try { const p = JSON.parse(block.text); data = coerce(p); if (data) break; } catch { /* not json */ }
      }
    }
  }
  if (data) render(data, platform);
}

function tryChatGpt() {
  if (!window.openai) return;
  const apply = () => {
    const data = coerce(window.openai?.toolOutput);
    if (data) render(data, "chatgpt");
  };
  apply();
  window.addEventListener("openai:set_globals", apply as EventListener);
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.jsonrpc !== "2.0") return;
    if (message.method !== "ui/notifications/tool-result") return;
    renderToolResult(message.params, "chatgpt");
  }, { passive: true });
}

async function tryMcpApps() {
  try {
    const app = new App({ name: "reel-rando", version: "0.1.0" });
    /* Register before connect() — host may send toolresult during/right after handshake */
    app.addEventListener("toolresult", (params: { structuredContent?: unknown; content?: Array<{ type: string; text?: string }> }) => {
      console.debug("[reel-rando] ontoolresult:", JSON.stringify(params)?.slice(0, 300));
      renderToolResult(params, "claude");
    });
    await app.connect();
  } catch (e) {
    console.debug("[reel-rando] MCP Apps connect skipped:", e);
  }
}

function boot() {
  /* Run both bridges in parallel — rendered flag prevents double-render */
  tryChatGpt();
  void tryMcpApps();
  setTimeout(() => showError("等待抽选数据..."), 4000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
