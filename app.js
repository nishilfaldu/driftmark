// remend from upstream main and from the link fix, the speed-up branch's tail
// repair, and marked to render output.
import remendMain from "./vendor/remend-main.js";
import remendPr685 from "./vendor/remend-pr685.js";
import { marked } from "./vendor/marked.js";
import {
  advanceStableLength,
  parseMarkdownIntoBlocks,
  repairStream,
} from "./vendor/tail-repair.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n) => n.toLocaleString("en-US");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// A player steps through frames, holds on the last one, then starts again.
function player({ frames, render, button, range, interval = 55, hold = 2600 }) {
  let i = 0;
  let timer = null;
  range.max = String(frames - 1);
  const show = () => { range.value = String(i); render(i); };
  const tick = () => {
    if (i < frames - 1) { i += 1; show(); timer = setTimeout(tick, interval); }
    else timer = setTimeout(() => { i = 0; show(); timer = setTimeout(tick, interval); }, hold);
  };
  const stop = () => { clearTimeout(timer); timer = null; button.textContent = "Play"; };
  const start = () => { stop(); button.textContent = "Pause"; timer = setTimeout(tick, interval); };
  button.onclick = () => (timer ? stop() : start());
  range.oninput = () => { stop(); i = Number(range.value); render(i); };
  return {
    reset(n) { stop(); i = n ?? 0; range.max = String(frames - 1); show(); if (!reducedMotion) start(); },
    setFrames(n) { frames = n; },
  };
}

/* Link fix: live repair */

const examples = [
  {
    label: "Math range",
    marks: ["["],
    text: "The function returns a number in [0, 1). It never returns 1.\n\nTo get a whole number from 0 to 9, multiply by 10 and round down.",
  },
  {
    label: "Missing )",
    marks: ["[", "](https://"],
    text: "Follow [the setup guide](https://example.com/setup\n\nThen install the package:\n\n```bash\nnpm install streamdown\n```\n\nRestart the dev server.",
  },
  {
    label: "Citation",
    marks: ["["],
    text: "Streamdown is a React component [1 for streaming Markdown.\n\nIt repairs unfinished syntax while the answer is still arriving.",
  },
  {
    label: "List item",
    marks: ["["],
    text: "- Arrays: read with a[i\n- Maps: read with m.get(k)\n- Sets: check with s.has(v)",
  },
];

