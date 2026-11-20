/** calls from this app's own pages only: same origin, JSON (a form or page on another site can't post here) */
export function sameOrigin(req: Request) {
  const h = req.headers, site = h.get('sec-fetch-site'), origin = h.get('origin'), host = h.get('x-forwarded-host') || h.get('host');
  if (site && site !== 'same-origin') return false;
  if (origin) { try { if (new URL(origin).host !== host) return false; } catch { return false; } }
  return (h.get('content-type') || '').toLowerCase().startsWith('application/json');
}
