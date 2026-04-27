/* Lee Broker Tool — Icon Set (stroke-based, 20px default) */
// All icons accept {size, color, strokeWidth, style} and render inline SVG.

const Icon = ({ size = 20, color = 'currentColor', strokeWidth = 1.6, style, children, ...rest }) => (
  <svg
    width={size} height={size}
    viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, display: 'block', ...style }}
    {...rest}
  >{children}</svg>
);

const Icons = {
  // Nav / tabs
  Listing:  (p) => <Icon {...p}><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/></Icon>,
  Sign:     (p) => <Icon {...p}><path d="M4 7h11l3 3-3 3H4zM4 14v7M4 7V3"/></Icon>,
  Voucher:  (p) => <Icon {...p}><path d="M4 4h12l4 4v12H4zM16 4v4h4M8 12h8M8 16h5"/></Icon>,
  Comp:     (p) => <Icon {...p}><path d="M4 4v16h16M8 16l3-5 3 3 5-8"/></Icon>,
  Docs:     (p) => <Icon {...p}><path d="M7 3h8l4 4v14H7zM7 3v4h4M9 13h7M9 17h5"/></Icon>,
  Contract: (p) => <Icon {...p}><path d="M7 3h8l4 4v14H7zM7 3v4h4M12 11v6M9 14h6"/></Icon>,
  Admin:    (p) => <Icon {...p}><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/></Icon>,

  // Interface
  Plus:     (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  Minus:    (p) => <Icon {...p}><path d="M5 12h14"/></Icon>,
  Check:    (p) => <Icon {...p}><path d="M4 12l5 5L20 6"/></Icon>,
  CheckCircle: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></Icon>,
  X:        (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18"/></Icon>,
  Chevron:  (p) => <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>,
  ChevronDown: (p) => <Icon {...p}><path d="M6 9l6 6 6-6"/></Icon>,
  Arrow:    (p) => <Icon {...p}><path d="M5 12h14M13 5l7 7-7 7"/></Icon>,
  Search:   (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Icon>,
  Upload:   (p) => <Icon {...p}><path d="M12 3v14M7 8l5-5 5 5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></Icon>,
  Download: (p) => <Icon {...p}><path d="M12 3v14M7 12l5 5 5-5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></Icon>,
  Send:     (p) => <Icon {...p}><path d="M21 3 3 10l7 3 3 7 8-17Z"/></Icon>,
  Edit:     (p) => <Icon {...p}><path d="M4 20h4l10-10-4-4L4 16z"/></Icon>,
  Trash:    (p) => <Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></Icon>,
  Lock:     (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></Icon>,
  Eye:      (p) => <Icon {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></Icon>,

  // Data
  Dollar:   (p) => <Icon {...p}><path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/></Icon>,
  Percent:  (p) => <Icon {...p}><path d="M5 19 19 5"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></Icon>,
  Calendar: (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Icon>,
  Pin:      (p) => <Icon {...p}><path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></Icon>,
  Building: (p) => <Icon {...p}><path d="M4 21V5l8-2v18M12 11h8v10M16 15h0M16 18h0M8 7h0M8 11h0M8 15h0"/></Icon>,

  // AI / smart
  Sparkle:  (p) => <Icon {...p}><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1M12 8l1.4 2.6L16 12l-2.6 1.4L12 16l-1.4-2.6L8 12l2.6-1.4z"/></Icon>,
  Sparkles: (p) => <Icon {...p}><path d="M10 3l1.6 3.9L16 8.5l-4.4 1.6L10 14l-1.6-3.9L4 8.5l4.4-1.6zM17 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM19 3l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/></Icon>,
  Wand:     (p) => <Icon {...p}><path d="M15 4V2M15 10V8M18 7h2M10 7h2M19 3l-1.5 1.5M12.5 9.5 11 11M21 21l-9-9M3 16.5 7.5 12l3 3L6 19.5z"/></Icon>,

  // Misc
  Menu:     (p) => <Icon {...p}><path d="M3 6h18M3 12h18M3 18h18"/></Icon>,
  Bell:     (p) => <Icon {...p}><path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3V9zM10 20a2 2 0 0 0 4 0"/></Icon>,
  User:     (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon>,
  Help:     (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.3-1 .9-1 1.7M12 17h.01"/></Icon>,
  More:     (p) => <Icon {...p}><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></Icon>,
  MoreV:    (p) => <Icon {...p}><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></Icon>,
  Filter:   (p) => <Icon {...p}><path d="M3 5h18l-7 9v5l-4 2v-7z"/></Icon>,
  Sort:     (p) => <Icon {...p}><path d="M7 4v16M3 16l4 4 4-4M17 20V4M21 8l-4-4-4 4"/></Icon>,
  Grid:     (p) => <Icon {...p}><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></Icon>,
  List:     (p) => <Icon {...p}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></Icon>,
  External: (p) => <Icon {...p}><path d="M14 3h7v7M10 14 21 3M19 13v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h7"/></Icon>,
  Copy:     (p) => <Icon {...p}><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></Icon>,
  Info:     (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></Icon>,
  Warn:     (p) => <Icon {...p}><path d="M12 3 2 20h20zM12 10v4M12 17h.01"/></Icon>,
  Logo:     (p) => <Icon {...p}><path d="M4 4v16h16" strokeWidth="2.5"/><path d="M9 14 14 9" strokeWidth="2.5"/></Icon>,

  // Property type
  Industrial: (p) => <Icon {...p}><path d="M3 21V10l6 4V10l6 4V6l6 4v11z"/><path d="M7 18h2M12 18h2M17 18h2"/></Icon>,
  Office:     (p) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/></Icon>,
  Retail:     (p) => <Icon {...p}><path d="M3 8l1.5-4h15L21 8M3 8v13h18V8M3 8h18M9 12h6"/></Icon>,
  Land:       (p) => <Icon {...p}><path d="M3 20l5-8 4 5 3-4 6 7zM16 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/></Icon>,
};

window.Icons = Icons;
window.Icon = Icon;
