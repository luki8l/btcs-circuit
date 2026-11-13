// The Excel export: everything in one workbook, one sheet per question, real dates and numbers, filters on.
import ExcelJS from 'exceljs';
import { GS, MODES, TICKETS, POLICY, countryName, dateLabel, place, ymd, type Ev } from './model';
import type { Report, Row } from './report';

type Col = { header: string; width: number; fmt?: string };
const CHF = '"CHF" #,##0', DATE = 'dd.mm.yyyy', DEC = '0.0';
const STATUS: Record<string, string> = { requested: 'Waiting for Roman', approved: 'Approved', declined: 'Declined', withdrawn: 'Withdrawn' };
const d = (x: Date | null) => x ? new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) : null;    // dates without a time zone shift
const when = (e: Ev) => e.mode === 'exact' ? d(e.sd) : null;
const tier = (e: Ev) => e.tk || null;

function sheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: unknown[][], note?: string) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: note ? 3 : 1 }] });
  let head = 1;
  if (note) { ws.getCell('A1').value = note; ws.getCell('A1').font = { italic: true, color: { argb: 'FF6B6A66' } }; head = 3; }
  ws.columns = cols.map(c => ({ width: c.width }));
  const h = ws.getRow(head);
  cols.forEach((c, i) => { const cell = h.getCell(i + 1); cell.value = c.header; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF141414' } }; cell.alignment = { vertical: 'middle', wrapText: true }; });
  h.height = 22;
  rows.forEach((r, k) => {
    const row = ws.getRow(head + 1 + k);
    r.forEach((v, i) => { const cell = row.getCell(i + 1); cell.value = (v ?? null) as ExcelJS.CellValue; if (cols[i].fmt) cell.numFmt = cols[i].fmt!; cell.alignment = { vertical: 'top', wrapText: cols[i].width >= 40 }; });
  });
  if (rows.length) ws.autoFilter = { from: { row: head, column: 1 }, to: { row: head + rows.length, column: cols.length } };
  return ws;
}

export async function buildXlsx(R: Report, by: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Circuit (Bitcoin Suisse)'; wb.created = new Date();
  const K = R.kpi, stamp = `Generated ${ymd(new Date())} by ${by}. Source: Circuit (events from the 2026/27 masterlist, requests, decisions and debriefs).`;

  // 1 summary: the headline numbers and the regions
  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 38 }, { width: 18 }, { width: 60 }];
  sum.getCell('A1').value = 'External events report'; sum.getCell('A1').font = { bold: true, size: 16 };
  sum.getCell('A2').value = stamp; sum.getCell('A2').font = { italic: true, color: { argb: 'FF6B6A66' } };
  const kpis: [string, number | string, string, string?][] = [
    ['Upcoming events', K.upcoming, `of ${K.total} in the list`],
    ['Key events covered (Tier 1–2)', `${K.keyCovered} / ${K.key}`, 'upcoming Tier 1–2 events with someone approved'],
    ['Trips approved, ahead', K.ahead, `at ${K.aheadEvents} events`],
    ['Requests waiting for Roman', K.waiting, ''],
    ['Ticket budget approved', K.budget, 'as entered by sales, all approved trips', CHF],
    ['Leads from events', K.leads, `from ${K.debriefs} debriefs`],
    ['Meetings held', K.meetings, 'from the debriefs'],
    ['Debriefs due', K.due, 'events that happened, debrief not done yet'],
    ['Ticket cost per lead', K.costPerLead ?? '–', K.costPerLead != null ? 'debriefed trips with a paid ticket' : 'no paid tickets among the debriefed trips', CHF],
  ];
  const hr = sum.getRow(4); ['Metric', 'Value', 'Note'].forEach((t, i) => { const c = hr.getCell(i + 1); c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF141414' } }; });
  kpis.forEach(([m, v, n, f], k) => { const row = sum.getRow(5 + k); row.getCell(1).value = m; row.getCell(2).value = v; row.getCell(3).value = n; if (f && typeof v === 'number') row.getCell(2).numFmt = f; row.getCell(2).alignment = { horizontal: 'right' }; });
  const rr = 5 + kpis.length + 2;
  sum.getCell(`A${rr}`).value = 'Coverage by region (Tier 1–3 ahead)'; sum.getCell(`A${rr}`).font = { bold: true };
  const rh = sum.getRow(rr + 1); ['Region', 'With someone', 'Events'].forEach((t, i) => { const c = rh.getCell(i + 1); c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF141414' } }; });
  R.regions.forEach((g, k) => { const row = sum.getRow(rr + 2 + k); row.getCell(1).value = g.label; row.getCell(2).value = g.covered; row.getCell(3).value = g.total; });

  // 2 by team
  sheet(wb, 'By team', [
    { header: 'Team', width: 18 }, { header: 'Sales', width: 9 }, { header: 'Trips ahead', width: 12 }, { header: 'Waiting', width: 10 }, { header: 'Events done', width: 12 },
    { header: 'Debriefs due', width: 13 }, { header: 'Leads', width: 9 }, { header: 'Avg. rating (1–5)', width: 16, fmt: DEC }, { header: 'Ticket budget', width: 15, fmt: CHF },
  ], R.teams.map(t => [t.t, t.people, t.ahead, t.waiting, t.went, t.due, t.leads, t.rating, t.spend]));

  // 3 every request with its decision and result
  const all = [...R.rows].sort((a, b) => (a.e.sd ? +a.e.sd : 9e15) - (b.e.sd ? +b.e.sd : 9e15));
  const reqRow = (x: Row) => {
    const { r, e, p } = x, by = r.decidedBy ? R.people.get(r.decidedBy)?.name : '';
    return [e.name, when(e), e.mode === 'exact' ? null : dateLabel(e), place(e), countryName(e.country) || null, tier(e), p?.name || 'Former colleague', p?.team || null, p?.market || null,
      STATUS[r.status], MODES[r.mode][0], TICKETS[r.ticket][0], r.ticket === 'paid' ? Number(r.cost) : null,
      r.groups.map(g => GS[g]).join(', '), r.meetingsPlanned || null, r.reason || null, r.decisionNote || null, by || null, r.decidedAt ? new Date(r.decidedAt) : null,
      r.status === 'approved' ? (r.hubspot ? 'Yes' : 'No') : null, r.leads, r.meetingsHeld, r.rating, r.goAgain, r.debriefNote || null];
  };
  sheet(wb, 'Requests', [
    { header: 'Event', width: 40 }, { header: 'Date', width: 12, fmt: DATE }, { header: 'Date (approx.)', width: 18 }, { header: 'Place', width: 26 }, { header: 'Country', width: 16 }, { header: 'Tier', width: 6 },
    { header: 'Person', width: 20 }, { header: 'Team', width: 13 }, { header: 'Market', width: 13 }, { header: 'Status', width: 18 }, { header: 'How', width: 20 }, { header: 'Ticket', width: 11 },
    { header: 'Cost', width: 12, fmt: CHF }, { header: 'Wants to meet', width: 30 }, { header: 'Meetings planned', width: 10 }, { header: 'Why (from sales)', width: 40 }, { header: 'Note from Roman', width: 40 },
    { header: 'Decided by', width: 18 }, { header: 'Decided on', width: 12, fmt: DATE }, { header: 'In HubSpot', width: 10 }, { header: 'Leads', width: 8 }, { header: 'Meetings held', width: 10 },
    { header: 'Rating', width: 8 }, { header: 'Go again', width: 9 }, { header: 'Debrief note', width: 40 },
  ], all.map(reqRow), 'Every request that is not withdrawn: who asked, what Roman decided and what came back.');

  // 4 results after the event
  sheet(wb, 'Results', [
    { header: 'Event', width: 40 }, { header: 'Date', width: 12, fmt: DATE }, { header: 'Place', width: 26 }, { header: 'Tier', width: 6 }, { header: 'Person', width: 20 }, { header: 'Team', width: 13 },
    { header: 'Ticket cost', width: 12, fmt: CHF }, { header: 'Meetings held', width: 10 }, { header: 'Leads', width: 8 }, { header: 'Cost per lead', width: 13, fmt: CHF }, { header: 'Rating (1–5)', width: 11 },
    { header: 'Go again', width: 9 }, { header: 'Debrief', width: 14 }, { header: 'Note', width: 50 },
  ], R.results.map(({ r, e, p }) => [e.name, when(e) || d(e.sd), place(e), tier(e), p?.name || 'Former colleague', p?.team || null, r.ticket === 'paid' ? Number(r.cost) : null,
    r.rating ? r.meetingsHeld : null, r.rating ? r.leads : null, r.rating && r.leads && Number(r.cost) > 0 ? Number(r.cost) / r.leads : null, r.rating, r.goAgain, r.rating ? 'Done' : 'Due', r.debriefNote || null]),
    'Approved trips to events that already happened. Leads, meetings and rating come from the 60-second debrief.');

  // 5 trips ahead
  sheet(wb, 'Trips ahead', [
    { header: 'Event', width: 40 }, { header: 'Date', width: 12, fmt: DATE }, { header: 'Date (approx.)', width: 18 }, { header: 'Place', width: 26 }, { header: 'Tier', width: 6 }, { header: 'Person', width: 20 },
    { header: 'Team', width: 13 }, { header: 'How', width: 16 }, { header: 'Ticket cost', width: 12, fmt: CHF }, { header: 'In HubSpot', width: 10 },
  ], R.trips.map(({ r, e, p }) => [e.name, when(e), e.mode === 'exact' ? null : dateLabel(e), place(e), tier(e), p?.name || 'Former colleague', p?.team || null, MODES[r.mode][0], r.ticket === 'paid' ? Number(r.cost) : null, r.hubspot ? 'Yes' : 'No']));

  // 6 gaps
  sheet(wb, 'Coverage gaps', [
    { header: 'Event', width: 40 }, { header: 'Date', width: 12, fmt: DATE }, { header: 'Date (approx.)', width: 18 }, { header: 'Place', width: 26 }, { header: 'Tier', width: 6 },
    { header: 'Roman wants someone', width: 12 }, { header: 'Audience size', width: 10 }, { header: 'Ticket (masterlist)', width: 30 },
  ], R.gaps.map(({ e, flagged }) => [e.name, when(e), e.mode === 'exact' ? null : dateLabel(e), place(e), tier(e), flagged ? 'Yes' : null, e.size, e.costTicket]),
    'Upcoming Tier 1–2 events where nobody from Bitcoin Suisse is approved or waiting.');

  // 7 the catalogue
  sheet(wb, 'Events', [
    { header: 'Event', width: 40 }, { header: 'Start', width: 12, fmt: DATE }, { header: 'End', width: 12, fmt: DATE }, { header: 'Date (approx.)', width: 18 }, { header: 'City', width: 20 }, { header: 'Country', width: 16 },
    { header: 'Region', width: 12 }, { header: 'Tier 2027', width: 9 }, { header: 'Policy', width: 14 }, { header: 'Tier before', width: 9 }, { header: 'Team rating', width: 10, fmt: DEC }, { header: 'Ratings', width: 8 },
    ...GS.map(g => ({ header: `Fit: ${g}`, width: 11 })), { header: 'Type', width: 18 }, { header: 'Audience', width: 24 }, { header: 'Size', width: 7 }, { header: 'Ticket', width: 24 }, { header: 'Sponsorship', width: 24 },
    { header: 'Website', width: 30 }, { header: 'Approved', width: 9 }, { header: 'Waiting', width: 9 }, { header: 'Notes', width: 50 },
  ], R.events.slice().sort((a, b) => (a.sd ? +a.sd : 9e15) - (b.sd ? +b.sd : 9e15)).map(e => {
    const rs = R.rows.filter(x => x.e.id === e.id);
    return [e.name, e.mode === 'tbd' ? null : d(e.sd), e.mode === 'exact' ? d(e.ed) : null, e.mode === 'exact' ? null : dateLabel(e), e.city, countryName(e.country) || null, e.region, tier(e), e.tk ? POLICY[e.tk][0] : 'Not rated',
      e.tierPrev, e.ratingN ? Number(e.ratingAvg) : null, e.ratingN || null, ...e.fit, e.kind, e.audience, e.size, e.costTicket, e.costSponsor, e.website,
      rs.filter(x => x.r.status === 'approved').length || null, rs.filter(x => x.r.status === 'requested').length || null, e.notes];
  }), 'All events in the list (2026/27 masterlist plus events added since).');

  sum.views = [{ state: 'normal' }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
