// 把整理笔记 docx 转成软件用的 sourceBlocks / sourceText（与 L3–L9 的格式一致：
// 每个段落一个 B 块，标题前加 "## "，表格整体一块并标 TABLE，图片标 FIGURE）。
// 用法：node tools/docx-to-blocks.js <笔记.docx> <输出.json> "<讲标题，如 Lecture 10>"
// 不依赖第三方库：用 PowerShell 解压 docx，再按顺序解析 word/document.xml。
const fs = require("fs"), path = require("path"), os = require("os");
const { execFileSync } = require("child_process");
const [docx, out, title] = process.argv.slice(2);
if (!docx || !out) { console.error("用法：node tools/docx-to-blocks.js <docx> <out.json> \"Lecture N\""); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "docx-"));
execFileSync("powershell", ["-NoProfile", "-Command",
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory('${path.resolve(docx).replace(/'/g, "''")}', '${tmp}')`]);
const xml = fs.readFileSync(path.join(tmp, "word", "document.xml"), "utf8");
fs.rmSync(tmp, { recursive: true, force: true });

const decode = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
// 段落文字：按顺序取 w:t、制表符、换行
function paraText(p) {
  let t = "";
  for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)) t += m[1] !== undefined ? decode(m[1]) : m[0] === "<w:tab/>" ? " " : "\n";
  return t.replace(/[ \t]+\n/g, "\n").trim();
}
// 找到与起始标签配对的结束位置（处理嵌套）
function closeOf(s, i, tag) {
  const re = new RegExp(`<${tag}[ >]|</${tag}>`, "g"); re.lastIndex = i + 1; let depth = 1, m;
  while ((m = re.exec(s))) { depth += m[0].startsWith("</") ? -1 : 1; if (!depth) return m.index + m[0].length; }
  return s.length;
}
const body = xml.slice(xml.indexOf("<w:body>") + 8, xml.lastIndexOf("</w:body>"));
const blocks = [];
let i = 0;
while (i < body.length) {
  const nextP = body.slice(i).search(/<w:p[ >]/), nextT = body.slice(i).indexOf("<w:tbl>");
  if (nextP < 0 && nextT < 0) break;
  if (nextT >= 0 && (nextP < 0 || nextT < nextP)) {
    const s = i + nextT, e = closeOf(body, s, "w:tbl"), tbl = body.slice(s, e);
    const rows = [...tbl.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map(r =>
      [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map(c => [...c[0].matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(p => paraText(p[0])).filter(Boolean).join(" ")).join(" | "));
    const text = rows.filter(r => r.replace(/[ |]/g, "")).join("\n");
    if (text) blocks.push({ kind: "TABLE", text });
    i = e;
  } else {
    const s = i + nextP, e = closeOf(body, s, "w:p"), p = body.slice(s, e);
    const style = (p.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || "";
    const text = paraText(p);
    const fig = /<w:drawing|<w:pict/.test(p) ? (p.match(/<wp:docPr [^>]*descr="([^"]*)"/) || [])[1] : null;
    if (text) blocks.push({ kind: /^Heading|^Title/.test(style) ? "HEAD" : fig !== null ? "FIGURE" : "", text });
    else if (fig) blocks.push({ kind: "FIGURE", text: decode(fig) });
    i = e;
  }
}
const sourceBlocks = blocks.map((b, k) => ({ id: k + 1, text: b.text }));
const tag = (b, k) => `B${String(k + 1).padStart(4, "0")}`;
const sourceText = `# ${title || path.basename(docx)}\n\n` + blocks.map((b, k) =>
  b.kind === "HEAD" ? `## [${tag(b, k)}] ${b.text}` : b.kind ? `[${tag(b, k)} ${b.kind}]\n\n${b.text}` : `[${tag(b, k)}] ${b.text}`).join("\n\n") + "\n";
fs.writeFileSync(out, JSON.stringify({ file: path.basename(docx), sourceBlocks, sourceText }, null, 2));
console.log(`${path.basename(docx)}: ${sourceBlocks.length} 块（标题 ${blocks.filter(b => b.kind === "HEAD").length}，表格 ${blocks.filter(b => b.kind === "TABLE").length}，图 ${blocks.filter(b => b.kind === "FIGURE").length}）`);
