// 校验 data/ 下的题库并内嵌进 app.template.html，生成：
//   index.html            —— GitHub Pages 入口
//   PSYC1004期末复习.html  —— 本地双击打开（与 index.html 相同）
// 用法：node build.js
const fs = require("fs"), path = require("path");
const root = __dirname;
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));

const meta = read("data/meta.json");
const files = fs.readdirSync(path.join(root, "data")).filter(f => /^L\d\d\.json$/.test(f)).sort();
const lectures = files.map(f => read("data/" + f));

// 教授期末练习题：data/review-*.json（[{lectureId, ...题目字段}]），合并进对应讲的题库
for (const f of fs.readdirSync(path.join(root, "data")).filter(f => /^review-.*\.json$/.test(f)).sort()) {
  for (const { lectureId, ...q } of read("data/" + f)) {
    const l = lectures.find(x => x.id === lectureId);
    if (!l) { console.error(`${f}: ${q.id} 的 lectureId ${lectureId} 不存在`); process.exit(1); }
    l.questions.push(q);
  }
}

// ---------- 校验 ----------
const problems = [];
const ids = new Set();
const DOMAINS = ["social", "developmental", "personality"];
for (const l of lectures) {
  const tag = "L" + l.id;
  for (const k of ["id", "title", "subtitle", "summary", "concepts", "questions", "file", "sourceBlocks", "sourceText"])
    if (l[k] === undefined) problems.push(`${tag} 缺字段 ${k}`);
  const cids = new Set();
  for (const c of l.concepts || []) {
    if (ids.has(c.id)) problems.push(`重复 id ${c.id}`); ids.add(c.id); cids.add(c.id);
    for (const k of ["title", "english", "oneLine", "analogy", "simpleExample", "explanation", "example", "pitfall", "source", "front", "back", "cardBack"])
      if (typeof c[k] !== "string" || !c[k]) problems.push(`${c.id} 缺 ${k}`);
  }
  for (const q of l.questions || []) {
    if (ids.has(q.id)) problems.push(`重复 id ${q.id}`); ids.add(q.id);
    if (!cids.has(q.conceptId)) problems.push(`${q.id} 的 conceptId ${q.conceptId} 不在 ${tag} 里`);
    if (!DOMAINS.includes(q.domain)) problems.push(`${q.id} domain 不对: ${q.domain}`);
    if (!["基础", "应用", "辨析"].includes(q.difficulty)) problems.push(`${q.id} difficulty 不对: ${q.difficulty}`);
    for (const k of ["options", "optionsEn", "optionExplanations"])
      if (!Array.isArray(q[k]) || q[k].length !== 4 || q[k].some(x => typeof x !== "string" || !x)) problems.push(`${q.id} ${k} 需要 4 个非空字符串`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) problems.push(`${q.id} answer 越界`);
    for (const k of ["stem", "stemEn", "explanation", "source", "origin", "type"])
      if (typeof q[k] !== "string" || !q[k]) problems.push(`${q.id} 缺 ${k}`);
  }
  const bids = new Set((l.sourceBlocks || []).map(b => b.id));
  for (const x of [...(l.concepts || []), ...(l.questions || [])])
    for (const m of String(x.source || "").matchAll(/B(\d{4})/g))
      if (!bids.has(Number(m[1]))) problems.push(`${x.id} 引用的 B${m[1]} 不存在`);
}
if (problems.length) { console.error("校验失败：\n  " + problems.slice(0, 60).join("\n  ")); process.exit(1); }
if (process.argv.includes("--check")) { console.log(`校验通过：${lectures.length} 讲`); process.exit(0); }

// ---------- 生成 ----------
const data = { version: meta.version, plannedWeeks: meta.plannedWeeks, contentVersion: meta.contentVersion, lectures, symbols: meta.symbols, formulas: meta.formulas };
for (const k of Object.keys(meta)) if (!(k in data)) data[k] = meta[k];
const js = ("window.PSYC_DATA = " + JSON.stringify(data) + ";").replace(/<\//g, "<\\/");
const tpl = fs.readFileSync(path.join(root, "app.template.html"), "utf8");
if (!tpl.includes("/*__DATA__*/")) throw new Error("模板里没有 /*__DATA__*/ 占位符");
const page = tpl.replace("/*__DATA__*/", () => js);
for (const out of ["index.html", "PSYC1004期末复习.html"]) fs.writeFileSync(path.join(root, out), page);

for (const l of lectures) {
  const by = {}; for (const q of l.questions) by[q.origin] = (by[q.origin] || 0) + 1;
  console.log(`L${l.id}: ${l.concepts.length} 知识点, ${l.questions.length} 题 ${JSON.stringify(by)}`);
}
console.log(`OK: ${lectures.length} 讲, ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB`);
