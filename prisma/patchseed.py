SEED = '/Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub/prisma/seed.ts'
content = open(SEED).read()

# EDIT 1: Insert STEP 18b before STEP 19
MARKER = '  // STEP 19: Seed Workflow Rules + Steps (CTR-KR, 4 rules)'
STEP18B = '''  // STEP 18b: Seed Country-Specific Enum Options (MX, RU)
