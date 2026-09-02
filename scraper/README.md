# scraper (study4-scraper)

Standalone Node scraper that discovers and parses IELTS practice tests
(listening / reading) from study4.com and converts each into an assignment JSON
payload (optionally POSTing it to the assignments API). This directory is **not**
a pnpm workspace package — it has its own `package.json` and needs its own
`npm install`.

## Run

```bash
npm install
node index.js <test-url> [options]   # single test  (npm start === node index.js)
node index.js --discover [options]    # batch discovery + scrape
node index.js --help                  # full option list
```

## Output

Batch mode writes to `scraper/output/` (override with `--out-dir`): one file per
scraped test under a per-skill subdirectory, plus an aggregate `_summary.json`.
Only `_summary.json` is tracked in git; the per-test files are local artifacts
and should not be committed.
