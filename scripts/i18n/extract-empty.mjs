import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const LOCALES_DIR = join(ROOT, 'messages');
const CHUNKS_DIR = join(__dirname, 'chunks');

mkdirSync(CHUNKS_DIR, { recursive: true });

const ko = JSON.parse(readFileSync(join(LOCALES_DIR, 'ko.json'), 'utf-8'));

function findEmpty(source, target, prefix = '') {
  const result = [];
  for (const [k, v] of Object.entries(source)) {
    const path = prefix ? prefix + '.' + k : k;
    if (typeof v === 'object' && v !== null) {
      result.push(...findEmpty(v, target?.[k] || {}, path));
    } else if (!target?.[k] || target[k] === '') {
      result.push({ path, ko: v });
    }
  }
  return result;
}

const CHUNK_SIZE = 250;

for (const locale of ['en', 'zh', 'vi', 'es']) {
  const data = JSON.parse(readFileSync(join(LOCALES_DIR, `${locale}.json`), 'utf-8'));
  const emptyKeys = findEmpty(ko, data);
  
  for (let i = 0; i < emptyKeys.length; i += CHUNK_SIZE) {
    const chunk = emptyKeys.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    writeFileSync(
      join(CHUNKS_DIR, `${locale}_chunk_${chunkNum}.json`),
      JSON.stringify(chunk, null, 2) + '\n'
    );
  }
  
  const chunkCount = Math.ceil(emptyKeys.length / CHUNK_SIZE);
  console.log(`${locale}: ${emptyKeys.length} empty keys → ${chunkCount} chunks`);
}
