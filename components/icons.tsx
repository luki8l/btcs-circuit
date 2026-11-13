// Line icons, 24px grid, stroke follows currentColor.
import type { SVGProps } from 'react';
type P = SVGProps<SVGSVGElement> & { s?: number };
const I = ({ s = 16, children, ...p }: P & { children: React.ReactNode }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
export const IcSearch = (p: P) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></I>;
export const IcX = (p: P) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>;
export const IcBack = (p: P) => <I {...p}><path d="M15 6l-6 6 6 6" /></I>;
export const IcNext = (p: P) => <I {...p}><path d="M9 6l6 6-6 6" /></I>;
export const IcCheck = (p: P) => <I strokeWidth={2.6} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></I>;
export const IcExt = (p: P) => <I {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></I>;
export const IcPin = (p: P) => <I {...p}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></I>;
export const IcCal = (p: P) => <I {...p}><rect x="3" y="5" width="18" height="16" /><path d="M3 10h18M8 3v4M16 3v4" /></I>;
export const IcFlag = (p: P) => <I {...p}><path d="M5 21V4M5 4h12l-2.5 4 2.5 4H5" /></I>;
export const IcWarn = (p: P) => <I {...p}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></I>;
export const IcInfo = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></I>;
export const IcUsers = (p: P) => <I {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></I>;
export const IcPlus = (p: P) => <I strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IcExpand = (p: P) => <I {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></I>;
export const IcCollapse = (p: P) => <I {...p}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></I>;
export const IcFilter = (p: P) => <I {...p}><path d="M3 5h18M6 12h12M10 19h4" /></I>;
export const IcGrid = (p: P) => <I {...p}><rect x="3" y="4" width="18" height="17" /><path d="M3 9h18M9 4v17M15 4v17" /></I>;
export const IcDots = (p: P) => <I {...p}><circle cx="5" cy="7" r="1.6" /><circle cx="12" cy="7" r="2.6" /><circle cx="19" cy="7" r="1.6" /><circle cx="7" cy="16" r="2.2" /><circle cx="16" cy="16" r="1.4" /></I>;
export const IcHelp = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9M12 17h.01" /></I>;
export const IcList = (p: P) => <I {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></I>;
export const IcLink = (p: P) => <I {...p}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></I>;
export const IcEdit = (p: P) => <I {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></I>;
export const IcHub = (p: P) => <I {...p}><circle cx="12" cy="12" r="3" /><circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3" /></I>;
export const IcChevDown = (p: P) => <I {...p}><path d="M6 9l6 6 6-6" /></I>;
export const IcChart = (p: P) => <I {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></I>;
