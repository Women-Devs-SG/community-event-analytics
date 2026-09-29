// Print the Vitest coverage totals as a Markdown table for the GitHub Actions job summary.
import { existsSync, readFileSync } from 'node:fs';

const summaryPath = 'coverage/coverage-summary.json';

if (!existsSync(summaryPath)) {
  console.log('Coverage summary unavailable: tests did not produce `coverage/coverage-summary.json`.');
  process.exit(0);
}

const { total } = JSON.parse(readFileSync(summaryPath, 'utf8'));
const metrics = ['statements', 'branches', 'functions', 'lines'];

console.log('### Test coverage\n');
console.log('| Metric | Covered | Total | % |');
console.log('| --- | ---: | ---: | ---: |');
for (const metric of metrics) {
  const { covered, total: count, pct } = total[metric];
  console.log(`| ${metric} | ${covered} | ${count} | ${pct}% |`);
}
console.log('\nRun `npm run test:coverage` locally and open `coverage/index.html` for per-file detail.');
