// 一次性脚本：把原来的单文件「PSYC1004期末复习.html」拆成 模板 + 数据。
// 用法：node tools/split-original.js "<原 HTML 路径>"
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(process.argv[2], "utf8");
const MARK = "window.PSYC_DATA = ";
const s = src.indexOf(MARK);
const e = src.indexOf("</script>", s);
if (s < 0 || e < 0) throw new Error("找不到 PSYC_DATA");
let json = src.slice(s + MARK.length, e).trim();
if (json.endsWith(";")) json = json.slice(0, -1);
const D = JSON.parse(json);

// 模板：数据位置换成占位符，其余原样保留
const tpl = src.slice(0, s) + "/*__DATA__*/" + src.slice(e).replace(/^/, "\n");
fs.writeFileSync(path.join(root, "app.template.html"), tpl);

fs.mkdirSync(path.join(root, "data"), { recursive: true });
const { lectures, ...meta } = D;
fs.writeFileSync(path.join(root, "data", "meta.json"), JSON.stringify(meta, null, 2) + "\n");
for (const l of lectures) {
  const name = "L" + String(l.id).padStart(2, "0") + ".json";
  fs.writeFileSync(path.join(root, "data", name), JSON.stringify(l, null, 2) + "\n");
  console.log(name, "concepts", l.concepts.length, "questions", l.questions.length);
}
console.log("meta keys:", Object.keys(meta).join(", "));
