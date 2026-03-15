#!/usr/bin/env node
/**
 * Complete EN translation — combines:
 * 1. Phrase engine (_done files from translate-en.cjs)
 * 2. Supplement path map (en-supplement.cjs)  
 * 3. Final batch (en-final.cjs)
 */
const fs = require('fs');
const path = require('path');

const CHUNKS_DIR = path.join(__dirname, 'chunks');
const supplement = require('./en-supplement.cjs');
const final = require('./en-final.cjs');

// Merge all path maps (final takes priority over supplement)
const allPaths = { ...supplement, ...final };

const chunkFiles = fs.readdirSync(CHUNKS_DIR)
  .filter(f => f.startsWith('en_chunk_') && !f.includes('_done') && f.endsWith('.json'))
  .sort();

let totalTranslated = 0;
let totalMissing = 0;
const missingItems = [];

for (const file of chunkFiles) {
  const items = JSON.parse(fs.readFileSync(path.join(CHUNKS_DIR, file), 'utf-8'));
  
  // Load existing _done file for phrase engine translations
  let existing = {};
  const doneFile = file.replace('.json', '_done.json');
  const donePath = path.join(CHUNKS_DIR, doneFile);
  if (fs.existsSync(donePath)) {
    const doneItems = JSON.parse(fs.readFileSync(donePath, 'utf-8'));
    for (const item of doneItems) {
      if (item.translated) existing[item.path] = item.translated;
    }
  }
  
  const translated = items.map(item => {
    // Priority: path map > existing phrase engine translation
    const t = allPaths[item.path] || existing[item.path] || '';
    if (!t) missingItems.push({ path: item.path, ko: item.ko });
    return { ...item, translated: t };
  });
  
  const done = translated.filter(t => t.translated !== '').length;
  totalTranslated += done;
  totalMissing += (items.length - done);
  
  fs.writeFileSync(donePath, JSON.stringify(translated, null, 2) + '\n');
  console.log(`${file}: ${done}/${items.length} translated`);
}

console.log(`\nTotal: ${totalTranslated}/${totalTranslated + totalMissing} (${Math.round(totalTranslated/(totalTranslated+totalMissing)*100)}%)`);

if (missingItems.length > 0) {
  fs.writeFileSync(
    path.join(CHUNKS_DIR, 'en_missing.json'),
    JSON.stringify(missingItems, null, 2) + '\n'
  );
  console.log(`Still missing: ${missingItems.length} keys`);
  missingItems.forEach(m => console.log(`  ${m.path}: "${m.ko}"`));
} else {
  console.log('✅ All EN translations complete!');
}
