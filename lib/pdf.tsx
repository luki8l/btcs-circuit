// The PDF management report: two to three A4 pages a CEO can read in five minutes.
import { Document, Page, View, Text, Image, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { MODES, chf, place, ymd, MS, type Ev } from './model';
import type { Report } from './report';

Font.registerHyphenationCallback(word => [word]);   // break long names between words, never with a hyphen

const INK = '#141414', INK2 = '#4A4946', INK3 = '#8A8883', LINE = '#E6E4DF', SUNK = '#F5F5F3', RED = '#E42949', REDINK = '#C41C3A', OK = '#0F7F57';
const TIER: Record<number, string> = { 1: RED, 2: '#9C1E37', 3: '#A6A39C', 4: '#CDCBC5', 5: '#E0DEDA', 0: '#E0DEDA' };
const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 36, fontFamily: 'Helvetica', fontSize: 9, color: INK },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: LINE, marginBottom: 16 },
  logo: { width: 86, height: 34 },
  hr: { textAlign: 'right' },
  h1: { fontFamily: 'Helvetica-Bold', fontSize: 17, marginBottom: 3 },
  sub: { color: INK3, fontSize: 8.5 },
  kpis: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  kpi: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8 },
  kl: { color: INK3, fontSize: 7.5, marginBottom: 4 },
  kv: { fontFamily: 'Helvetica-Bold', fontSize: 15 },
  kn: { color: INK3, fontSize: 7, marginTop: 3 },
  h2: { fontFamily: 'Helvetica-Bold', fontSize: 11.5, marginBottom: 3 },
  lede: { color: INK3, fontSize: 8, marginBottom: 7 },
  sect: { marginBottom: 16 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 4.5, alignItems: 'flex-start' },
  th: { flexDirection: 'row', backgroundColor: SUNK, paddingVertical: 4.5, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  thc: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: INK2, paddingHorizontal: 4, textTransform: 'uppercase' },
  td: { paddingHorizontal: 4 },
  r: { textAlign: 'right' },
  b: { fontFamily: 'Helvetica-Bold' },
  dim: { color: INK3 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  bar: { height: 5, backgroundColor: SUNK, borderRadius: 2.5, flex: 1, marginTop: 2 },
  fill: { height: 5, backgroundColor: RED, borderRadius: 2.5 },
  foot: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', color: INK3, fontSize: 7 },
  empty: { color: INK3, fontSize: 8.5, paddingVertical: 6 },
});

type C<T> = { h: string; w: number | string; r?: boolean; v: (x: T) => React.ReactNode };
function Table<T>({ cols, rows, empty, rowStyle }: { cols: C<T>[]; rows: T[]; empty: string; rowStyle?: (x: T) => Style }) {
  if (!rows.length) return <Text style={s.empty}>{empty}</Text>;
  return (
    <>
      <View style={s.th}>{cols.map(c => <Text key={c.h} style={[s.thc, { width: c.w }, c.r ? s.r : {}]}>{c.h}</Text>)}</View>
      {rows.map((x, i) => (
        <View key={i} style={[s.tr, rowStyle ? rowStyle(x) : {}]} wrap={false}>
          {cols.map(c => { const v = c.v(x); return <View key={c.h} style={[s.td, { width: c.w }]}>{typeof v === 'string' || typeof v === 'number' ? <Text style={c.r ? s.r : {}}>{v}</Text> : v}</View>; })}
        </View>
      ))}
    </>
  );
}
const TierTag = ({ e }: { e: Ev }) => <View style={s.tier}><View style={[s.dot, { backgroundColor: TIER[e.tk] }]} /><Text>{e.tk ? `Tier ${e.tk}` : 'Unrated'}</Text></View>;
const day = (e: Ev) => {
  if (e.mode === 'tbd' || !e.sd) return 'TBD';
  const a = e.sd, z = e.ed || a, yy = String(a.getFullYear()).slice(2);
  if (e.mode === 'month') return `${MS[a.getMonth()]} ${a.getFullYear()}`;
  if (+a === +z) return `${a.getDate()} ${MS[a.getMonth()]} ${yy}`;
  return a.getMonth() === z.getMonth() ? `${a.getDate()}–${z.getDate()} ${MS[a.getMonth()]} ${yy}` : `${a.getDate()} ${MS[a.getMonth()]} – ${z.getDate()} ${MS[z.getMonth()]} ${yy}`;
};
const Name = ({ e, sub }: { e: Ev; sub?: string }) => <View><Text style={s.b}>{e.name}</Text><Text style={s.dim}>{sub ?? place(e)}</Text></View>;