function rawView(text, marks, streaming) {
  const hits = [];
  for (const m of marks) {
    const at = text.indexOf(m);
    if (at >= 0) hits.push([at, at + m.length]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  const plain = (s) => esc(s).replace(/\n/g, '<span class="nl">↵</span>\n');
  let out = "";
  let pos = 0;
  for (const [a, b] of hits) {
    if (a < pos) continue;
    out += plain(text.slice(pos, a)) + `<span class="trig">${plain(text.slice(a, b))}</span>`;
    pos = b;
  }
  return out + plain(text.slice(pos)) + (streaming ? '<span class="caret"></span>' : "");
}

function renderReader(input, output) {
  let html = marked.parse(output)
    .replace(/<a href="[^"]*"/g, "<a")
    .replace(/\]\(streamdown:incomplete-(link|image)\)/g, (m) => `<span class="junk">${m}</span>`);
  // Text dropped across a block boundary is damage, not an unfinished address.
  let p = 0;
  while (p < input.length && input[p] === output[p]) p += 1;
  const dropped = input.slice(p);
  if (dropped.includes("\n") && !output.slice(p).includes(dropped)) {
    html += `<div class="gone">${fmt(dropped.length)} characters after the link are not shown.</div>`;
  }
  return html;
}

function addedView(input, output) {
  if (input === output) return "remend changed nothing";
  let p = 0;
  while (p < input.length && input[p] === output[p]) p += 1;
  const show = (s) => esc(s.length > 60 ? `${s.slice(0, 57)}…` : s).replace(/\n/g, "↵");
  const removed = input.slice(p);
  const added = output.slice(p);
  return `remend ${removed ? `removed <del>${show(removed)}</del>${added ? " and " : ""}` : ""}${added ? `added <ins>${show(added)}</ins>` : ""}`;
}

let exampleIndex = 0;
let demo1Frames = [];
const tabs = $("demo1-tabs");
tabs.innerHTML = examples
  .map((e, i) => `<button class="tab" role="tab" type="button" aria-selected="${i === 0}" data-i="${i}">${esc(e.label)}</button>`)
  .join("");

function demo1Lengths(text) {
  const lengths = [];
  for (let n = 3; n < text.length; n += 3) lengths.push(n);
  lengths.push(text.length);
  return lengths;
}

function renderDemo1(i) {
  const ex = examples[exampleIndex];
  const n = demo1Frames[i];
  const text = ex.text.slice(0, n);
  const outMain = remendMain(text);
  const outPr = remendPr685(text);
  $("demo1-raw").innerHTML = rawView(text, ex.marks, n < ex.text.length);
  $("demo1-main").innerHTML = renderReader(text, outMain);
  $("demo1-pr").innerHTML = renderReader(text, outPr);
  $("demo1-main-added").innerHTML = addedView(text, outMain);
  $("demo1-pr-added").innerHTML = addedView(text, outPr);
}

const demo1 = player({ frames: 1, render: renderDemo1, button: $("demo1-play"), range: $("demo1-range") });

function selectExample(i) {
  exampleIndex = i;
  for (const b of tabs.children) b.setAttribute("aria-selected", String(Number(b.dataset.i) === i));
  demo1Frames = demo1Lengths(examples[i].text);
  demo1.setFrames(demo1Frames.length);
  demo1.reset(reducedMotion ? demo1Frames.length - 1 : 0);
}
tabs.onclick = (e) => {
  const b = e.target.closest(".tab");
  if (b) selectExample(Number(b.dataset.i));
};
selectExample(0);

/* Speed-up: live tail repair */

const answer = [
  "## Install\n\n",
  "Follow the setup guide to install the package.\n\n",
  "```bash\nnpm install streamdown\n```\n\n",
  "## Use it\n\n",
  "- Add the Streamdown component\n- Pass it the text as it **streams**\n\n",
  "The text changes on every update. Streamdown splits it into blocks, and remend closes what is still open, like **bold text** or a [half-written link](https://streamdown.ai).\n\n",
  "Only the last two blocks can still change. Every block before them is final, so Streamdown keeps them as they are.\n\n",
  "## Why it matters\n\n",
  "A long answer has thousands of updates. Repairing only the end keeps each update small, however long the answer gets.\n",
].join("");

// Stream the answer through the real code once, in order, and keep each frame.
const demo2Frames = [];
{
  let state = null;
  const step = 6;
  for (let n = step; ; n = Math.min(n + step, answer.length)) {
    const input = answer.slice(0, n);
    state = repairStream(state, input, undefined);
    const kept = state.stableLength;
    const blocks = parseMarkdownIntoBlocks(state.repaired);
    advanceStableLength(state, blocks);
    demo2Frames.push({ input, kept, blocks, streaming: n < answer.length });
    if (n === answer.length) break;
  }
}

function renderDemo2(i) {
  const { input, kept, blocks, streaming } = demo2Frames[i];
  let at = 0;
  let cutDone = kept === 0;
  let html = "";
  blocks.forEach((b, k) => {
    const isKept = at + b.length <= kept;
    if (!isKept && !cutDone) {
      html += '<div class="cut"></div>';
      cutDone = true;
    }
    const last = streaming && k === blocks.length - 1;
    const text = esc(b.replace(/\n+$/, "")) + (last ? '<span class="caret" style="display:inline-block;width:7px;height:1em;vertical-align:-0.15em;background:var(--blue)"></span>' : "");
    html += `<div class="blk ${isKept ? "kept" : "rep"}"><span class="no">${k + 1}</span><span class="txt">${text}</span><span class="n">${isKept ? "–" : fmt(b.length)}</span></div>`;
    at += b.length;
  });
  $("demo2-blocks").innerHTML = html;
  const today = input.length;
  const pr = input.length - kept;
  $("demo2-today").innerHTML = `${fmt(today)} <small>characters</small>`;
  $("demo2-pr").innerHTML = `${fmt(pr)} <small>characters</small>`;
  $("demo2-today-bar").style.width = `${(100 * today) / answer.length}%`;
  $("demo2-pr-bar").style.width = `${(100 * pr) / answer.length}%`;
  $("demo2-count").textContent = `Update ${fmt(i + 1)} of ${fmt(demo2Frames.length)}`;
}

const demo2 = player({ frames: demo2Frames.length, render: renderDemo2, button: $("demo2-play"), range: $("demo2-range"), interval: 70, hold: 3200 });
demo2.reset(reducedMotion ? demo2Frames.length - 1 : 0);

/* Characters repaired in the 20,000-token benchmark answer */

const chars = [
  [100, 3574, 775],
  [1261, 42401, 157],
  [2522, 84840, 128],
];
const maxChars = 84840;
const charsEl = $("chars");
charsEl.innerHTML =
  '<div class="row head-row"><span class="head">Update</span><span class="head today">Today repairs</span><span class="head pr">With the change</span></div>' +
  chars
    .map(([u]) => `<div class="row">
      <span class="upd"><b>Update ${fmt(u)}</b><span>of 2,522</span></span>
      <span class="cell"><span class="bar" style="background:var(--red)"></span><span class="val"><b>0</b> characters</span></span>
      <span class="cell"><span class="bar" style="background:var(--blue)"></span><span class="val"><b>0</b> characters</span></span>
    </div>`)
    .join("");

// Grow each row's bars and count up to the measured values, one row after
// another.
const charCells = [...charsEl.querySelectorAll(".row:not(.head-row)")].map((row, k) =>
  [...row.querySelectorAll(".cell")].map((cell, side) => ({
    bar: cell.querySelector(".bar"),
    num: cell.querySelector("b"),
    target: chars[k][side + 1],
    delay: k * 450,
  })),
).flat();
let charsFrame = 0;
function drawChars(t) {
  for (const c of charCells) {
    const e = 1 - (1 - Math.min(1, Math.max(0, (t - c.delay) / 1100))) ** 3;
    c.bar.style.width = `${(100 * c.target * e) / maxChars}%`;
    c.num.textContent = fmt(Math.round(c.target * e));
  }
}
function playChars() {
  cancelAnimationFrame(charsFrame);
  if (reducedMotion) return drawChars(Infinity);
  const start = performance.now();
  const step = (now) => {
    drawChars(now - start);
    if (now - start < 2300) charsFrame = requestAnimationFrame(step);
  };
  charsFrame = requestAnimationFrame(step);
}
// Off screen the chart shows its final values; it replays on each entry.
drawChars(Infinity);
new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) playChars();
  else { cancelAnimationFrame(charsFrame); drawChars(Infinity); }
}, { threshold: 0.4 }).observe(charsEl);

