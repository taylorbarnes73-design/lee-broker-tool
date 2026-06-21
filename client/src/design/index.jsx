import React from 'react';
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

export { Icons };
/* Lee Broker Tool — Primitives: Button, Input, Select, Badge, Card, Chip */

// ── Button ──
function Button({ variant = 'primary', size = 'md', icon, iconRight, children, style, disabled, loading, ...rest }) {
  const isDisabled = disabled || loading;
  const spinnerEl = loading ? (
    <span style={{
      display: 'inline-block', width: 13, height: 13,
      border: '2px solid currentColor', borderTopColor: 'transparent',
      borderRadius: '50%', animation: 'btn-spin 0.65s linear infinite',
      flexShrink: 0,
    }} aria-hidden="true" />
  ) : null;
  const sizes = {
    sm: { h: 32, px: 12, fs: 13, gap: 6 },
    md: { h: 38, px: 14, fs: 14, gap: 8 },
    lg: { h: 46, px: 18, fs: 15, gap: 10 },
  };
  const s = sizes[size] || sizes.md;
  const variants = {
    primary: { bg: 'var(--lee-crimson)', color: '#fff', border: 'var(--lee-crimson)', hover: 'var(--lee-crimson-ink)' },
    secondary: { bg: 'var(--ink-0)', color: 'var(--ink-900)', border: 'var(--ink-200)', hover: 'var(--ink-100)' },
    ghost: { bg: 'transparent', color: 'var(--ink-700)', border: 'transparent', hover: 'var(--ink-100)' },
    dark: { bg: 'var(--ink-900)', color: '#fff', border: 'var(--ink-900)', hover: 'var(--ink-800)' },
    ai: { bg: 'var(--ai-500)', color: '#fff', border: 'var(--ai-500)', hover: 'var(--ai-400)', gradient: true },
    danger: { bg: 'var(--err-600)', color: '#fff', border: 'var(--err-600)', hover: 'var(--err-700)' },
  };
  const v = variants[variant] || variants.primary;
  const [hover, setHover] = React.useState(false);
  return (
    <button
      disabled={isDisabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: s.gap,
        height: s.h, padding: `0 ${s.px}px`,
        fontSize: s.fs, fontWeight: 600, letterSpacing: '-0.005em',
        fontFamily: 'var(--font-sans)',
        background: v.gradient && !isDisabled ? 'var(--ai-gradient)' : (hover && !isDisabled ? v.hover : v.bg),
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: 'var(--r-6)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: 'background .12s var(--ease-out), box-shadow .12s, transform .06s',
        boxShadow: variant === 'primary' && !isDisabled ? '0 1px 0 rgba(0,0,0,.04), inset 0 1px 0 rgba(255,255,255,.08)' : 'none',
        ...style,
      }}
      {...rest}
    >
      {loading ? spinnerEl : icon}
      {children}
      {iconRight}
    </button>
  );
}

// ── Field wrapper (label + input + help/error) ──
function Field({ label, required, optional, help, error, aiFilled, children, span = 1, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: `span ${span}`, ...style }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <label style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em',
            color: 'var(--ink-700)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {label}
            {required && <span aria-label="required" style={{ color: 'var(--ink-500)', fontWeight: 500, fontSize: 11, letterSpacing: '0.02em' }}>Required</span>}
            {optional && <span style={{ color: 'var(--ink-400)', fontWeight: 500, fontSize: 11 }}>Optional</span>}
          </label>
          {aiFilled && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              color: 'var(--ai-500)', background: 'var(--ai-100)',
              padding: '2px 6px', borderRadius: 4,
            }}>
              <Icons.Sparkles size={10}/> AI
            </span>
          )}
        </div>
      )}
      {children}
      {help && !error && <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{help}</div>}
      {error && <div style={{ fontSize: 11, color: 'var(--err-600)', display:'flex', alignItems:'center', gap:4 }}><Icons.Warn size={12}/>{error}</div>}
    </div>
  );
}

// ── Input (text) ──
function Input({ prefix, suffix, auto, aiFilled, error, style, inputStyle, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const borderColor = error ? 'var(--err-600)'
    : focus ? 'var(--lee-crimson)'
    : aiFilled ? 'var(--ai-400)'
    : 'var(--ink-200)';
  const bg = auto ? 'var(--ink-100)' : (aiFilled ? '#FBF8FE' : 'var(--ink-0)');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: 40,
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--r-6)',
      padding: '0 12px',
      transition: 'border-color .12s, box-shadow .12s, background .12s',
      boxShadow: focus ? 'var(--ring-crimson)' : (aiFilled ? 'var(--ring-ai)' : 'none'),
      ...style,
    }}>
      {prefix && <span style={{ color: 'var(--ink-400)', fontSize: 14, display:'flex', alignItems:'center' }}>{prefix}</span>}
      <input
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        readOnly={auto}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          fontSize: 14, fontWeight: 500,
          color: 'var(--ink-900)',
          minWidth: 0,
          ...inputStyle,
        }}
        {...rest}
      />
      {auto && <span style={{ fontSize: 10, color: 'var(--ink-400)', fontWeight: 600, letterSpacing: '0.06em', textTransform:'uppercase' }}>AUTO</span>}
      {suffix && <span style={{ color: 'var(--ink-500)', fontSize: 13 }}>{suffix}</span>}
    </div>
  );
}

