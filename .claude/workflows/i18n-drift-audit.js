export const meta = {
  name: 'i18n-drift-audit',
  description: 'Detect i18n drift across 5 locales — missing/orphan keys vs ko (source of truth), placeholder mismatches, and hardcoded user-facing strings in components',
  whenToUse: 'Periodically or before a release. messages/{en,es,ko,vi,zh}.json with ko as source of truth; keys are otherwise frozen (add OK, edit/delete forbidden). Read-only.',
  phases: [
    { title: 'Compare', detail: 'one agent per non-ko locale vs ko + hardcoded-string scanners' },
    { title: 'Synthesize', detail: 'merge into a prioritized drift report' },
  ],
}

const LOCALE_SCHEMA = {
  type: 'object',
  required: ['locale', 'missingVsKo', 'orphanNotInKo', 'placeholderMismatch'],
  properties: {
    locale: { type: 'string' },
    missingVsKo: { type: 'array', items: { type: 'string' }, description: 'dotted key paths present in ko.json but missing here' },
    orphanNotInKo: { type: 'array', items: { type: 'string' }, description: 'dotted key paths here but not in ko.json' },
    placeholderMismatch: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'detail'],
        properties: { key: { type: 'string' }, detail: { type: 'string' } },
      },
    },
    counts: { type: 'object', properties: { missing: { type: 'number' }, orphan: { type: 'number' } } },
  },
}

const HARDCODED_SCHEMA = {
  type: 'object',
  required: ['files'],
  properties: {
    files: {
      type: 'array',
      items: {
        type: 'object',
        required: ['evidence', 'text'],
        properties: {
          evidence: { type: 'string', description: 'file:line' },
          text: { type: 'string', description: 'the hardcoded user-facing literal' },
          suggestedKey: { type: 'string' },
        },
      },
    },
  },
}

const TARGET_LOCALES = ['en', 'es', 'vi', 'zh']
const COMPONENT_SHARDS = [
  { name: 'app-dashboard', glob: 'src/app/(dashboard)' },
  { name: 'components', glob: 'src/components' },
]

phase('Compare')
log(`i18n drift: ${TARGET_LOCALES.length} locales vs ko + ${COMPONENT_SHARDS.length} hardcoded-string scans...`)

const localeChecks = TARGET_LOCALES.map((loc) => () =>
  agent(
    `Compare messages/${loc}.json against messages/ko.json (the source of truth) in the CTR HR Hub. READ-ONLY.\n` +
    `Both are nested JSON with ~69 top-level namespaces. Tip: use Bash + \`node -e\` to flatten and diff key sets reliably ` +
    `rather than eyeballing. Find:\n` +
    `  (a) keys in ko.json MISSING from ${loc}.json (untranslated),\n` +
    `  (b) keys in ${loc}.json NOT in ko.json (orphan — candidates for removal; note keys are otherwise frozen),\n` +
    `  (c) placeholder mismatches — e.g. ko uses {count}/{name} but ${loc} omits, renames, or adds one.\n` +
    `Report dotted key paths (namespace.sub.key). If a list is huge, cap at the 60 most important and note the total in counts.`,
    { label: `locale:${loc}`, phase: 'Compare', schema: LOCALE_SCHEMA, model: 'sonnet' }
  )
)

const hardcodedChecks = COMPONENT_SHARDS.map((s) => () =>
  agent(
    `Scan ${s.glob} in the CTR HR Hub for HARDCODED user-facing strings that bypass next-intl ` +
    `(useTranslations / getTranslations / t()). READ-ONLY.\n` +
    `Flag visible UI literals (Korean or English) in JSX text, button labels, toast titles/descriptions, input placeholders, ` +
    `and aria-labels that are NOT wrapped in a translation call. ` +
    `IGNORE: object keys, className/cn() args, test ids, console logs, code identifiers, pure numbers/dates, and comments.\n` +
    `Give file:line + the literal + a suggested message key. Cap at the 60 most user-visible.`,
    { label: `hardcoded:${s.name}`, phase: 'Compare', schema: HARDCODED_SCHEMA, model: 'sonnet' }
  )
)

const locales = (await parallel(localeChecks)).filter(Boolean)
const hardcoded = (await parallel(hardcodedChecks)).filter(Boolean)

phase('Synthesize')
const totalMissing = locales.reduce((n, l) => n + (l.missingVsKo?.length || 0), 0)
const totalOrphan = locales.reduce((n, l) => n + (l.orphanNotInKo?.length || 0), 0)
const totalHardcoded = hardcoded.reduce((n, h) => n + (h.files?.length || 0), 0)
log(`Drift: ${totalMissing} missing translations, ${totalOrphan} orphan keys, ${totalHardcoded} hardcoded strings.`)

const report = await agent(
  `Summarize i18n drift for the CTR HR Hub CEO (concise, Korean ok). Data below. Cover: which locales are most ` +
  `incomplete, the riskiest gaps (user-facing, high-traffic namespaces like nav/common/dashboard), orphan keys to remove, ` +
  `and a prioritized cleanup plan. Be specific with namespaces.\n\n` +
  `LOCALE DIFFS:\n${JSON.stringify(locales, null, 2)}\n\nHARDCODED:\n${JSON.stringify(hardcoded, null, 2)}`,
  { label: 'synthesize', phase: 'Synthesize', model: 'sonnet' }
)

return { totalMissing, totalOrphan, totalHardcoded, locales, hardcoded, report }
