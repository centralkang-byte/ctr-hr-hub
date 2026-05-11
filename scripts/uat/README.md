# UAT Guide Builder

Standalone generator for `docs/uat/UAT_가이드_v2.docx`. Isolated `package.json` to keep the docx-only dependency out of the main app.

## Usage

```bash
cd scripts/uat
npm install
node build-uat-v2.js
```

Output: `docs/uat/UAT_가이드_v2.docx`.

## What to change

Common edits are in the top constants block (`STAGING_URL`, `CAPTURE_COMMIT`, `CAPTURE_DATE`) and the `sectionN()` functions. Screenshots live in `docs/uat/screenshots-v2/` — replace the PNGs in place to update images.

## Validation

After regenerating, run the docx skill validator if available; otherwise spot-check by opening in Microsoft Word. Known constraint: paragraph borders are emitted in non-canonical order by docx-js, so use shading-only callouts instead of `border:` on paragraphs.
