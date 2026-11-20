// HubSpot event fields: time zones, whole day, month-only, locations. Run: node tests/hubspot.test.mjs
// (transpiles the TypeScript libs with the project's own TypeScript, no extra tools)
import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'circuit-hs-'));
for (const f of ['model', 'tz', 'hubspot', 'hubspot-event']) {
  const src = fs.readFileSync(new URL(`../lib/${f}.ts`, import.meta.url), 'utf8');
  fs.writeFileSync(path.join(out, f + '.js'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
}
const require = createRequire(path.join(out, 'x.js'));
const { hubspotPlan } = require('./hubspot-event.js');
const { eventTz, zonedToUtc } = require('./tz.js');

let fails = 0; const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const ev = (o) => ({ id: 1, name: 'Test', website: null, start: null, end: null, mode: 'exact', dateNote: null, region: 'EU', country: 'PT', city: 'Lisbon', kind: null, focus: null, tier: 1, tierPrev: null, ratingAvg: null, ratingSd: null, ratingMedian: null, ratingN: 0, ratingDist: [0,0,0,0,0], fit: [null,null,null,null,null], audience: null, size: null, costTicket: null, costSponsor: null, notes: null, history: null, comment: null, isNew: false, source: 'masterlist', archived: false, updatedAt: '', ...o });

console.log('time zones');
ok(eventTz({ city: 'Lisbon', country: 'PT' }).tz === 'Europe/Lisbon', 'Lisbon → Europe/Lisbon');
ok(eventTz({ city: 'San Francisco', country: 'US' }).tz === 'America/Los_Angeles', 'San Francisco → Los Angeles time');
ok(eventTz({ city: 'LA / Beverly Hills', country: 'US' }).tz === 'America/Los_Angeles', 'LA / Beverly Hills → Los Angeles time');
ok(eventTz({ city: 'Nashville', country: 'US' }).tz === 'America/Chicago', 'Nashville → Chicago time');
ok(eventTz({ city: 'New York', country: 'US' }).tz === 'America/New_York', 'New York → New York time');
ok(eventTz({ city: 'Seoul', country: 'SK' }).tz === 'Asia/Seoul', 'SK (masterlist code) → Seoul');
ok(eventTz({ city: 'Vaduz', country: 'FL' }).tz === 'Europe/Vaduz', 'FL → Vaduz');
const g = eventTz({ city: 'TBA', country: 'TBA' }); ok(g.tz === 'Europe/Vienna' && g.guessed, 'unknown place → Vienna, marked as guessed');
ok(zonedToUtc('2027-07-01', '09:00', 'Europe/Zurich').toISOString() === '2027-07-01T07:00:00.000Z', 'Zurich summer: 09:00 = 07:00 UTC');
ok(zonedToUtc('2027-01-15', '09:00', 'Europe/Zurich').toISOString() === '2027-01-15T08:00:00.000Z', 'Zurich winter: 09:00 = 08:00 UTC');
ok(zonedToUtc('2027-03-28', '03:30', 'Europe/Vienna').toISOString() === '2027-03-28T01:30:00.000Z', 'Vienna on the summer-time switch day');
ok(zonedToUtc('2027-04-27', '09:00', 'America/Los_Angeles').toISOString() === '2027-04-27T16:00:00.000Z', 'Los Angeles: 09:00 = 16:00 UTC');

console.log('fields for HubSpot');
let p = hubspotPlan(ev({ name: '  Web Summit ', start: '2027-11-08', end: '2027-11-11', startTime: '09:30', endTime: '18:00' }));
ok(p.props.event_name === 'Web Summit', 'name trimmed');
ok(p.props.event_location === 'Lisbon, Portugal', 'location "Lisbon, Portugal"');
ok(p.props.event_start_date === '2027-11-08T09:30:00.000Z' && p.props.event_end_date === '2027-11-11T18:00:00.000Z', 'times in Lisbon time (UTC+0 in November)');
p = hubspotPlan(ev({ start: '2027-06-10', end: '2027-06-11', city: 'Zurich', country: 'CH' }));
ok(p.props.event_start_date === '2027-06-09T22:00:00.000Z' && p.props.event_end_date === '2027-06-11T21:59:00.000Z', 'no times → whole days 00:00–23:59 Zurich time');
ok(p.notes.some(n => /whole day/.test(n)), 'note says whole day');
p = hubspotPlan(ev({ start: '2027-06-10', end: null, startTime: '18:00' }));
ok(p.props.event_end_date === '2027-06-10T22:59:00.000Z', 'one day, start time only → ends 23:59 the same day');
p = hubspotPlan(ev({ mode: 'month', start: '2027-03-01', end: '2027-03-01', startTime: '09:00' }));
ok(p.props.event_start_date === '' && p.props.event_end_date === '' && p.notes.some(n => /Only the month/.test(n)), 'month only → dates empty, explained');
p = hubspotPlan(ev({ mode: 'tbd' }));
ok(p.props.event_start_date === '' && p.notes.some(n => /TBD/.test(n)), 'date TBD → dates empty');
p = hubspotPlan(ev({ city: 'TBA', country: 'TBA', start: '2027-05-05' }));
ok(p.props.event_location === '' && p.notes.some(n => /Vienna time is used/.test(n)) && p.notes.some(n => /No location/.test(n)), 'no place → empty location, Vienna time, both explained');
p = hubspotPlan(ev({ city: 'Monaco', country: 'MC', start: '2027-05-05' }));
ok(p.props.event_location === 'Monaco', 'city = country → "Monaco" once');

fs.rmSync(out, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
