// Time zone of an event, from its city (countries with several zones) or its country. Times in Circuit are local
// at the event; HubSpot gets them as absolute times. Unknown places fall back to Vienna (the HubSpot portal's zone).
import { countryName } from './model';

export const FALLBACK_TZ = 'Europe/Vienna';

const COUNTRY_TZ: Record<string, string> = {
  Argentina: 'America/Argentina/Buenos_Aires', Austria: 'Europe/Vienna', Belgium: 'Europe/Brussels', Bermuda: 'Atlantic/Bermuda',
  Bulgaria: 'Europe/Sofia', Canada: 'America/Toronto', Croatia: 'Europe/Zagreb', Czechia: 'Europe/Prague', Denmark: 'Europe/Copenhagen',
  Estonia: 'Europe/Tallinn', Finland: 'Europe/Helsinki', France: 'Europe/Paris', Germany: 'Europe/Berlin', 'Germany / Austria': 'Europe/Vienna',
  Greece: 'Europe/Athens', 'Hong Kong': 'Asia/Hong_Kong', Hungary: 'Europe/Budapest', Iceland: 'Atlantic/Reykjavik', India: 'Asia/Kolkata',
  Ireland: 'Europe/Dublin', Israel: 'Asia/Jerusalem', Italy: 'Europe/Rome', Japan: 'Asia/Tokyo', Latvia: 'Europe/Riga', Liechtenstein: 'Europe/Vaduz',
  Lithuania: 'Europe/Vilnius', Luxembourg: 'Europe/Luxembourg', Malta: 'Europe/Malta', Mexico: 'America/Mexico_City', Monaco: 'Europe/Monaco',
  Netherlands: 'Europe/Amsterdam', 'New Zealand': 'Pacific/Auckland', Norway: 'Europe/Oslo', Poland: 'Europe/Warsaw', Portugal: 'Europe/Lisbon',
  Qatar: 'Asia/Qatar', Romania: 'Europe/Bucharest', 'Saudi Arabia': 'Asia/Riyadh', Serbia: 'Europe/Belgrade', Singapore: 'Asia/Singapore',
  Slovakia: 'Europe/Bratislava', Slovenia: 'Europe/Ljubljana', 'South Africa': 'Africa/Johannesburg', 'South Korea': 'Asia/Seoul',
  Spain: 'Europe/Madrid', Sweden: 'Europe/Stockholm', Switzerland: 'Europe/Zurich', Thailand: 'Asia/Bangkok', Türkiye: 'Europe/Istanbul',
  'United Arab Emirates': 'Asia/Dubai', 'United Kingdom': 'Europe/London', 'United States': 'America/New_York', Bahrain: 'Asia/Bahrain',
  Cyprus: 'Asia/Nicosia', Brazil: 'America/Sao_Paulo', Australia: 'Australia/Sydney', Indonesia: 'Asia/Jakarta', Vietnam: 'Asia/Ho_Chi_Minh',
  Taiwan: 'Asia/Taipei', China: 'Asia/Shanghai', Philippines: 'Asia/Manila', Malaysia: 'Asia/Kuala_Lumpur',
};

// cities in countries with more than one zone (and the Canary Islands); matched as words in the city text
const CITY_TZ: [RegExp, string][] = [
  [/\b(los angeles|la\b|beverly hills|san francisco|santa clara|san jose|palo alto|huntington beach|las vegas|san diego|seattle|portland)/i, 'America/Los_Angeles'],
  [/\b(denver|jackson hole|salt lake|boulder|aspen)/i, 'America/Denver'],
  [/\b(scottsdale|phoenix)/i, 'America/Phoenix'],
  [/\b(chicago|nashville|austin|dallas|houston|minneapolis|new orleans)/i, 'America/Chicago'],
  [/\b(vancouver|whistler)/i, 'America/Vancouver'],
  [/\b(calgary|edmonton)/i, 'America/Edmonton'],
  [/\b(perth)\b/i, 'Australia/Perth'],
  [/\b(gran canaria|tenerife|las palmas|canary)/i, 'Atlantic/Canary'],
  [/\b(madeira|funchal)/i, 'Atlantic/Madeira'],
  [/\b(sao paulo|são paulo|rio de janeiro)/i, 'America/Sao_Paulo'],
];

/** IANA zone for an event; `guessed` when neither city nor country told us */
export function eventTz(e: { city: string | null; country: string }): { tz: string; guessed: boolean } {
  const city = e.city || '';
  const byCity = CITY_TZ.find(([re]) => re.test(city));
  if (byCity) return { tz: byCity[1], guessed: false };
  const tz = COUNTRY_TZ[countryName(e.country)];
  return tz ? { tz, guessed: false } : { tz: FALLBACK_TZ, guessed: true };
}

/** offset of a zone at an instant, in ms (local = utc + offset) */
function offsetMs(at: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(at).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(at.getTime() / 1000) * 1000;
}

/** a local date + time in a zone → the absolute instant (handles summer time) */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
  const local = Date.UTC(y, m - 1, d, hh, mm);
  let t = local;
  for (let i = 0; i < 3; i++) t = local - offsetMs(new Date(t), tz);
  return new Date(t);
}

/** short label of a zone for people: "Lisbon time", "New York time" */
export const tzLabel = (tz: string) => tz.split('/').pop()!.replace(/_/g, ' ') + ' time';

/** "09:30–18:00 Lisbon time" for exact-date events with times; '' otherwise */
export function eventTimeText(e: { mode: string; startTime?: string | null; endTime?: string | null; city: string | null; country: string }) {
  if (e.mode !== 'exact' || (!e.startTime && !e.endTime)) return '';
  const { tz, guessed } = eventTz(e);
  return `${e.startTime || '…'}–${e.endTime || '…'} ${guessed ? 'local time' : tzLabel(tz)}`;
}

/** an absolute time shown in a zone: "Mon 8 Nov 2027, 09:30" */
export function fmtIn(iso: string | null | undefined, tz: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(+d)) return iso;
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).replace(' at ', ', ');
}

/** the calendar day (YYYY-MM-DD) of an absolute time in a zone */
export function dayIn(iso: string | null | undefined, tz: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(+d) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
