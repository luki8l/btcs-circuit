'use client';
// "Download": the PDF management report or the whole thing as Excel. Fetched first, so errors become a message, not a broken file.
import { useState } from 'react';
import { useApp } from './AppProvider';
import { Dropdown } from './ui';
import { IcChart, IcList } from './icons';

export default function ReportMenu() {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  async function get(fmt: 'xlsx' | 'pdf') {
    setBusy(true);
    try {
      const r = await fetch('/api/report?format=' + fmt, { cache: 'no-store' });
      if (r.status === 401) { location.assign('/login'); return; }
      if (!r.ok) { const j = await r.json().catch(() => ({})); toast(j.error || 'The report could not be created. Try again.', true); return; }
      const blob = await r.blob();
      const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || `Circuit-report.${fmt}`;
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast(fmt === 'pdf' ? 'PDF report downloaded' : 'Excel downloaded');
    } catch { toast('No connection. Try again.', true); }
    finally { setBusy(false); }
  }
  return (
    <div className="report-dl">
      <Dropdown label={busy ? 'Preparing…' : 'Download'} right>{close => <div style={{ width: 300 }}>
        <button className="dd-opt dl" disabled={busy} onClick={() => { close(); get('pdf'); }}><IcChart s={18} /><span><b>PDF report</b><small>Two pages for management: numbers, teams, gaps, results</small></span></button>
        <button className="dd-opt dl" disabled={busy} onClick={() => { close(); get('xlsx'); }}><IcList s={18} /><span><b>Excel, all data</b><small>Requests, results, trips, gaps and every event, ready to filter</small></span></button>
      </div>}</Dropdown>
    </div>
  );
}
