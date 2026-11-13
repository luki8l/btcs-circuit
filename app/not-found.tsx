import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page" style={{ maxWidth: 640 }}>
      <p className="k">Circuit</p>
      <h1 className="title" style={{ marginTop: 8 }}>Page not found</h1>
      <p className="muted" style={{ marginTop: 14 }}>This page does not exist (any more). The link may be old.</p>
      <div style={{ marginTop: 24 }}><Link className="btn red" href="/">Go to the start page</Link></div>
    </main>
  );
}
