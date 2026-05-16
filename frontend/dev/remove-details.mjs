// node frontend/dev/remove-details.mjs
// node remove-details.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pagesDir = join(__dirname, '../src/pages');
const outDir   = join(__dirname, 'pages-removed-details');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (entry.endsWith('.astro')) {
      files.push(full);
    }
  }
  return files;
}

for (const file of walk(pagesDir)) {
  const rel      = relative(pagesDir, file);
  const ext      = extname(rel);
  const outRel   = rel.slice(0, -ext.length) + '-removed-details' + ext;
  const outPath  = join(outDir, outRel);

  mkdirSync(dirname(outPath), { recursive: true });

  const stripped = readFileSync(file, 'utf8')
    .replace(/<details[\s\S]*?<\/details>/gi, '');

  writeFileSync(outPath, stripped);
  console.log(`${rel} → ${outRel}`);
}
