/**
 * Boundary checks for lib/hoursPeriod.ts.  Run: node scripts/check-hours-period.js
 *
 * No test runner here, and jest + a RN preset is not worth it for twenty lines
 * of date math. This transpiles the real source through the TypeScript already
 * in node_modules, so there's no second copy of the logic and no build step.
 *
 * Runs under TZ=America/Chicago on purpose — every date bug this project has
 * hit lived in the gap between UTC and Central, and a UTC run would miss them.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

if (process.env.TZ !== 'America/Chicago') {
    process.env.TZ = 'America/Chicago';
    // TZ has to be set before the process reads it; re-exec once.
    require('child_process').execFileSync(process.execPath, [__filename], { stdio: 'inherit' });
    process.exit(0);
}

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'hoursPeriod.ts'), 'utf8');
const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('exports', 'module', js)(mod.exports, mod);
const { parsePeriodLabel, periodCovers } = mod.exports;

let pass = 0, fail = 0;
function t(name, actual, expected) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}\n         got  ${a}\n         want ${e}`); }
}
const fmt = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
const d = p => p ? [fmt(p.start), fmt(p.end)] : null;
const on = (y, m, day) => new Date(y, m - 1, day);
const REF = on(2026, 8, 27);

console.log(`TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`);

console.log('parsePeriodLabel');
t('live label',              d(parsePeriodLabel('8/24 - 10/31/26', REF)), ['2026-08-24 00:00', '2026-10-31 23:59']);
t('en dash',                 d(parsePeriodLabel('8/24 – 10/31/26', REF)), ['2026-08-24 00:00', '2026-10-31 23:59']);
t('leading heading text',    d(parsePeriodLabel('Fall Semester 8/24 - 10/31/26', REF)), ['2026-08-24 00:00', '2026-10-31 23:59']);
t('earlier real label',      d(parsePeriodLabel('8/15 - 8/22/26', REF)), ['2026-08-15 00:00', '2026-08-22 23:59']);
t('no year -> reference',    d(parsePeriodLabel('8/24 - 10/31', REF)), ['2026-08-24 00:00', '2026-10-31 23:59']);
t('4-digit year',            d(parsePeriodLabel('8/24 - 10/31/2026', REF)), ['2026-08-24 00:00', '2026-10-31 23:59']);
t('winter wrap',             d(parsePeriodLabel('12/20 - 1/15/27', REF)), ['2026-12-20 00:00', '2027-01-15 23:59']);

console.log('\nrejects garbage rather than inventing a range');
t('null label',              parsePeriodLabel(null, REF), null);
t('no range in text',        parsePeriodLabel('Refer to Site', REF), null);
t('impossible month',        parsePeriodLabel('13/45 - 1/2/26', REF), null);
t('Feb 30 rolls over',       parsePeriodLabel('2/30 - 3/1/26', REF), null);
// Not a wrap: a too-wide period would mark every date 'current' and silently
// defeat the check, so the wrap rule requires a late start AND an early end.
t('reversed label rejected', parsePeriodLabel('10/31 - 8/24/26', REF), null);

console.log('\nperiodCovers — against the live 8/24 - 10/31/26 period');
const P = parsePeriodLabel('8/24 - 10/31/26', REF);
t('day before start',        periodCovers(P, on(2026, 8, 23)), false);
t('first day (inclusive)',   periodCovers(P, on(2026, 8, 24)), true);
t('last day (inclusive)',    periodCovers(P, on(2026, 10, 31)), true);
t('day after end',           periodCovers(P, on(2026, 11, 1)), false);

console.log('\nwhen the Courts picker first offers an uncovered date');
// upcomingDates(8) is today + 0..7, so the furthest date offered is today+7.
for (const today of [on(2026, 10, 23), on(2026, 10, 24), on(2026, 10, 25)]) {
    const picker = Array.from({ length: 8 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
    const uncovered = picker.filter(x => !periodCovers(P, x)).map(x => fmt(x).slice(0, 10));
    console.log(`  ${fmt(today).slice(0, 10)}: ${uncovered.length}/8 offered dates outside the period` + (uncovered.length ? ` -> ${uncovered.join(', ')}` : ''));
}
t('10/24 still fully covered', Array.from({ length: 8 }, (_, i) => periodCovers(P, new Date(2026, 9, 24 + i))).every(Boolean), true);
t('10/25 offers 11/1',         periodCovers(P, new Date(2026, 9, 25 + 7)), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
