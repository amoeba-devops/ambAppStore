import type { SVGProps } from 'react';

// Ported verbatim from design/project/ui.jsx — lucide-style inline SVG icons,
// keeps prototype's exact path data so visual is pixel-identical.

export type IconName =
  | 'dashboard' | 'trips' | 'costs' | 'vehicles' | 'drivers' | 'users'
  | 'reports' | 'settings' | 'audit' | 'search' | 'bell' | 'plus'
  | 'filter' | 'download' | 'calendar' | 'check' | 'x' | 'chev' | 'chevd'
  | 'more' | 'pin' | 'fuel' | 'wrench' | 'alert' | 'arrow-r' | 'arrow-tr'
  | 'spark' | 'clock' | 'car' | 'user' | 'doc' | 'phone' | 'shield' | 'key' | 'warn' | 'inbox';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
} & Omit<SVGProps<SVGSVGElement>, 'name' | 'color'>;

export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.75, ...rest }: Props) {
  const common = {
    width: size,
    height: size,
    stroke: color,
    fill: 'none',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    ...rest,
  };
  const p = (...d: string[]) => d.map((dd, i) => <path key={i} d={dd} />);

  switch (name) {
    case 'dashboard':
      return <svg {...common}>{p('M3 13a9 9 0 1 1 18 0', 'M12 13l4-3')}<circle cx="12" cy="13" r="1.5" fill={color} stroke="none" /></svg>;
    case 'trips':
      return <svg {...common}>{p('M5 17h14', 'M7 17l1.5-5h7L17 17', 'M6 13h12')}<circle cx="8" cy="18.5" r="1.5" /><circle cx="16" cy="18.5" r="1.5" /></svg>;
    case 'costs':
      return <svg {...common}>{p('M4 5h16v14H4z', 'M4 9h16', 'M8 14h2', 'M14 14h2')}</svg>;
    case 'vehicles':
      return <svg {...common}>{p('M5 16h14', 'M7 16l1.2-5h7.6L17 16', 'M5 16v3h2v-3', 'M17 16v3h2v-3')}<circle cx="9" cy="16" r="1.5" /><circle cx="15" cy="16" r="1.5" /></svg>;
    case 'drivers':
      return <svg {...common}><circle cx="12" cy="8" r="3.5" />{p('M5 20c1-4 4.5-5.5 7-5.5s6 1.5 7 5.5')}</svg>;
    case 'users':
      return <svg {...common}><circle cx="9" cy="9" r="3" />{p('M3 19c0-3 3-5 6-5s6 2 6 5', 'M16 6a3 3 0 0 1 0 6', 'M16 14c2.5 0 5 1.5 5 4')}</svg>;
    case 'reports':
      return <svg {...common}>{p('M5 4h10l4 4v12H5z', 'M14 4v5h5', 'M8 13h7', 'M8 16h5')}</svg>;
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3" />{p('M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z')}</svg>;
    case 'audit':
      return <svg {...common}>{p('M6 4h9l4 4v12H6z', 'M14 4v5h5', 'M9 13h7', 'M9 16h7', 'M9 10h4')}</svg>;
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="6" />{p('M20 20l-4-4')}</svg>;
    case 'bell':
      return <svg {...common}>{p('M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z', 'M10 21h4')}</svg>;
    case 'plus':
      return <svg {...common}>{p('M5 12h14', 'M12 5v14')}</svg>;
    case 'filter':
      return <svg {...common}>{p('M4 5h16', 'M7 12h10', 'M10 19h4')}</svg>;
    case 'download':
      return <svg {...common}>{p('M12 4v12', 'M7 11l5 5 5-5', 'M5 20h14')}</svg>;
    case 'calendar':
      return <svg {...common}>{p('M5 6h14v14H5z', 'M5 10h14', 'M9 4v3', 'M15 4v3')}</svg>;
    case 'check':
      return <svg {...common}>{p('M5 12.5l4.5 4.5L19 7')}</svg>;
    case 'x':
      return <svg {...common}>{p('M6 6l12 12', 'M18 6L6 18')}</svg>;
    case 'chev':
      return <svg {...common}>{p('M9 6l6 6-6 6')}</svg>;
    case 'chevd':
      return <svg {...common}>{p('M6 9l6 6 6-6')}</svg>;
    case 'more':
      return <svg {...common}><circle cx="6" cy="12" r="1.2" fill={color} stroke="none" /><circle cx="12" cy="12" r="1.2" fill={color} stroke="none" /><circle cx="18" cy="12" r="1.2" fill={color} stroke="none" /></svg>;
    case 'pin':
      return <svg {...common}>{p('M12 21s7-7.2 7-12a7 7 0 0 0-14 0c0 4.8 7 12 7 12Z')}<circle cx="12" cy="9" r="2.5" /></svg>;
    case 'fuel':
      return <svg {...common}>{p('M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15', 'M4 20h11', 'M14 9h3l2 2v7a2 2 0 0 1-4 0v-2', 'M8 8h3v3H8z')}</svg>;
    case 'wrench':
      return <svg {...common}>{p('M14 7a4 4 0 1 1 4 4l-9 9-3-3 9-9a4 4 0 0 1-1-1Z')}</svg>;
    case 'alert':
    case 'warn':
      return <svg {...common}>{p('M12 4l9 16H3z', 'M12 11v4')}<circle cx="12" cy="17.5" r=".8" fill={color} stroke="none" /></svg>;
    case 'arrow-r':
      return <svg {...common}>{p('M5 12h14', 'M13 6l6 6-6 6')}</svg>;
    case 'arrow-tr':
      return <svg {...common}>{p('M7 17L17 7', 'M9 7h8v8')}</svg>;
    case 'spark':
      return <svg {...common}>{p('M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6Z')}</svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="8" />{p('M12 8v4l3 2')}</svg>;
    case 'car':
      return <svg {...common}>{p('M4 14l1.6-5.5A2 2 0 0 1 7.5 7h9a2 2 0 0 1 1.9 1.5L20 14', 'M3 14h18v5h-3v-2H6v2H3z')}<circle cx="7.5" cy="16" r="1.2" /><circle cx="16.5" cy="16" r="1.2" /></svg>;
    case 'user':
      return <svg {...common}><circle cx="12" cy="9" r="3.5" />{p('M5 20c1-4 4.5-5.5 7-5.5s6 1.5 7 5.5')}</svg>;
    case 'doc':
      return <svg {...common}>{p('M6 4h9l4 4v12H6z', 'M14 4v5h5')}</svg>;
    case 'phone':
      return <svg {...common}>{p('M5 4h4l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v4a2 2 0 0 1-2 2A14 14 0 0 1 5 6a2 2 0 0 1 0-2z')}</svg>;
    case 'shield':
      return <svg {...common}>{p('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z')}</svg>;
    case 'key':
      return <svg {...common}><circle cx="8" cy="14" r="4" />{p('M11 14h10', 'M17 14v3', 'M21 14v2')}</svg>;
    case 'inbox':
      return <svg {...common}>{p('M4 14l3-9h10l3 9', 'M4 14h6l1 2h2l1-2h6v6H4z')}</svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="6" /></svg>;
  }
}