// ── Select ──
function Select({ value, onChange, options = [], placeholder, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{
      position: 'relative',
      height: 40, background: 'var(--ink-0)',
      border: `1px solid ${focus ? 'var(--lee-crimson)' : 'var(--ink-200)'}`,
      borderRadius: 'var(--r-6)',
      boxShadow: focus ? 'var(--ring-crimson)' : 'none',
      transition: 'border-color .12s, box-shadow .12s',
      ...style,
    }}>
      <select
        value={value} onChange={onChange}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          width: '100%', height: '100%', border: 'none', outline: 'none',
          background: 'transparent', padding: '0 36px 0 12px',
          fontSize: 14, fontWeight: 500, color: 'var(--ink-900)',
          cursor: 'pointer',
        }}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o, i) => typeof o === 'string'
          ? <option key={i} value={o}>{o}</option>
          : <option key={i} value={o.value}>{o.label}</option>
        )}
      </select>
      <Icons.ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-500)', pointerEvents: 'none' }}/>
    </div>
  );
}

// ── Toggle ──
function Toggle({ on, onClick, size = 'md' }) {
  const w = size === 'sm' ? 32 : 40;
  const h = size === 'sm' ? 18 : 22;
  const k = h - 4;
  return (
    <button onClick={onClick} style={{
      width: w, height: h, padding: 2,
      background: on ? 'var(--lee-crimson)' : 'var(--ink-300)',
      border: 'none', borderRadius: 999,
      cursor: 'pointer', display: 'flex', alignItems: 'center',
      transition: 'background .16s var(--ease-out)',
    }}>
      <span style={{
        width: k, height: k, background: '#fff', borderRadius: '50%',
        transform: `translateX(${on ? (w - k - 4) : 0}px)`,
        transition: 'transform .2s var(--ease-out)',
        boxShadow: '0 1px 2px rgba(0,0,0,.15)',
      }}/>
    </button>
  );
}

// ── Badge / chip ──
function Badge({ tone = 'neutral', children, icon, size = 'md', style }) {
  const tones = {
    neutral:  { bg: 'var(--ink-100)', color: 'var(--ink-700)', border: 'var(--ink-200)' },
    crimson:  { bg: 'var(--lee-crimson-wash)', color: 'var(--lee-crimson-ink)', border: 'rgba(122,0,36,.22)' },
    slate:    { bg: 'var(--lee-slate-wash)', color: 'var(--lee-slate)', border: 'rgba(126,128,131,.2)' },
    success:  { bg: 'var(--ok-100)', color: 'var(--ok-600)', border: 'rgba(107,117,23,.2)' },
    warn:     { bg: 'var(--warn-100)', color: 'var(--warn-600)', border: 'rgba(134,65,28,.2)' },
    danger:   { bg: 'var(--err-100)', color: 'var(--err-600)', border: 'rgba(205,20,66,.2)' },
    ai:       { bg: 'var(--ai-100)', color: 'var(--ai-500)', border: 'rgba(110,63,217,.2)' },
    dark:     { bg: 'var(--ink-900)', color: '#fff', border: 'var(--ink-900)' },
  };
  const t = tones[tone] || tones.neutral;
  const sz = size === 'sm' ? { h: 18, fs: 10, px: 6, gap: 3 } : { h: 22, fs: 11, px: 8, gap: 4 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sz.gap,
      height: sz.h, padding: `0 ${sz.px}px`,
      fontSize: sz.fs, fontWeight: 600, letterSpacing: '0.02em',
      background: t.bg, color: t.color,
      border: `1px solid ${t.border}`,
      borderRadius: 999,
      ...style,
    }}>{icon}{children}</span>
  );
}

// ── Card ──
function Card({ children, padding = 24, style, hoverable }) {
  const [hover, setHover] = React.useState(false);
  const resolvedPadding =
    typeof padding === "number"
      ? padding
      : {
          sm: 16,
          md: 24,
          lg: 32,
          xl: 40,
          none: 0,
        }[padding] ?? 24;
  return (
    <div
      onMouseEnter={() => hoverable && setHover(true)}
      onMouseLeave={() => hoverable && setHover(false)}
      style={{
        background: 'var(--ink-0)',
        border: '1px solid var(--ink-200)',
        borderRadius: 'var(--r-12)',
        padding: resolvedPadding,
        boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transition: 'box-shadow .15s, border-color .15s',
        ...style,
      }}
    >{children}</div>
  );
}

export {  Button, Field, Input, Select, Toggle, Badge, Card  };