/* When the stable length moves */

function ruleColumn(list, cutAfter, bad) {
  return `<div class="blocks">${list
    .map(([t, cls], k) => `<div class="blk ${cls || ""}"><span class="no">${k + 1}</span><span class="txt">${esc(t)}</span><span class="n"></span></div>${cutAfter === k + 1 ? `<div class="cut${bad ? " bad" : ""}"></div>` : ""}`)
    .join("")}</div>`;
}
const same = [["One"], ["Two"], ["# Three"]];
const link = [["One"], ["Two"], ["# Three [link"]];
$("rule").innerHTML =
  `<div class="pair">${ruleColumn(same, 1)}<span class="sym pr" title="Remend changed nothing: the stable length moves">=</span>${ruleColumn(same, 1)}</div>` +
  `<div class="pair">${ruleColumn(link, 1)}<span class="sym today" title="Remend added text: the stable length stays">≠</span>${ruleColumn([...link, ["](streamdown:incomplete-link)", "add"]], 2, true)}</div>`;

/* Time per update chart */

{
  const today = [2.217, 2.506, 3.073, 3.217, 3.819, 4.18, 4.33, 4.7, 5.029, 5.381];
  const pr = [1.954, 2.277, 2.33, 2.646, 3.009, 3.347, 3.77, 3.927, 4.362, 4.732];
  const W = 720, H = 300, L = 48, R = 72, T = 14, B = 44;
  const x = (k) => L + (k * (W - L - R)) / 9;
  const y = (v) => T + ((6 - v) * (H - T - B)) / 6;
  let s = "";
  for (let v = 0; v <= 6; v += 1) {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/>`;
    s += `<text x="${L - 10}" y="${y(v) + 4}" text-anchor="end">${v} ms</text>`;
  }
  for (let k = 0; k < 10; k += 1) s += `<text x="${x(k)}" y="${H - B + 20}" text-anchor="middle">${(k + 1) * 10}%</text>`;
  s += `<text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">Share of the answer received</text>`;
  for (const [data, color] of [[today, "var(--red)"], [pr, "var(--blue)"]]) {
    s += `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" points="${data.map((v, k) => `${x(k)},${y(v)}`).join(" ")}"/>`;
    s += `<circle cx="${x(9)}" cy="${y(data[9])}" r="4" fill="${color}"/>`;
    s += `<text x="${x(9) + 10}" y="${y(data[9]) + 4}" style="fill:var(--ink);font-family:var(--f-body);font-size:13px;font-weight:600">${data[9].toFixed(1)} ms</text>`;
  }
  $("time").innerHTML = s;
}
