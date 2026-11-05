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
// 边练边学：data/learn/L??.json（可以只有部分讲）
const learnDir = path.join(root, "data", "learn");
const learn = fs.existsSync(learnDir) ? fs.readdirSync(learnDir).filter(f => /^L\d\d\.json$/.test(f)).sort().map(f => read("data/learn/" + f)) : [];
// --only=1,2,3：只校验这几讲的边练边学（分批改写时用）
const onlyArg = process.argv.find(a => a.startsWith("--only="));
const onlySet = onlyArg ? new Set(onlyArg.slice(7).split(",").map(Number)) : null;
const learnNotes = [];
const pids = new Set();
for (const L of learn) {
  if (onlySet && !onlySet.has(L.lectureId)) continue;
  const lec = lectures.find(l => l.id === L.lectureId), tag = "learn L" + L.lectureId;
  if (!lec) { problems.push(tag + " lectureId 不存在"); continue; }
  const cids = new Set(lec.concepts.map(c => c.id)), covered = new Set();
  if (L.points.length < 8 || L.points.length > 18) problems.push(`${tag} 考点数 ${L.points.length}，要求 8–18`);
  for (const p of L.points) {
    const pt = p.id || "(无 id)";
    if (!new RegExp("^L" + L.lectureId + "-P\\d\\d$").test(p.id || "")) problems.push(`${tag} 考点 id 格式错: ${pt}`);
    if (pids.has(p.id)) problems.push("重复考点 id " + pt); pids.add(p.id);
    for (const k of ["title", "titleEn", "kp", "analogy", "example", "recap"]) if (typeof p[k] !== "string" || !p[k]) problems.push(`${pt} 缺 ${k}`);
    if ((p.kp || "").length > 65) problems.push(`${pt} kp 超长 ${p.kp.length}`);
    if ((p.analogy || "").length > 40) problems.push(`${pt} analogy 超长 ${p.analogy.length}`);
    if (p.analogy && !/^像/.test(p.analogy)) problems.push(`${pt} analogy 要以「像」开头`);
    if ((p.example || "").length > 60) problems.push(`${pt} example 超长 ${p.example.length}`);
    if ((p.recap || "").length > 40) problems.push(`${pt} recap 超长 ${p.recap.length}`);
    if (!/[A-Za-z]/.test(p.kp || "")) learnNotes.push(`${pt} kp 没有英文术语`);
    for (const k of ["kp", "analogy", "example"]) if (/[=→+]/.test(p[k] || "")) problems.push(`${pt} ${k} 含符号串`);
    if (!Array.isArray(p.rules) || p.rules.length < 1 || p.rules.length > 4) problems.push(`${pt} rules 要 1–4 条`);
    for (const r of p.rules || []) {
      if (r.length > 45) problems.push(`${pt} rule 超长 ${r.length}: ${r}`);
      if (!/^题目(里)?有.+就?找/.test(r) || /因为/.test(r)) problems.push(`${pt} rule 要写成「题目有…，就找…」，不写因为: ${r}`);
    }
    if (!Array.isArray(p.conceptIds) || !p.conceptIds.length) problems.push(`${pt} 缺 conceptIds`);
    for (const c of p.conceptIds || []) { if (!cids.has(c)) problems.push(`${pt} 的 conceptId ${c} 不在本讲`); covered.add(c); }
    if (!Array.isArray(p.items) || p.items.length < 3 || p.items.length > 5) problems.push(`${pt} 题数要求 3–5`);
    (p.items || []).forEach((q, i) => {
      const qt = `${pt} 第 ${i + 1} 题`;
      for (const k of ["stemEn", "stem"]) if (typeof q[k] !== "string" || !q[k]) problems.push(`${qt} 缺 ${k}`);
      for (const k of ["optionsEn", "options"]) if (!Array.isArray(q[k]) || q[k].length !== 4 || q[k].some(x => typeof x !== "string" || !x)) problems.push(`${qt} ${k} 需要 4 个非空字符串`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) problems.push(`${qt} answer 越界`);
      if (!Array.isArray(q.how) || q.how.length < 2 || q.how.length > 3) problems.push(`${qt} how 要 2–3 步`);
      else {
        if (!/^题目(里)?有/.test(q.how[0]) || !q.how[0].includes("就找")) problems.push(`${qt} 第一步要写成「题目有…，就找…」: ${q.how[0]}`);
        for (const m of q.how[0].matchAll(/「([^」]+)」/g)) if (!(q.stem + " " + q.stemEn).toLowerCase().includes(m[1].toLowerCase())) problems.push(`${qt} 第一步引用的「${m[1]}」不在题干里`);
        if (!q.how[1].includes("因为") || !new RegExp("所以选\\s*" + "ABCD"[q.answer] + "(?![A-Za-z])").test(q.how[1])) problems.push(`${qt} 第二步要写成「因为…，所以选 ${"ABCD"[q.answer]}」: ${q.how[1]}`);
      }
      for (const h of q.how || []) {
        if (h.length > 60) problems.push(`${qt} how 某步超长 ${h.length}`);
        const m = h.match(/(?:所以|因此|故)选\s*([A-D])(?![A-Za-z])/);
        if (m && "ABCD".indexOf(m[1]) !== q.answer) problems.push(`${qt} how 写「选 ${m[1]}」，但答案是 ${"ABCD"[q.answer]}`);
      }
    });
  }
  const miss = lec.concepts.filter(c => !covered.has(c.id)).map(c => c.id);
  if (miss.length) learnNotes.push(`${tag}: ${miss.length} 个知识点没有对应考点: ${miss.join(", ")}`);
}
// 核心考点等级：data/learn/core-L??.json → 合并进考点的 level / why
const coreMap = {};
for (const f of (fs.existsSync(learnDir) ? fs.readdirSync(learnDir).filter(f => /^core-L\d\d\.json$/.test(f)).sort() : [])) {
  const c = read("data/learn/" + f);
  if (onlySet && !onlySet.has(c.lectureId)) continue;
  for (const [id, v] of Object.entries(c.points || {})) {
    if (![1, 2, 3].includes(v.level)) problems.push(`${f}: ${id} level 要 1/2/3`);
    if (typeof v.why !== "string" || !v.why || v.why.length > 50) problems.push(`${f}: ${id} why 缺或超过 50 字`);
    if (!pids.has(id)) problems.push(`${f}: 考点 ${id} 不存在`);
    coreMap[id] = v;
  }
}
for (const L of learn) {
  if (onlySet && !onlySet.has(L.lectureId)) continue;
  const miss = []; let n1 = 0;
  for (const p of L.points) { const v = coreMap[p.id]; if (!v) { miss.push(p.id); continue; } p.level = v.level; p.why = v.why; if (v.level === 1) n1++; }
  if (miss.length) learnNotes.push(`learn L${L.lectureId}: ${miss.length} 个考点没有核心等级`);
  else { const lim = L.lectureId <= 4 ? [5, 7] : [6, 9]; if (n1 < lim[0] || n1 > lim[1]) learnNotes.push(`learn L${L.lectureId}: 核心考点 ${n1} 个，建议 ${lim[0]}–${lim[1]}`); }
}
if (problems.length) { console.error("校验失败：\n  " + problems.slice(0, 60).join("\n  ")); process.exit(1); }
learnNotes.forEach(s => console.log("提醒 " + s));
if (process.argv.includes("--check")) { console.log(`校验通过：${lectures.length} 讲，边练边学 ${learn.length} 讲`); process.exit(0); }

