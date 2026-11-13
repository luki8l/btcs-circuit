'use client';
// Anything unexpected: a calm page with one way forward instead of a crash screen.
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="page" style={{ maxWidth: 640 }}>
      <p className="k">Circuit</p>
      <h1 className="title" style={{ marginTop: 8 }}>Something went wrong</h1>
      <p className="muted" style={{ marginTop: 14 }}>The page could not load. This is usually a short connection problem. Try again; if it keeps happening, sign out and back in.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
        <button className="btn red" onClick={() => reset()}>Try again</button>
        <a className="btn" href="/">Start page</a>
        <form action="/auth/signout" method="post"><button className="btn line">Sign out</button></form>
      </div>
      {error.digest && <p className="dim small" style={{ marginTop: 24 }}>Reference: {error.digest}</p>}
    </main>
  );
}
