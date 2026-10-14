// Writes the legal documents as static web pages in docs/, ready for GitHub Pages or any host.
// The stores need public URLs for the privacy policy and for account deletion. Run: npm run legal
import { mkdirSync, writeFileSync } from 'fs';
import { Block, LEGAL_DOCS, LegalDoc, LegalId, UPDATED } from '../src/legal/texts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const linkify = (s: string) => esc(s)
  .replace(/https?:\/\/[^\s,;)]+[^\s,;.)]/g, u => `<a href="${u}">${u}</a>`)
  .replace(/\b(www\.cnil\.fr)\b/g, '<a href="https://$1">$1</a>');
const block = (b: Block) => typeof b === 'string' ? `<p>${linkify(b)}</p>` : `<ul>${b.map(li => `<li>${linkify(li)}</li>`).join('')}</ul>`;
const ORDER: LegalId[] = ['confidentialite', 'cgu', 'mentions-legales', 'suppression-compte'];

const css = `
:root{--bg:#f4efe2;--panel:#fffcf4;--ink:#12313b;--muted:#5d747a;--accent:#0f7c86;--line:#dcd5c3}
@media (prefers-color-scheme:dark){:root{--bg:#0b1a20;--panel:#10232a;--ink:#e8f1ec;--muted:#8fa8a7;--accent:#4fd1c5;--line:#22404a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}nav{display:flex;flex-wrap:wrap;gap:8px 16px;margin-bottom:24px;font-size:14px}
a{color:var(--accent)}h1{font-size:28px;line-height:1.2;margin:0 0 8px}h2{font-size:19px;margin:28px 0 6px}
p,li{color:var(--muted)}ul{padding-left:22px}.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px 22px}
footer{margin-top:32px;font-size:13px;color:var(--muted)}`;

function page(title: string, body: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Archipel des Perles</title><style>${css}</style></head><body><main>
<nav><a href="index.html">Archipel des Perles</a>${ORDER.map(id => `<a href="${id}.html">${esc(LEGAL_DOCS[id].short)}</a>`).join('')}</nav>
${body}<footer>Dernière mise à jour : ${UPDATED}</footer></main></body></html>\n`;
}
const doc = (d: LegalDoc) => page(d.title, `<div class="card"><h1>${esc(d.title)}</h1>${d.intro ? `<p>${linkify(d.intro)}</p>` : ''}${d.sections.map(s => `<h2>${esc(s.h)}</h2>${s.body.map(block).join('')}`).join('')}</div>`);

const out = new URL('../docs/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const id of ORDER) writeFileSync(new URL(`${id}.html`, out), doc(LEGAL_DOCS[id]));
writeFileSync(new URL('index.html', out), page('Informations légales', `<div class="card"><h1>Archipel des Perles</h1>
<p>Un jeu de gestion d’îles imaginaires. Retrouvez ici nos documents.</p><ul>${ORDER.map(id => `<li><a href="${id}.html">${esc(LEGAL_DOCS[id].title)}</a></li>`).join('')}</ul></div>`));
writeFileSync(new URL('.nojekyll', out), '');
console.log('docs/ written:', ORDER.length + 1, 'pages');
