// Validierung der exportierten Artefakte (one-off, node).
const fs = require('fs');
const JSZip = require('jszip');

function wellFormedCheck(xml, name) {
  const tagRe = /<\/?([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const stack = [];
  let m;
  while ((m = tagRe.exec(xml)) !== null) {
    const tag = m[1];
    const selfClose = m[3];
    if (m[0].startsWith('</')) {
      const top = stack.pop();
      if (top !== tag) throw new Error(`${name}: mismatch </${tag}> vs <${top}>`);
    } else if (!selfClose) {
      stack.push(tag);
    }
  }
  if (stack.length) throw new Error(`${name}: unclosed <${stack.join(',')}>`);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml)) throw new Error(`${name}: control chars`);
  if (!xml.startsWith('<?xml')) throw new Error(`${name}: missing xml decl`);
  if (!xml.includes('UTF-8')) throw new Error(`${name}: not UTF-8 declared`);
}

(async () => {
  const epub = await JSZip.loadAsync(fs.readFileSync('src/test-results/book-export/Testbuch_ KI verstehen.epub'));
  const entries = Object.keys(epub.files);
  if (entries[0] !== 'mimetype') throw new Error('mimetype not first entry');
  const mt = await epub.file('mimetype').async('string');
  if (mt !== 'application/epub+zip') throw new Error('wrong mimetype content');

  const xmlChecks = ['META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/toc.ncx', 'OEBPS/nav.xhtml', 'OEBPS/kapitel-titel.xhtml'];
  for (let i = 1; i <= 8; i++) xmlChecks.push(`OEBPS/kapitel-${i}.xhtml`);
  for (const f of xmlChecks) {
    const c = await epub.file(f).async('string');
    wellFormedCheck(c, f);
  }
  const opf = await epub.file('OEBPS/content.opf').async('string');
  for (let i = 1; i <= 8; i++) {
    if (!opf.includes(`kapitel-${i}.xhtml`)) throw new Error(`opf missing chapter ${i}`);
  }
  console.log('EPUB OK: mimetype-first, 12 XML files well-formed+UTF-8, OPF spine complete');

  const d = await JSZip.loadAsync(fs.readFileSync('src/test-results/book-export/Testbuch_ KI verstehen.docx'));
  for (const f of ['[Content_Types].xml', 'word/document.xml', 'word/_rels/document.xml.rels']) {
    if (!d.file(f)) throw new Error('docx missing ' + f);
    const c = await d.file(f).async('string');
    wellFormedCheck(c, 'docx/' + f);
  }
  const doc = await d.file('word/document.xml').async('string');
  const breaks = (doc.match(/<w:pageBreakBefore/g) || []).length;
  if (breaks < 8) throw new Error('docx: too few page breaks: ' + breaks);
  if (!doc.includes('Impressum')) throw new Error('docx: no impressum');
  if (!doc.includes('w:anchor="_kapitel_1"')) throw new Error('docx: no toc hyperlink');
  console.log('DOCX OK: well-formed, Impressum present, pageBreakBefore=' + breaks + ', TOC hyperlinks present');

  const md = fs.readFileSync('src/test-results/book-export/Testbuch_ KI verstehen.md', 'utf-8');
  if (!md.includes('# Testbuch: KI verstehen')) throw new Error('md: missing title');
  if (!md.includes('Inhaltsverzeichnis')) throw new Error('md: missing toc');
  const chapCount = (md.match(/^## Kapitel /gm) || []).length;
  if (chapCount !== 8) throw new Error('md: expected 8 chapter headings, got ' + chapCount);
  if (/[ \t]{2,}/.test(md.replace(/\n/g, '\u0001'))) throw new Error('md: double spaces');
  console.log('MD OK: title + TOC + 8 chapter headings, no double spaces');
  console.log('ALL ARTIFACTS VALID');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });