// 改写解题文字时，确认题目、选项、答案、考点结构和上一次提交一致。
// 用法：node tools/learn-immutable.js 1 2 3
const { execSync } = require("child_process"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
let bad = 0;
for (const n of process.argv.slice(2)) {
  const f = "data/learn/L" + String(n).padStart(2, "0") + ".json";
  const A = JSON.parse(execSync("git show HEAD:" + f, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 }));
  const B = JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
  const key = L => JSON.stringify(L.points.map(p => ({ id: p.id, title: p.title, titleEn: p.titleEn, conceptIds: p.conceptIds, items: p.items.map(q => [q.stemEn, q.stem, q.optionsEn, q.options, q.answer]) })));
  const same = key(A) === key(B);
  console.log(f, same ? "题目结构未变" : "题目结构被改动");
  if (!same) bad++;
}
process.exitCode = bad ? 1 : 0;