// ---------- 生成 ----------
const data = { version: meta.version, plannedWeeks: meta.plannedWeeks, contentVersion: meta.contentVersion, lectures, symbols: meta.symbols, formulas: meta.formulas };
for (const k of Object.keys(meta)) if (!(k in data)) data[k] = meta[k];
const js = ("window.PSYC_DATA = " + JSON.stringify(data) + ";\nwindow.PSYC_LEARN = " + JSON.stringify(learn) + ";").replace(/<\//g, "<\\/");
const tpl = fs.readFileSync(path.join(root, "app.template.html"), "utf8");
if (!tpl.includes("/*__DATA__*/")) throw new Error("模板里没有 /*__DATA__*/ 占位符");
const page = tpl.replace("/*__DATA__*/", () => js);
for (const out of ["index.html", "PSYC1004期末复习.html"]) fs.writeFileSync(path.join(root, out), page);

for (const l of lectures) {
  const by = {}; for (const q of l.questions) by[q.origin] = (by[q.origin] || 0) + 1;
  console.log(`L${l.id}: ${l.concepts.length} 知识点, ${l.questions.length} 题 ${JSON.stringify(by)}`);
}
for (const L of learn) console.log(`边练边学 L${L.lectureId}: ${L.points.length} 考点（核心 ${L.points.filter(p => p.level === 1).length}）, ${L.points.reduce((n, p) => n + p.items.length, 0)} 题`);
console.log(`OK: ${lectures.length} 讲, ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB`);
