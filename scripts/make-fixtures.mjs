// Builds PDF and DOCX versions of the text fixtures (to exercise the parsers) plus a ZIP and CSV.
// Usage: node scripts/make-fixtures.mjs  → writes to tests/fixtures/generated/
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import JSZip from "jszip";

const dir = "tests/fixtures";
const out = `${dir}/generated`;
mkdirSync(out, { recursive: true });

function pdfFromText(text) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => "\\" + c).replace(/[^\x20-\x7e]/g, "-");
  const lines = text.split("\n");
  const content = ["BT", "/F1 9 Tf", "11 TL", "40 800 Td", ...lines.map((l) => `(${esc(l)}) '`), "ET"].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function docxFromText(text) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = text.split("\n").map((l) => `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join("");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

const priya = readFileSync(`${dir}/cv_01_priya_sharma.txt`, "utf8");
const ananya = readFileSync(`${dir}/spm_name_at_bottom.txt`, "utf8");
const rohan = readFileSync(`${dir}/cv_07_rohan_iyer.txt`, "utf8");

writeFileSync(`${out}/cv_07_rohan_iyer.pdf`, pdfFromText(rohan));
writeFileSync(`${out}/spm_ananya_deshpande.docx`, await docxFromText(ananya));
writeFileSync(`${out}/cv_01_priya_sharma.txt`, priya);

const zip = new JSZip();
zip.file("batch/cv_07_rohan_iyer.pdf", pdfFromText(rohan));
zip.file("batch/spm_ananya_deshpande.docx", await docxFromText(ananya));
writeFileSync(`${out}/batch.zip`, await zip.generateAsync({ type: "nodebuffer" }));

const csvText = 'cv_text,applied_role,name,email,phone\n"Product Manager at a cold-chain startup in Chennai. Sat in reefer trucks for 2 weeks to learn why temperature alerts were ignored; rebuilt alerts around driver WhatsApp. Alert response time fell from 40 to 6 minutes. Talked to Kavya every week.",PM,Kavya Menon,kavya.m@example.com,+91 90000 11111\n';
writeFileSync(`${out}/rows.csv`, csvText);
console.log("fixtures written to", out);
