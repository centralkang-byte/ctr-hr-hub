import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const LOCALES_DIR = join(ROOT, 'messages');
const CHUNKS_DIR = join(__dirname, 'chunks');

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

for (const locale of ['en', 'zh', 'vi', 'es']) {
  const localeData = JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf-8'));
  
  const chunkFiles = readdirSync(CHUNKS_DIR)
    .filter(f => f.startsWith(`${locale}_chunk_`) && f.endsWith('_done.json'))
    .sort();
  
  let merged = 0;
  for (const file of chunkFiles) {
    const chunks = JSON.parse(readFileSync(join(CHUNKS_DIR, file), 'utf-8'));
    for (const item of chunks) {
      if (item.translated && item.translated !== '') {
        setNestedValue(localeData, item.path, item.translated);
        merged++;
      }
    }
  }
  
  writeFileSync(
    join(LOCALES_DIR, `${locale}.json`),
    JSON.stringify(localeData, null, 2) + '\n'
  );
  console.log(`${locale}.json: ${merged} translations merged from ${chunkFiles.length} chunks`);
}