function ReportDoc({ R, by, logo }: { R: Report; by: string; logo: Buffer | null }) {
  const K = R.kpi, gen = new Date();
  const breakdown = R.teams.flatMap(t => [
    { ...t, team: true, name: t.t, size: `${t.members.length} ${t.members.length === 1 ? 'person' : 'people'}` },
    ...t.members.map(p => ({ ...p, team: false, name: p.name + (p.active ? '' : ' (inactive)'), size: '' })),
  ]);
  // page 1 holds the numbers, the breakdown and as many gaps as fit (rows are about 20 / 17 / 34 pt high)
  const gapsN = Math.max(3, Math.min(8, Math.floor((762 - 305 - R.teams.length * 20 - R.persons.length * 17) / 34)));
  const stamp = `${gen.getDate()} ${MS[gen.getMonth()]} ${gen.getFullYear()}`;
  const Foot = () => <View style={s.foot} fixed><Text>Bitcoin Suisse · Internal · Circuit external events report · {ymd(gen)}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>;
  return (
    <Document title="External events report" author="Circuit (Bitcoin Suisse)" subject="External events: coverage, budget and results">
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          {logo ? <Image src={{ data: logo, format: 'png' }} style={s.logo} /> : <Text style={s.b}>Bitcoin Suisse</Text>}
          <View style={s.hr}><Text style={s.h1}>External events report</Text><Text style={s.sub}>Season 2026/27 · {stamp} · prepared for {by}</Text></View>
        </View>
        <View style={s.kpis}>
          {([
            ['Upcoming events', String(K.upcoming), `of ${K.total} in the list`],
            ['Key events covered', `${K.keyCovered} / ${K.key}`, 'Tier 1–2 with someone approved'],
            ['Trips approved', String(K.ahead), `${K.waiting} waiting for Roman`],
            ['Ticket budget', chf(K.budget), 'approved, as entered by sales'],
            ['Leads from events', String(K.leads), K.debriefs ? `${K.debriefs} debriefs · ${K.meetings} meetings` : 'after the first debriefs'],
          ] as const).map(([l, v, n]) => <View key={l} style={[s.kpi, l === 'Ticket budget' ? { flex: 1.3 } : {}]}><Text style={s.kl}>{l}</Text><Text style={[s.kv, l === 'Key events covered' && K.key && K.keyCovered / K.key < .5 ? { color: REDINK } : {}]}>{v}</Text><Text style={s.kn}>{n}</Text></View>)}
        </View>

        <View style={s.sect}>
          <Text style={s.h2}>By team and person</Text><Text style={s.lede}>Trips, results and budget per sales team and person, most leads first. Leads and ratings come from the 60-second debriefs.</Text>
          <Table rows={breakdown} empty="No sales people yet." rowStyle={x => x.team ? { backgroundColor: '#FAFAF8' } : { paddingVertical: 3.5 }} cols={[
            { h: 'Team / person', w: '27%', v: x => x.team ? <Text style={s.b}>{x.name} <Text style={[s.dim, { fontFamily: 'Helvetica' }]}> {x.size}</Text></Text> : <Text style={{ paddingLeft: 10, color: INK2 }}>{x.name}</Text> },
            { h: 'Trips ahead', w: '10%', r: true, v: x => x.ahead || '–' }, { h: 'Waiting', w: '9%', r: true, v: x => x.waiting || '–' },
            { h: 'Done', w: '8%', r: true, v: x => x.went || '–' }, { h: 'Debrief due', w: '9%', r: true, v: x => x.due ? <Text style={[s.r, { color: REDINK }]}>{x.due}</Text> : '–' },
            { h: 'Leads', w: '8%', r: true, v: x => <Text style={[s.r, x.team ? s.b : {}]}>{x.leads || '–'}</Text> }, { h: 'Per event', w: '9%', r: true, v: x => x.perEvent != null ? x.perEvent.toFixed(1) : '–' },
            { h: 'Rating', w: '8%', r: true, v: x => x.rating != null ? x.rating.toFixed(1) : '–' }, { h: 'Budget', w: '12%', r: true, v: x => x.spend ? chf(x.spend) : '–' },
          ]} />
        </View>

        <View style={s.sect}>
          <View wrap={false}><Text style={s.h2}>Key events nobody covers yet</Text><Text style={s.lede}>Upcoming Tier 1–2 events without a request. “Flagged” means Roman has asked sales for someone.</Text></View>
          <Table rows={R.gaps.slice(0, gapsN)} empty="Every upcoming key event has someone from Bitcoin Suisse." cols={[
            { h: 'Date', w: '17%', v: g => day(g.e) }, { h: 'Event', w: '55%', v: g => <Name e={g.e} /> }, { h: 'Tier', w: '14%', v: g => <TierTag e={g.e} /> },
            { h: '', w: '14%', r: true, v: g => g.flagged ? <Text style={[s.r, { color: REDINK }]}>Flagged</Text> : '' },
          ]} />
          {R.gaps.length > gapsN && <Text style={[s.dim, { marginTop: 4 }]}>+ {R.gaps.length - gapsN} more in the Excel export (sheet “Coverage gaps”).</Text>}
        </View>
        <View style={s.sect} break>
          <Text style={s.h2}>Coverage by region</Text><Text style={s.lede}>Upcoming Tier 1–3 events with someone from Bitcoin Suisse approved.</Text>
          {R.regions.map(g => (
            <View key={g.region} style={[s.tr, { alignItems: 'center' }]}>
              <Text style={{ width: '22%', paddingHorizontal: 4 }}>{g.label}</Text>
              <View style={[s.bar, { marginHorizontal: 4 }]}><View style={[s.fill, { width: `${g.total ? Math.max(2, g.covered / g.total * 100) : 0}%`, opacity: g.covered ? 1 : 0 }]} /></View>
              <Text style={{ width: '12%', textAlign: 'right', paddingHorizontal: 4 }}>{g.covered} / {g.total}</Text>
            </View>
          ))}
        </View>

        <View style={s.sect}>
          <View wrap={false}><Text style={s.h2}>Results per event</Text><Text style={s.lede}>Approved trips to events that already happened: leads, meetings, rating and “go again” from the debriefs.</Text></View>
          <Table rows={R.results} empty="No events attended yet. Results appear after the first debriefs." cols={[
            { h: 'Date', w: '14%', v: x => day(x.e) }, { h: 'Event', w: '32%', v: x => <Name e={x.e} /> }, { h: 'Tier', w: '10%', v: x => <TierTag e={x.e} /> },
            { h: 'Who', w: '16%', v: x => <View><Text>{x.p?.name || 'Former colleague'}</Text><Text style={s.dim}>{x.p?.team || ''}</Text></View> },
            { h: 'Mtgs', w: '7%', r: true, v: x => x.r.rating ? String(x.r.meetingsHeld ?? '–') : '–' },
            { h: 'Leads', w: '7%', r: true, v: x => x.r.rating ? <Text style={[s.r, s.b]}>{x.r.leads}</Text> : <Text style={[s.r, { color: REDINK }]}>due</Text> },
            { h: 'Rating', w: '7%', r: true, v: x => x.r.rating ? `${x.r.rating}/5` : '–' },
            { h: 'Again', w: '7%', r: true, v: x => x.r.goAgain ? <Text style={[s.r, { color: x.r.goAgain === 'yes' ? OK : x.r.goAgain === 'no' ? REDINK : INK2 }]}>{x.r.goAgain}</Text> : '' },
          ]} />
          {R.results.some(x => x.r.debriefNote) && <View style={{ marginTop: 8 }}>
            {R.results.filter(x => x.r.debriefNote).slice(0, 8).map((x, i) => <Text key={i} style={{ marginBottom: 3, color: INK2 }}><Text style={s.b}>{x.e.name}</Text> ({x.p?.name || 'Former colleague'}): “{x.r.debriefNote}”</Text>)}
          </View>}
        </View>

        <View style={s.sect}>
          <View wrap={false}><Text style={s.h2}>Trips ahead</Text><Text style={s.lede}>Approved and coming up, by date.</Text></View>
          <Table rows={R.trips} empty="No approved trips ahead yet." cols={[
            { h: 'Date', w: '15%', v: x => day(x.e) }, { h: 'Event', w: '35%', v: x => <Name e={x.e} /> }, { h: 'Tier', w: '10%', v: x => <TierTag e={x.e} /> },
            { h: 'Who', w: '17%', v: x => <View><Text>{x.p?.name || 'Former colleague'}</Text><Text style={s.dim}>{x.p?.team || ''}</Text></View> },
            { h: 'How', w: '11%', v: x => MODES[x.r.mode][0].replace(' or panel', '') }, { h: 'Ticket', w: '12%', r: true, v: x => x.r.ticket === 'paid' ? chf(x.r.cost) : 'free' },
          ]} />
        </View>
        <Foot />
      </Page>
    </Document>
  );
}

export async function buildPdf(R: Report, by: string, logo: Buffer | null): Promise<Buffer> {
  return renderToBuffer(<ReportDoc R={R} by={by} logo={logo} />);
}
