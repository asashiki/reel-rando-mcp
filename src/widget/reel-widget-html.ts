import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Bump the version suffix whenever the widget changes — hosts cache ui:// resources by URI. */
export const REEL_WIDGET_URI = "ui://reel-rando/widget-v5.html";
export const REEL_WIDGET_MIME = "text/html;profile=mcp-app";

/* Asashiki Design · 樱羽 Sakura tokens (inlined), light + dark via prefers-color-scheme. */
const CSS = `
  :root {
    --bg:#ffffff; --bg-tint:#fff2f9; --bg-tint-2:#e9e9fe;
    --surface:#ffffff; --surface-raised:#fffafd;
    --border:#f3dce9; --border-strong:#e9c4d9;
    --text:#3a3340; --text-2:#8a7d8f; --text-3:#b8aabb;
    --accent:#e96ba8; --accent-soft:#fdd9ec;
    --accent-2:#8b8bef; --accent-2-soft:#e1e1fe; --on-accent:#ffffff;
    --shadow:0 1px 2px rgba(180,120,160,.06),0 4px 16px rgba(180,120,160,.08);
    --radius-s:7px; --radius-m:10px; --radius-l:14px; --skew:-12deg;
    --font:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue","PingFang SC","Hiragino Sans","Microsoft YaHei UI","Noto Sans SC",sans-serif;
    --mono:ui-monospace,"SF Mono","Cascadia Code","JetBrains Mono",Consolas,monospace;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#16131c; --bg-tint:#372240; --bg-tint-2:#282b58;
      --surface:#201b2a; --surface-raised:#2c2439;
      --border:#3e3149; --border-strong:#564662;
      --text:#f1eaf4; --text-2:#b3a2ba; --text-3:#7d6e86;
      --accent:#f48fc4; --accent-soft:#4f2745;
      --accent-2:#a9a9fa; --accent-2-soft:#30305f; --on-accent:#2a1320;
      --shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.35);
    }
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:transparent; font-family:var(--font); color:var(--text);
         -webkit-font-smoothing:antialiased; }
  #root { padding:4px 0; }

  .card { background:var(--surface); border:1px solid var(--border);
          border-radius:var(--radius-l); box-shadow:var(--shadow);
          padding:16px; max-width:420px; }
  .head { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
  .eyebrow { width:9px; height:17px; background:var(--accent-soft);
             border-radius:3px; transform:skewX(var(--skew)); flex-shrink:0; }
  .title { font-size:15px; font-weight:700; flex:1; min-width:0;
           white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mode-badge { font-size:10px; font-weight:700; letter-spacing:.12em;
                background:var(--accent-2-soft); color:var(--accent-2);
                padding:2px 8px; border-radius:var(--radius-s);
                transform:skewX(var(--skew)); flex-shrink:0; }
  .mode-badge span { display:inline-block; transform:skewX(calc(var(--skew) * -1)); }

  .stage { position:relative; }

  /* ---------- SLOT ---------- */
  .slot { display:flex; align-items:center; gap:14px; }
  .reel-frame { position:relative; flex:1; height:126px; overflow:hidden;
                background:var(--bg-tint); border:1px solid var(--border-strong);
                border-radius:var(--radius-m); }
  .reel-frame::before, .reel-frame::after {
    content:""; position:absolute; left:0; right:0; height:42px; z-index:2; pointer-events:none; }
  .reel-frame::before { top:0;
    background:linear-gradient(to bottom, var(--bg-tint), transparent); }
  .reel-frame::after { bottom:0;
    background:linear-gradient(to top, var(--bg-tint), transparent); }
  .reel-marker { position:absolute; top:42px; left:0; right:0; height:42px; z-index:1;
                 border-top:1.5px solid var(--accent); border-bottom:1.5px solid var(--accent);
                 opacity:.5; pointer-events:none; }
  .reel-track { will-change:transform; }
  .reel-track.idle { animation:reelIdle var(--idle-dur,6s) linear infinite; }
  @keyframes reelIdle { from { transform:translateY(0); } to { transform:translateY(var(--idle-shift)); } }
  .reel-item { height:42px; display:flex; align-items:center; justify-content:center;
               font-size:15px; font-weight:600; padding:0 12px;
               white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .reel-item.win { color:var(--accent); animation:winPulse .5s ease; }
  @keyframes winPulse { 0% { transform:scale(.9); } 55% { transform:scale(1.12); } 100% { transform:scale(1); } }

  .lever { width:64px; height:64px; border-radius:50%; border:none; cursor:pointer;
           background:var(--accent); color:var(--on-accent);
           font-family:var(--font); font-weight:700; font-size:14px; letter-spacing:.06em;
           transition:all .18s ease; flex-shrink:0; box-shadow:var(--shadow); }
  .lever:hover:not(:disabled) { filter:brightness(1.07); transform:translateY(-1px); }
  .lever:active:not(:disabled) { transform:translateY(1px) scale(.97); }
  .lever:disabled { opacity:.45; cursor:default; }

  /* ---------- WHEEL ---------- */
  .wheel-wrap { display:flex; justify-content:center; padding:4px 0 0; }
  .wheel-box { position:relative; width:248px; height:260px; }
  .pointer { position:absolute; top:0; left:50%; transform:translateX(-50%); z-index:3;
             width:0; height:0; border-left:9px solid transparent; border-right:9px solid transparent;
             border-top:14px solid var(--accent);
             filter:drop-shadow(0 1px 2px rgba(0,0,0,.18)); }
  .wheel-svg { position:absolute; top:12px; left:4px; }
  .wheel-rot { transform-origin:120px 120px; will-change:transform; }
  .wheel-svg text { font-family:var(--font); font-size:11px; font-weight:600; fill:var(--text); }
  .hub-btn { position:absolute; z-index:2; top:12px; left:4px; width:240px; height:240px;
             display:flex; align-items:center; justify-content:center; pointer-events:none; }
  .hub-btn button { pointer-events:auto; width:62px; height:62px; border-radius:50%;
             border:3px solid var(--surface); cursor:pointer;
             background:var(--accent); color:var(--on-accent);
             font-family:var(--font); font-weight:700; font-size:13px; letter-spacing:.06em;
             box-shadow:var(--shadow); transition:all .18s ease; }
  .hub-btn button:hover:not(:disabled) { filter:brightness(1.07); }
  .hub-btn button:active:not(:disabled) { transform:scale(.96); }
  .hub-btn button:disabled { opacity:.5; cursor:default; }

  /* ---------- CARDS ---------- */
  .cards { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; padding:4px 0;
           perspective:700px; }
  .cardItem { position:relative; width:78px; height:104px; cursor:pointer;
              transform-style:preserve-3d; transition:transform .55s cubic-bezier(.3,.9,.4,1);
              animation:dealIn .4s ease backwards; }
  .cardItem.flip { transform:rotateY(180deg); cursor:default; }
  .cardItem.dim { opacity:.45; }
  @keyframes dealIn { from { transform:translateY(10px); opacity:0; } to { opacity:1; } }
  .face { position:absolute; inset:0; backface-visibility:hidden;
          border-radius:var(--radius-m); border:1px solid var(--border-strong);
          display:flex; align-items:center; justify-content:center; }
  .face.back { background:linear-gradient(150deg, var(--bg-tint) 0%, var(--bg-tint-2) 100%); }
  .face.back .mark { width:22px; height:22px; border-radius:6px;
          background:linear-gradient(135deg, var(--accent), var(--accent-2));
          transform:skewX(var(--skew)); opacity:.85; }
  .cardItem:hover:not(.flip) { transform:translateY(-4px); }
  .face.front { background:var(--surface); transform:rotateY(180deg);
          font-size:12.5px; font-weight:600; text-align:center; padding:6px;
          overflow:hidden; }
  .face.front.winface { border-color:var(--accent); color:var(--accent);
          box-shadow:0 0 0 1.5px var(--accent) inset; }

  /* ---------- RESULT ---------- */
  .hint { margin-top:12px; font-size:12px; color:var(--text-3); text-align:center; }
  .result { display:none; margin-top:14px; padding-top:12px;
            border-top:1px solid var(--border);
            align-items:center; gap:10px; }
  .result.show { display:flex; animation:resIn .4s ease; }
  @keyframes resIn { from { transform:translateY(6px); opacity:0; } to { transform:none; opacity:1; } }
  .res-badge { font-size:10px; font-weight:700; letter-spacing:.14em;
               background:var(--accent-soft); color:var(--accent);
               padding:2px 9px; border-radius:var(--radius-s);
               transform:skewX(var(--skew)); flex-shrink:0; }
  .res-badge span { display:inline-block; transform:skewX(calc(var(--skew) * -1)); }
  .res-label { font-size:16px; font-weight:700; flex:1; min-width:0; overflow-wrap:anywhere; }
  .res-id { font-family:var(--mono); font-size:10px; color:var(--text-3); flex-shrink:0; }

  /* ---------- CONFETTI ---------- */
  .cf { position:absolute; width:6px; height:6px; border-radius:2px; z-index:9;
        left:var(--x); top:var(--y); background:var(--c); pointer-events:none;
        animation:cfPop .85s cubic-bezier(.16,.8,.4,1) forwards; }
  @keyframes cfPop {
    from { transform:translate(0,0) rotate(0); opacity:1; }
    to   { transform:translate(var(--dx), var(--dy)) rotate(260deg); opacity:0; }
  }

  .err { color:var(--text-3); font-size:13px; padding:6px 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.15s !important; }
  }
`;

let cachedJs: string | null = null;

function widgetJs(): string {
  if (cachedJs !== null) return cachedJs;
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const jsPath = resolve(here, "widget/reel-widget.global.js");
    cachedJs = readFileSync(jsPath, "utf8");
  } catch {
    cachedJs = `document.getElementById("root").innerHTML='<div class="err">组件未构建（npm run build）</div>';`;
  }
  return cachedJs;
}

export function reelWidgetHtml(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>${CSS}</style></head>
<body><div id="root"></div><script>${widgetJs()}</script></body></html>`;
}
