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
export { Icon };
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
  const s = sizes[size];
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
        display: 'inline-flex', alignItems: 'center', gap: s.gap,
        height: s.h, padding: `0 ${s.px}px`,
        fontSize: s.fs, fontWeight: 600, letterSpacing: '-0.005em',
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
function Select({ value, onChange, options, placeholder, style, ...rest }) {
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
    crimson:  { bg: 'var(--lee-crimson-wash)', color: 'var(--lee-crimson-ink)', border: 'rgba(1,105,111,.22)' },
    slate:    { bg: 'var(--lee-slate-wash)', color: 'var(--lee-slate)', border: 'rgba(87,90,116,.2)' },
    success:  { bg: 'var(--ok-100)', color: 'var(--ok-600)', border: 'rgba(15,122,63,.2)' },
    warn:     { bg: 'var(--warn-100)', color: 'var(--warn-600)', border: 'rgba(179,107,0,.2)' },
    danger:   { bg: 'var(--err-100)', color: 'var(--err-600)', border: 'rgba(180,35,24,.2)' },
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

// ── Step card (progressive disclosure) ──
function StepCard({ step, total, title, subtitle, status = 'active', summary, children, onClick }) {
  // status: 'locked' | 'active' | 'complete'
  const isActive = status === 'active';
  const isComplete = status === 'complete';
  const isLocked = status === 'locked';
  return (
    <div style={{
      background: isComplete ? 'var(--ok-100)' : (isLocked ? 'var(--ink-100)' : 'var(--ink-0)'),
      border: `1px solid ${isActive ? 'var(--lee-crimson-wash)' : (isComplete ? 'rgba(15,122,63,.25)' : 'var(--ink-200)')}`,
      borderLeft: `4px solid ${isActive ? 'var(--lee-crimson)' : (isComplete ? 'var(--ok-500)' : (isLocked ? 'var(--ink-300)' : 'var(--ink-300)'))}`,
      borderRadius: 'var(--r-12)',
      padding: isActive ? 28 : 20,
      boxShadow: isActive ? 'var(--shadow-md)' : 'none',
      opacity: isLocked ? 0.7 : 1,
      cursor: (isComplete || isLocked) ? 'pointer' : 'default',
      transition: 'all .18s var(--ease-out)',
    }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: isActive ? 'flex-start' : 'center', gap: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 999,
          background: isComplete ? 'var(--ok-500)' : (isActive ? 'var(--lee-crimson)' : 'var(--ink-200)'),
          color: isComplete || isActive ? '#fff' : 'var(--ink-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {isComplete ? <Icons.Check size={14} strokeWidth={2.4}/> : (isLocked ? <Icons.Lock size={12}/> : step)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-500)' }}>
              Step {step} of {total}
            </div>
            {isComplete && <Badge tone="success" size="sm">Complete</Badge>}
            {isLocked && <Badge size="sm">Locked</Badge>}
          </div>
          <div style={{ fontSize: isActive ? 20 : 16, fontWeight: 600, color: 'var(--ink-900)', marginTop: 2, letterSpacing: '-0.01em' }}>
            {title}
          </div>
          {subtitle && isActive && <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>{subtitle}</div>}
          {isComplete && summary && <div style={{ fontSize: 13, color: 'var(--ink-600)', marginTop: 4 }}>{summary}</div>}
        </div>
        {isComplete && <Icons.Edit size={16} style={{ color: 'var(--ink-400)' }}/>}
      </div>
      {isActive && children && (
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--ink-150)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Section header (inside cards) ──
function SectionHeader({ eyebrow, title, description, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
      <div>
        {eyebrow && <div className="lee-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink-900)' }}>{title}</div>
        {description && <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4, maxWidth: 560 }}>{description}</div>}
      </div>
      {right}
    </div>
  );
}

export {  Button, Field, Input, Select, Toggle, Badge, Card, StepCard, SectionHeader  };
/* Lee Broker Tool — App Shell: header, tab nav, broker profile, AI button */

function AppShell({ activeTab, onTab, profile, onProfileClick, onAiClick, children, viewportH = 1080, viewportW = 1440 }) {
  const tabs = [
    { id: 'listing', label: 'Listings', icon: Icons.Listing },
    { id: 'sign', label: 'Sign Orders', icon: Icons.Sign },
    { id: 'voucher', label: 'Vouchers', icon: Icons.Voucher },
    { id: 'comp', label: 'Comps', icon: Icons.Comp },
    { id: 'queue', label: 'Queue', icon: Icons.List },
    { id: 'contract', label: 'Contracts', icon: Icons.Contract },
    { id: 'docs', label: 'Documents', icon: Icons.Docs },
    { id: 'admin', label: 'Admin', icon: Icons.Admin },
  ];

  return (
    <div className="lee-app" style={{
      width: viewportW, height: viewportH, display: 'flex', flexDirection: 'column',
      background: 'var(--ink-50)', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <header style={{
        height: 56, flexShrink: 0,
        background: 'var(--ink-900)', color: '#fff',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 24,
        borderBottom: '1px solid var(--ink-800)',
      }}>
        {/* Logo lockup — real Lee & Associates Newport Beach mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img
            src="/lee-newport-beach-white.png"
            alt="Lee & Associates Newport Beach"
            style={{ height: 34, width: 'auto', display: 'block' }}
          />
          <div style={{
            width: 1, height: 24, background: 'rgba(255,255,255,.18)'
          }}/>
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-200)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Broker Desk
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--ink-400)', marginTop: 3, letterSpacing: '0.06em' }}>
              Newport Beach · Commercial Real Estate
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}/>

        {/* Global search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: 280, height: 32, padding: '0 12px',
          background: 'rgba(255,255,255,.07)',
          borderRadius: 6, color: 'var(--ink-300)',
          fontSize: 13,
        }}>
          <Icons.Search size={14}/>
          <span>Search deals, properties, brokers…</span>
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 10, padding: '2px 5px', border: '1px solid rgba(255,255,255,.15)', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>⌘K</span>
        </div>

        {/* AI button */}
        <button onClick={onAiClick} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 32, padding: '0 12px',
          background: 'var(--ai-gradient)',
          border: 'none', borderRadius: 6,
          color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 0 0 1px rgba(255,255,255,.08) inset, 0 4px 12px rgba(139,95,240,.35)',
        }}>
          <Icons.Sparkles size={14}/>
          Deal Assist
        </button>

        <RequestTracker/>

        <button style={{ background:'transparent', border:'none', color: 'var(--ink-300)', cursor:'pointer', position:'relative', padding: 8 }}>
          <Icons.Bell size={18}/>
          <span style={{ position:'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 999, background: 'var(--lee-crimson)' }}/>
        </button>

        {/* Profile */}
        <button onClick={onProfileClick} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          height: 36, padding: '0 10px 0 4px',
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 8, color: '#fff', cursor: 'pointer',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--lee-crimson)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
          }}>{profile?.initials || 'JB'}</div>
          <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{profile?.name || 'Jane Broker'}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-400)' }}>{profile?.title || 'Broker · DRE #01234567'}</div>
          </div>
          <Icons.ChevronDown size={14} style={{ color: 'var(--ink-400)' }}/>
        </button>
      </header>

      {/* Tab rail */}
      <nav style={{
        height: 52, flexShrink: 0,
        background: 'var(--ink-0)',
        borderBottom: '1px solid var(--ink-200)',
        display: 'flex', alignItems: 'stretch',
        padding: '0 24px',
      }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          const Ic = t.icon;
          return (
            <button key={t.id} onClick={() => onTab && onTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 18px',
              fontSize: 13, fontWeight: active ? 600 : 500,
              color: active ? 'var(--lee-crimson)' : 'var(--ink-600)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              position: 'relative',
              letterSpacing: '-0.005em',
            }}>
              <Ic size={16}/>
              {t.label}
              {active && (
                <span style={{
                  position: 'absolute', left: 12, right: 12, bottom: -1, height: 2,
                  background: 'var(--lee-crimson)', borderRadius: '2px 2px 0 0',
                }}/>
              )}
            </button>
          );
        })}
        <div style={{ flex: 1 }}/>
        <div style={{ display:'flex', alignItems:'center', gap: 10, color: 'var(--ink-500)', fontSize: 12 }}>
          <span className="lee-eyebrow" style={{ fontSize: 10 }}>System</span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:6, height:6, borderRadius:999, background:'var(--ok-500)' }}/>
            All services operational
          </span>
        </div>
      </nav>

      {/* Page content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}

// Progress bar that sits under page title
function StepProgress({ step, total, percent }) {
  const pct = percent ?? Math.round((step / total) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--ink-200)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'var(--lee-crimson)',
          borderRadius: 999, transition: 'width .3s var(--ease-out)',
        }}/>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', whiteSpace: 'nowrap' }}>
        Step {step} of {total} <span style={{ color: 'var(--ink-400)' }}>· {pct}%</span>
      </div>
    </div>
  );
}

// Page header — consistent per tab
function PageHeader({ title, description, eyebrow, right, children }) {
  return (
    <div style={{
      background: 'var(--ink-0)',
      borderBottom: '1px solid var(--ink-200)',
      padding: '24px 32px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 }}>
        <div>
          {eyebrow && <div className="lee-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-900)' }}>
            {title}
          </div>
          {description && <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4, maxWidth: 640 }}>{description}</div>}
        </div>
        {right && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{right}</div>}
      </div>
      {children && <div style={{ marginTop: 20 }}>{children}</div>}
    </div>
  );
}

// Segmented control (for sub-tabs like Add/Modify or Lease/Sale)
function Segmented({ options, value, onChange, size = 'md' }) {
  const h = size === 'sm' ? 30 : 36;
  return (
    <div style={{
      display: 'inline-flex', padding: 3,
      background: 'var(--ink-100)', borderRadius: 8,
      border: '1px solid var(--ink-200)',
    }}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const active = v === value;
        return (
          <button key={v} onClick={() => onChange && onChange(v)} style={{
            height: h, padding: '0 14px',
            fontSize: size === 'sm' ? 12 : 13, fontWeight: active ? 600 : 500,
            color: active ? 'var(--ink-900)' : 'var(--ink-600)',
            background: active ? 'var(--ink-0)' : 'transparent',
            border: 'none', borderRadius: 6, cursor: 'pointer',
            boxShadow: active ? '0 1px 2px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)' : 'none',
            transition: 'all .12s',
          }}>{l}</button>
        );
      })}
    </div>
  );
}

// ── Request Tracker popover — shows my submissions & queue position ──
function RequestTracker() {
  const [open, setOpen] = React.useState(false);
  const requests = [
    { id:'V-2026-0418', type:'Voucher', label:'2847 Newport Blvd · $127,935', stage:'admin-review', pos: 2, eta:'~1h' },
    { id:'L-2026-0412', type:'Listing', label:'1250 E Alton Ave', stage:'mls-push', pos: 1, eta:'~15m' },
    { id:'S-2026-0410', type:'Sign Order', label:'3400 Bristol St · 3 signs', stage:'vendor', pos: 5, eta:'3 days' },
    { id:'V-2026-0405', type:'Voucher', label:'875 W 17th St · $58,200', stage:'complete' },
  ];
  const inQueue = requests.filter(r => r.stage !== 'complete').length;
  const stages = [
    { id:'submitted',     label:'Submitted' },
    { id:'admin-review',  label:'Admin review' },
    { id:'mls-push',      label:'MLS / Dealius' },
    { id:'vendor',        label:'Vendor' },
    { id:'complete',      label:'Complete' },
  ];
  const stageIndex = (s) => stages.findIndex(x => x.id === s);

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display:'flex', alignItems:'center', gap: 8, height: 32, padding: '0 12px',
        background: open ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.07)',
        border:'1px solid rgba(255,255,255,.08)', borderRadius: 6,
        color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>
        <span style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width: 14, height: 14 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--warn-500)', boxShadow: '0 0 0 0 rgba(212,136,6,.6)', animation: 'leeBeacon 1.8s ease-out infinite' }}/>
        </span>
        Requests
        <span style={{
          padding: '1px 6px', borderRadius: 999,
          background: 'var(--lee-crimson)', color:'#fff',
          fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
        }}>{inQueue}</span>
        <Icons.ChevronDown size={12} style={{ color: 'var(--ink-400)' }}/>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset: 0, zIndex: 40 }}/>
          <div style={{
            position:'absolute', top: 40, right: 0, width: 460, zIndex: 41,
            background: 'var(--ink-0)', color: 'var(--ink-900)',
            border: '1px solid var(--ink-200)', borderRadius: 12,
            boxShadow: '0 24px 60px rgba(10,10,11,.25)',
            overflow: 'hidden', fontFamily: 'var(--font-sans)',
          }}>
            {/* Header */}
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--ink-150)', display:'flex', alignItems:'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>My requests</div>
                <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{inQueue} in progress · {requests.length - inQueue} complete this week</div>
              </div>
              <button style={{ fontSize: 11, fontWeight: 600, color: 'var(--lee-crimson)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
            </div>

            {/* Request list */}
            <div style={{ maxHeight: 460, overflow: 'auto' }}>
              {requests.map((r, i) => {
                const done = r.stage === 'complete';
                const si = stageIndex(r.stage);
                return (
                  <div key={r.id} style={{
                    padding: '14px 18px',
                    borderTop: i > 0 ? '1px solid var(--ink-150)' : 'none',
                    background: done ? 'var(--ink-0)' : 'var(--ink-0)',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 10 }}>
                      <Badge tone={done ? 'success' : (r.type === 'Voucher' ? 'crimson' : r.type === 'Listing' ? 'slate' : 'neutral')} size="sm">{r.type}</Badge>
                      <div style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
                      <span className="lee-mono" style={{ fontSize: 10, color: 'var(--ink-400)' }}>{r.id}</span>
                    </div>

                    {/* Stage rail */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      {stages.map((s, idx) => {
                        const past = idx < si;
                        const current = idx === si;
                        const active = past || current;
                        const isDone = done && idx === stages.length - 1;
                        return (
                          <React.Fragment key={s.id}>
                            <div style={{
                              display:'flex', flexDirection:'column', alignItems:'center', gap: 4,
                              minWidth: 0, flexShrink: 0,
                            }}>
                              <div style={{
                                width: current ? 14 : 10, height: current ? 14 : 10, borderRadius: 999,
                                background: isDone ? 'var(--ok-500)' : (current ? 'var(--lee-crimson)' : (past ? 'var(--ink-700)' : 'var(--ink-200)')),
                                border: current ? '3px solid var(--lee-crimson-wash)' : 'none',
                                boxShadow: current ? '0 0 0 2px var(--lee-crimson), 0 0 0 5px var(--lee-crimson-glow)' : 'none',
                                transition: 'all .2s',
                              }}/>
                            </div>
                            {idx < stages.length - 1 && (
                              <div style={{
                                flex: 1, height: 2, margin: current ? '0 3px' : '0 2px',
                                background: past ? 'var(--ink-700)' : 'var(--ink-200)',
                              }}/>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      {stages.map((s, idx) => (
                        <div key={s.id} style={{
                          fontSize: 9.5, fontWeight: idx === si ? 700 : 500,
                          color: idx === si ? 'var(--lee-crimson)' : (idx < si ? 'var(--ink-600)' : 'var(--ink-400)'),
                          letterSpacing: '0.02em',
                        }}>{s.label}</div>
                      ))}
                    </div>

                    {/* Status row */}
                    {!done && (
                      <div style={{ marginTop: 10, display:'flex', alignItems:'center', gap: 8, padding: '8px 10px', background: 'var(--ink-50)', borderRadius: 6 }}>
                        <span style={{ display: 'inline-flex', width: 6, height: 6, borderRadius: 999, background: 'var(--warn-500)' }}/>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-700)' }}>
                          <b>#{r.pos}</b> in {stages[si]?.label.toLowerCase()} queue
                        </span>
                        <span style={{ color: 'var(--ink-300)' }}>·</span>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>Est. {r.eta}</span>
                        <div style={{ flex: 1 }}/>
                        <button style={{ fontSize: 11, fontWeight: 600, color: 'var(--lee-crimson)', background: 'none', border: 'none', cursor: 'pointer' }}>Details →</button>
                      </div>
                    )}
                    {done && (
                      <div style={{ marginTop: 10, display:'flex', alignItems:'center', gap: 8, padding: '8px 10px', background: 'var(--ok-100)', borderRadius: 6 }}>
                        <Icons.CheckCircle size={12} style={{ color: 'var(--ok-600)' }}/>
                        <span style={{ fontSize: 11.5, color: 'var(--ok-600)', fontWeight: 600 }}>Processed · Dealius confirmed</span>
                        <div style={{ flex: 1 }}/>
                        <button style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-600)', background: 'none', border: 'none', cursor: 'pointer' }}>View receipt →</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes leeBeacon { 0% { box-shadow: 0 0 0 0 rgba(212,136,6,.55); } 70% { box-shadow: 0 0 0 8px rgba(212,136,6,0); } 100% { box-shadow: 0 0 0 0 rgba(212,136,6,0); } }`}</style>
    </div>
  );
}

export {  AppShell, StepProgress, PageHeader, Segmented, RequestTracker  };
/* Lee Broker Tool — Listing Entry screen */

function ListingEntryScreen() {
  const [subTab, setSubTab] = React.useState('add');
  const [propType, setPropType] = React.useState('Industrial');
  const [dealType, setDealType] = React.useState('Lease');
  const [showAiFill, setShowAiFill] = React.useState(false);

  return (
    <div>
      <PageHeader
        eyebrow="Broker Desk"
        title="New Listing"
        description="Enter a new listing and submit to MLS. Upload a brochure to let Deal Assist fill the form for you."
        right={<>
          <Segmented
            options={[{value:'add', label:'Add Listing'}, {value:'modify', label:'Modify Listing'}]}
            value={subTab} onChange={setSubTab} size="sm"
          />
          <Button variant="ghost" size="sm" icon={<Icons.Help size={14}/>}>Help</Button>
        </>}
      >
        <StepProgress step={3} total={7} percent={38}/>
      </PageHeader>

      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AI brochure upload — ambient but prominent */}
          <Card padding={0} style={{
            background: 'linear-gradient(120deg, #FBF8FE 0%, #FEF4F6 100%)',
            border: '1px solid rgba(139,95,240,.2)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: 'var(--ai-gradient)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
                boxShadow: '0 6px 18px rgba(139,95,240,.3)',
              }}>
                <Icons.Wand size={22}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Skip the typing — drop a brochure
                  <Badge tone="ai" size="sm" icon={<Icons.Sparkles size={10}/>}>AI</Badge>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 2 }}>
                  We'll extract address, SF, rate, term, photos and pre-fill this form in ~8 seconds.
                </div>
              </div>
              <Button variant="ai" size="sm" icon={<Icons.Upload size={14}/>} onClick={() => setShowAiFill(true)}>
                Upload brochure
              </Button>
              <Button variant="ghost" size="sm">Paste URL</Button>
            </div>
          </Card>

          {/* Step 1 — complete */}
          <StepCard
            step={1} total={7} status="complete"
            title="Transaction type"
            summary="Lease · Industrial · 2,847 Newport Blvd, Costa Mesa CA 92627"
          />

          {/* Step 2 — complete */}
          <StepCard
            step={2} total={7} status="complete"
            title="Property details"
            summary="24,500 SF · Clear height 28' · 4 DH doors · Built 2005"
          />

          {/* Step 3 — active */}
          <StepCard
            step={3} total={7} status="active"
            title="Listing terms"
            subtitle="Rate, term, commission and what's shown to MLS."
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              <Field label="Asking rate" required aiFilled>
                <Input prefix="$" suffix="/ SF / Mo" defaultValue="1.45"/>
              </Field>
              <Field label="Term">
                <Select value="5" onChange={()=>{}} options={[
                  {value:'neg', label:'Negotiable'},
                  {value:'3', label:'3 years'},
                  {value:'5', label:'5 years'},
                  {value:'7', label:'7 years'},
                  {value:'10', label:'10 years'},
                ]}/>
              </Field>
              <Field label="NNN / Expense type" required>
                <Select value="NNN" onChange={()=>{}} options={['NNN','Gross','Modified Gross','Industrial Gross']}/>
              </Field>
              <Field label="Available">
                <Input prefix={<Icons.Calendar size={14}/>} defaultValue="June 1, 2026"/>
              </Field>

              <Field label="Commission — listing side" required span={1}>
                <Input suffix="%" defaultValue="3.00"/>
              </Field>
              <Field label="Commission — procuring" required span={1}>
                <Input suffix="%" defaultValue="3.00"/>
              </Field>
              <Field label="Total consideration" span={2}>
                <Input auto value="$2,132,250.00" prefix="$" style={{fontFamily:'var(--font-mono)'}}/>
              </Field>
            </div>

            {/* MLS visibility toggle */}
            <div style={{
              marginTop: 24, padding: 16,
              background: 'var(--ink-50)', border: '1px solid var(--ink-200)',
              borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--lee-slate-wash)', color: 'var(--lee-slate)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icons.Eye size={18}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>Reveal prices to MLS</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 1 }}>Off hides asking rate on CoStar &amp; AIR feeds; agents will "Call for info".</div>
              </div>
              <Toggle on={true}/>
            </div>

            {/* Footer actions */}
            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button variant="ghost" icon={<Icons.Chevron size={14} style={{transform:'rotate(180deg)'}}/>}>Back</Button>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary">Save draft</Button>
                <Button variant="primary" iconRight={<Icons.Arrow size={14}/>}>Continue to agents</Button>
              </div>
            </div>
          </StepCard>

          {/* Remaining locked */}
          <StepCard step={4} total={7} status="locked" title="Agents &amp; commission split"/>
          <StepCard step={5} total={7} status="locked" title="Property description &amp; media"/>
          <StepCard step={6} total={7} status="locked" title="Upload agreements"/>
          <StepCard step={7} total={7} status="locked" title="Review &amp; submit to MLS"/>
        </div>

        {/* Right rail */}
        <ListingSidebar/>
      </div>
    </div>
  );
}

function ListingSidebar() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 16, position: 'sticky', top: 24 }}>
      {/* Deal summary */}
      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 12 }}>Deal at a glance</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)', letterSpacing: '-0.01em' }}>
          2847 Newport Blvd
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Costa Mesa, CA 92627</div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Metric label="Size" value="24,500" unit="SF"/>
          <Metric label="Rate" value="$1.45" unit="/SF/Mo NNN"/>
          <Metric label="Term" value="5" unit="years"/>
          <Metric label="Available" value="Jun 1"/>
        </div>

        <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--ink-150)', borderBottom: '1px solid var(--ink-150)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Est. total consideration</span>
            <span className="lee-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>$2,132,250</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Est. commission</span>
            <span className="lee-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--lee-crimson)' }}>$127,935</span>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SummaryRow ok label="Property details"/>
          <SummaryRow ok label="Transaction"/>
          <SummaryRow current label="Terms"/>
          <SummaryRow label="Agents"/>
          <SummaryRow label="Media"/>
          <SummaryRow label="Agreements"/>
        </div>
      </Card>

      {/* AI insights */}
      <Card padding={18} style={{ background: '#FBF8FE', border: '1px solid rgba(139,95,240,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icons.Sparkles size={14} style={{ color: 'var(--ai-500)' }}/>
          <div className="lee-eyebrow" style={{ color: 'var(--ai-500)' }}>Market context</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-700)', lineHeight: 1.5 }}>
          Your asking rate is <b>6% above</b> the median for industrial space in Costa Mesa (last 90 days: $1.37/SF/Mo NNN).
        </div>
        <button style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--ai-500)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          See 12 comparable deals →
        </button>
      </Card>
    </div>
  );
}

function Metric({ label, value, unit }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--ink-500)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span className="lee-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>{unit}</span>}
      </div>
    </div>
  );
}

function SummaryRow({ ok, current, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <div style={{
        width: 14, height: 14, borderRadius: 999,
        background: ok ? 'var(--ok-500)' : (current ? 'var(--lee-crimson)' : 'var(--ink-200)'),
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {ok && <Icons.Check size={10} strokeWidth={3}/>}
        {current && <span style={{ width: 4, height: 4, borderRadius: 999, background: '#fff' }}/>}
      </div>
      <span style={{
        color: ok ? 'var(--ink-500)' : (current ? 'var(--ink-900)' : 'var(--ink-500)'),
        fontWeight: current ? 600 : 500,
        textDecoration: ok ? 'line-through' : 'none',
        textDecorationColor: 'var(--ink-300)',
      }}>{label}</span>
    </div>
  );
}

export {  ListingEntryScreen  };
/* Lee Broker Tool — Sign Request + Voucher screens */

function SignRequestScreen() {
  const [shape, setShape] = React.useState('sf');
  const [qty, setQty] = React.useState({ '4x8': 2, '6x8': 0, 'other': 0, 'banner': 1 });
  const [otherSize, setOtherSize] = React.useState('');
  const [bannerSize, setBannerSize] = React.useState('');
  const [nameRider, setNameRider] = React.useState(true);

  const step = (k, d) => setQty(q => ({ ...q, [k]: Math.max(0, q[k] + d) }));

  return (
    <div>
      <PageHeader
        eyebrow="Broker Desk"
        title="Sign Order"
        description="Order and install signage for an active listing. PO # is auto-generated."
        right={<>
          <Badge tone="neutral" icon={<Icons.Copy size={11}/>}>PO-2026-0418</Badge>
          <Button variant="ghost" size="sm">Save draft</Button>
        </>}
      />
      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems:'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Property */}
          <Card>
            <SectionHeader eyebrow="Step 1" title="Which listing?"/>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
              <Field label="Listing" required>
                <Input prefix={<Icons.Building size={14}/>} defaultValue="2847 Newport Blvd, Costa Mesa"/>
              </Field>
              <Field label="Deal type"><Input auto value="Lease · Industrial"/></Field>
              <Field label="Suite">
                <Input defaultValue="Entire building"/>
              </Field>
            </div>
          </Card>

          {/* Configuration */}
          <Card>
            <SectionHeader eyebrow="Step 2" title="Configuration" description="How should the sign be mounted?"/>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                {id:'sf', label:'S/F', sub:'Single-face', icon:<SignIcon type="sf"/>},
                {id:'df', label:'D/F', sub:'Double-face', icon:<SignIcon type="df"/>},
                {id:'vshape', label:'V-Shape', sub:'Two panels at angle', icon:<SignIcon type="vshape"/>},
              ].map(opt => {
                const active = shape === opt.id;
                return (
                  <button key={opt.id} onClick={() => setShape(opt.id)} style={{
                    padding: '18px 14px',
                    background: active ? 'var(--lee-crimson-wash)' : 'var(--ink-0)',
                    border: `1.5px solid ${active ? 'var(--lee-crimson)' : 'var(--ink-200)'}`,
                    borderRadius: 10, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    transition: 'all .14s',
                    boxShadow: active ? '0 2px 8px rgba(1,105,111,.14)' : 'none',
                    position: 'relative',
                  }}>
                    <div style={{ color: active ? 'var(--lee-crimson)' : 'var(--ink-500)' }}>{opt.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', color: active ? 'var(--lee-crimson-ink)' : 'var(--ink-900)' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: -4 }}>{opt.sub}</div>
                    {active && <div style={{ position:'absolute', top:8, right:8, width:16, height:16, borderRadius:999, background:'var(--lee-crimson)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}><Icons.Check size={10} strokeWidth={3}/></div>}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Specifications */}
          <Card>
            <SectionHeader eyebrow="Step 3" title="Sign specifications" right={<Badge tone="crimson" size="sm">{Object.values(qty).reduce((a,b)=>a+b,0)} signs total</Badge>}/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {k:'4x8',    label:"4' × 8'",  desc:'Standard roadside panel'},
                {k:'6x8',    label:"6' × 8'",  desc:'Large frontage panel'},
                {k:'other',  label:'Other',     desc:'Custom size', sizeInput: true, sizeValue: otherSize,  setSize: setOtherSize,  placeholder: 'e.g. 3×4'},
                {k:'banner', label:'Banner',    desc:'Vinyl banner', sizeInput: true, sizeValue: bannerSize, setSize: setBannerSize, placeholder: 'Size'},
              ].map(row => {
                const n = qty[row.k];
                const active = n > 0;
                return (
                  <div key={row.k} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    background: active ? 'var(--lee-crimson-wash)' : 'var(--ink-50)',
                    border: `1px solid ${active ? 'rgba(1,105,111,.22)' : 'var(--ink-200)'}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ width: 90 }}>
                      <div className="lee-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>{row.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{row.desc}</div>
                    </div>
                    {row.sizeInput ? (
                      <input
                        value={row.sizeValue}
                        onChange={e => row.setSize(e.target.value)}
                        placeholder={row.placeholder}
                        style={{ flex: 1, height: 36, padding: '0 12px', fontSize: 13, border: '1px solid var(--ink-200)', borderRadius: 6, background: 'var(--ink-0)', outline: 'none' }}
                      />
                    ) : (
                      <div style={{ flex: 1 }}/>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 2, border: '1px solid var(--ink-200)', borderRadius: 8, background: 'var(--ink-0)' }}>
                      <button onClick={() => step(row.k, -1)} style={stepBtn}><Icons.Minus size={14}/></button>
                      <div style={{ width: 40, textAlign: 'center', fontWeight: 700, fontSize: 15, color: active ? 'var(--lee-crimson-ink)' : 'var(--ink-500)' }}>{n}</div>
                      <button onClick={() => step(row.k, 1)} style={stepBtn}><Icons.Plus size={14}/></button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, padding: 12, background: 'var(--ink-50)', borderRadius: 8, border: '1px solid var(--ink-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Toggle on={nameRider} onClick={() => setNameRider(!nameRider)}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Name rider <span style={{ fontWeight: 500, color: 'var(--ink-500)' }}>· Optional</span></div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Add broker name to rider panel</div>
                </div>
                {nameRider && <Input defaultValue="Jane Broker · 714.555.0142" style={{ width: 280 }}/>}
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader eyebrow="Step 4" title="Requested by &amp; access" description="Who's the point of contact; how do installers get on site?"/>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <Field label="Agent" required><Input defaultValue="Jane Broker"/></Field>
              <Field label="Shared Expense %"><Input suffix="%" defaultValue="50"/></Field>
              <Field label="Install by"><Input prefix={<Icons.Calendar size={14}/>} defaultValue="Apr 28, 2026"/></Field>
              <Field label="Access" span={3}>
                <Input defaultValue="Gate code 4421#. Contact property manager at 949-555-0100 if locked."/>
              </Field>
              <Field label="Comments / placement notes" span={3} optional>
                <textarea defaultValue="Install on Newport Blvd frontage, right of the driveway. Avoid blocking tenant signage on the north elevation." style={textareaStyle}/>
              </Field>
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="secondary">Save draft</Button>
            <Button variant="primary" icon={<Icons.Send size={14}/>}>Submit order</Button>
          </div>
        </div>

        <OrderSummaryRail qty={qty} shape={shape}/>
      </div>
    </div>
  );
}

function SignIcon({ type }) {
  // S/F = Single-face post sign — one panel on a post, front view
  if (type === 'sf') return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* panel */}
      <rect x="12" y="10" width="40" height="24" rx="1.5"/>
      {/* divider line (for name rider) */}
      <path d="M12 28h40" strokeOpacity=".45"/>
      {/* post */}
      <path d="M32 34v18"/>
      {/* ground */}
      <path d="M22 52h20"/>
    </svg>
  );
  // D/F = Double-face — panels back-to-back, shown in a slight 3/4 view
  if (type === 'df') return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* front panel */}
      <rect x="10" y="12" width="36" height="22" rx="1.5"/>
      {/* back panel offset */}
      <path d="M46 12l8 4v22l-8 4" />
      <path d="M46 34l8 4"/>
      {/* post */}
      <path d="M28 34v18"/>
      {/* ground */}
      <path d="M18 52h20"/>
    </svg>
  );
  // V-Shape = two panels meeting at a V, shown from top-down-ish perspective
  if (type === 'vshape') return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* left panel */}
      <path d="M32 10 14 18v16l18 8z"/>
      {/* right panel */}
      <path d="M32 10l18 8v16l-18 8z"/>
      {/* center seam */}
      <path d="M32 10v32" strokeOpacity=".55"/>
      {/* post */}
      <path d="M32 42v10"/>
      {/* ground */}
      <path d="M22 52h20"/>
    </svg>
  );
  return null;
}

const stepBtn = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6,
  color: 'var(--ink-700)',
};

const textareaStyle = {
  minHeight: 80, padding: 12, fontSize: 14, lineHeight: 1.5,
  background: 'var(--ink-0)', border: '1px solid var(--ink-200)', borderRadius: 6,
  fontFamily: 'var(--font-sans)', color: 'var(--ink-900)', outline: 'none', resize: 'vertical',
};

function OrderSummaryRail({ qty, shape }) {
  const prices = { '4x8': 285, '6x8': 420, 'other': 175, 'banner': 95 };
  const labels = { '4x8': "4' × 8'", '6x8': "6' × 8'", 'other': 'Other', 'banner': 'Banner' };
  const shapeLabel = { sf: 'S/F', df: 'D/F', vshape: 'V-Shape' }[shape] || shape;
  const total = Object.entries(qty).reduce((sum, [k, n]) => sum + (prices[k] || 0) * n, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>
      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 12 }}>Order summary</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>2847 Newport Blvd</div>
        <div style={{ fontSize: 12, color:'var(--ink-500)', marginTop: 2 }}>PO-2026-0418 · {shapeLabel}</div>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--ink-150)', paddingTop: 12, display:'flex', flexDirection:'column', gap: 6 }}>
          {Object.entries(qty).filter(([,n])=>n>0).map(([k,n]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--ink-600)' }}>{labels[k]}  · × {n}</span>
              <span className="lee-mono" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>
                ${(prices[k]*n).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--ink-200)', display:'flex', justifyContent:'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Estimated total</span>
          <span className="lee-mono" style={{ fontSize: 20, fontWeight: 700 }}>${total.toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4 }}>Split 50% with landlord · your share ${(total/2).toLocaleString()}</div>
      </Card>

      <Card padding={18} style={{ background: 'var(--ink-50)' }}>
        <div className="lee-eyebrow" style={{ marginBottom: 8 }}>Vendor</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Coast Sign &amp; Graphics</div>
        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop:2 }}>Typical install: 3-5 business days</div>
      </Card>
    </div>
  );
}

export {  SignRequestScreen  };
/* Lee Broker Tool — Commission Voucher screen */

function VoucherScreen() {
  return (
    <div>
      <PageHeader
        eyebrow="Broker Desk"
        title="Commission Voucher"
        description="Submit a completed deal for commission processing and Dealius submission."
        right={<>
          <Badge tone="slate" size="md">Draft · Last saved 2 min ago</Badge>
          <Button variant="ghost" size="sm" icon={<Icons.Send size={14}/>}>Send to admin</Button>
        </>}
      >
        <StepProgress step={5} total={8} percent={62}/>
      </PageHeader>

      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Step summary chips */}
          <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
            {['Property','Parties','Financials','Commission','Rent schedule'].map(l => (
              <Badge key={l} tone="success" size="md" icon={<Icons.Check size={11} strokeWidth={3}/>}>{l}</Badge>
            ))}
            <Badge tone="crimson" size="md">Rent schedule · in progress</Badge>
            <Badge size="md">Invoicing</Badge>
            <Badge size="md">Documents</Badge>
          </div>

          {/* Commission distribution */}
          <Card>
            <SectionHeader
              eyebrow="Step 4"
              title="Commission distribution"
              description="Allocate the gross commission across internal and outside agents."
              right={<Button variant="ghost" size="sm" icon={<Icons.Plus size={14}/>}>Add agent</Button>}
            />
            <CommissionTable/>
          </Card>

          {/* Rent schedule */}
          <Card>
            <SectionHeader
              eyebrow="Step 5 · Active"
              title="Monthly rent schedule"
              description="Step-ups, free rent and base rent across the term."
              right={<Segmented size="sm" options={['Monthly','Annual']} value="Monthly" onChange={()=>{}}/>}
            />
            <RentTable/>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="ghost" icon={<Icons.Chevron size={14} style={{transform:'rotate(180deg)'}}/>}>Back</Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary">Save draft</Button>
              <Button variant="primary" iconRight={<Icons.Arrow size={14}/>}>Continue to invoicing</Button>
            </div>
          </div>
        </div>

        <VoucherRail/>
      </div>
    </div>
  );
}

function CommissionTable() {
  const rows = [
    {name:'Jane Broker', side:'Procuring', pct: 40, chipTone:'success', split:'Internal'},
    {name:'Rick Turner', side:'Listing', pct: 35, chipTone:'crimson', split:'Internal'},
    {name:'Janice Lee (CBRE)', side:'Referral', pct: 15, chipTone:'warn', split:'Outside'},
    {name:'House override', side:'Both', pct: 10, chipTone:'ai', split:'House'},
  ];
  const total = rows.reduce((s,r)=>s+r.pct,0);
  const ok = total === 100;
  return (
    <div style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns: '1.4fr 1fr .8fr 1fr 40px', padding: '10px 16px', background: 'var(--ink-50)', fontSize: 11, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        <div>Agent</div><div>Side</div><div>Split</div><div style={{textAlign:'right'}}>% of commission</div><div/>
      </div>
      {rows.map((r,i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns: '1.4fr 1fr .8fr 1fr 40px', padding: '12px 16px', alignItems:'center', borderTop: '1px solid var(--ink-150)', background: 'var(--ink-0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--ink-100)', color:'var(--ink-600)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 11, fontWeight: 700 }}>
              {r.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{r.split}</div>
            </div>
          </div>
          <div><Badge tone={r.chipTone} size="sm">{r.side}</Badge></div>
          <div style={{ fontSize: 12, color: 'var(--ink-600)' }}>{r.split}</div>
          <div style={{ textAlign: 'right' }}>
            <span className="lee-mono" style={{ fontSize: 14, fontWeight: 700 }}>{r.pct}%</span>
            <div className="lee-mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>${(127935 * r.pct/100).toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          </div>
          <button style={{ background:'transparent', border:'none', color:'var(--ink-400)', cursor:'pointer' }}><Icons.MoreV size={14}/></button>
        </div>
      ))}
      <div style={{
        display:'grid', gridTemplateColumns: '1.4fr 1fr .8fr 1fr 40px',
        padding: '14px 16px', background: ok ? 'var(--ok-100)' : 'var(--err-100)',
        borderTop: '2px solid var(--ink-200)', alignItems:'center',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform:'uppercase', color: 'var(--ink-700)' }}>Total</div>
        <div/><div/>
        <div style={{ textAlign:'right' }}>
          <span className="lee-mono" style={{ fontSize: 16, fontWeight: 700, color: ok ? 'var(--ok-600)' : 'var(--err-600)' }}>{total}%</span>
        </div>
        <div style={{ color: ok ? 'var(--ok-500)' : 'var(--err-600)' }}>{ok ? <Icons.Check size={16} strokeWidth={2.4}/> : <Icons.Warn size={16}/>}</div>
      </div>
    </div>
  );
}

function RentTable() {
  const rows = [
    {mo:'Mo 1-2',   months:'Apr 2026 — May 2026', baseRate: 0,    sf: 24500, monthly: 0, note:'Free rent'},
    {mo:'Mo 3-12',  months:'Jun 2026 — Mar 2027', baseRate: 1.45, sf: 24500, monthly: 35525},
    {mo:'Mo 13-24', months:'Apr 2027 — Mar 2028', baseRate: 1.50, sf: 24500, monthly: 36750},
    {mo:'Mo 25-36', months:'Apr 2028 — Mar 2029', baseRate: 1.55, sf: 24500, monthly: 37975},
    {mo:'Mo 37-48', months:'Apr 2029 — Mar 2030', baseRate: 1.60, sf: 24500, monthly: 39200},
    {mo:'Mo 49-60', months:'Apr 2030 — Mar 2031', baseRate: 1.66, sf: 24500, monthly: 40670},
  ];
  const total = rows.reduce((s,r)=>s+r.monthly*parseInt(r.mo.match(/-(\d+)/)?.[1]||1) - (r.monthly * parseInt(r.mo.match(/Mo (\d+)/)?.[1]||1) - r.monthly), 2132250);
  return (
    <div style={{ border: '1px solid var(--ink-200)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns: '1fr 1.6fr 1fr 1fr 1fr', padding: '10px 16px', background: 'var(--ink-50)', fontSize: 11, fontWeight: 600, color: 'var(--ink-500)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <div>Period</div><div>Dates</div><div style={{textAlign:'right'}}>Rate/SF/Mo</div><div style={{textAlign:'right'}}>SF</div><div style={{textAlign:'right'}}>Monthly</div>
      </div>
      {rows.map((r,i) => {
        const free = r.baseRate === 0;
        return (
          <div key={i} style={{
            display:'grid', gridTemplateColumns: '1fr 1.6fr 1fr 1fr 1fr',
            padding: '10px 16px', alignItems:'center',
            borderTop: '1px solid var(--ink-150)',
            background: free ? 'var(--warn-100)' : (i%2===0 ? 'var(--ink-0)' : 'var(--ink-50)'),
            fontSize: 13,
          }}>
            <div style={{ fontWeight: 600 }}>{r.mo}{free && <div style={{ fontSize: 10, color:'var(--warn-600)', fontWeight: 700, letterSpacing: '0.08em' }}>FREE RENT</div>}</div>
            <div style={{ color: 'var(--ink-600)', fontSize: 12 }}>{r.months}</div>
            <div className="lee-mono" style={{ textAlign:'right' }}>${r.baseRate.toFixed(2)}</div>
            <div className="lee-mono" style={{ textAlign:'right', color: 'var(--ink-500)' }}>{r.sf.toLocaleString()}</div>
            <div className="lee-mono" style={{ textAlign:'right', fontWeight: 700 }}>${r.monthly.toLocaleString()}</div>
          </div>
        );
      })}
      <div style={{ display:'grid', gridTemplateColumns: '1fr 1.6fr 1fr 1fr 1fr', padding: '14px 16px', background: 'var(--ink-900)', color: '#fff', borderTop: '2px solid var(--ink-900)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-400)' }}>Total consideration</div>
        <div/><div/><div/>
        <div className="lee-mono" style={{ textAlign:'right', fontSize: 18, fontWeight: 700 }}>$2,132,250</div>
      </div>
    </div>
  );
}

function VoucherRail() {
  return (
    <div style={{ display:'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>
      <Card padding={20}>
        <div className="lee-eyebrow" style={{ marginBottom: 10 }}>Invoice</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Invoice to: Landlord</div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>Pacific Holdings LLC · Ref LD-4491</div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <RowKV k="Gross commission" v="$127,935.00"/>
          <RowKV k="Internal split" v="$95,951.25" sub/>
          <RowKV k="Outside/referral" v="$19,190.25" sub/>
          <RowKV k="House" v="$12,793.50" sub/>
          <div style={{ height: 1, background: 'var(--ink-150)', margin: '4px 0' }}/>
          <RowKV k="Total invoice" v="$127,935.00" big/>
        </div>

        <div style={{ marginTop: 16, display:'flex', flexDirection:'column', gap: 8 }}>
          <Button variant="primary" size="sm" style={{ width: '100%' }} icon={<Icons.Send size={14}/>}>Submit to Dealius</Button>
          <Button variant="secondary" size="sm" style={{ width: '100%' }} icon={<Icons.Download size={14}/>}>Download voucher PDF</Button>
        </div>
      </Card>

      <Card padding={18} style={{ background: 'var(--ink-900)', color: '#fff', border: '1px solid var(--ink-900)' }}>
        <div className="lee-eyebrow" style={{ color: 'var(--ink-400)', marginBottom: 6 }}>Post-submission</div>
        <div style={{ fontSize: 13, color: 'var(--ink-200)', marginBottom: 12, lineHeight: 1.5 }}>
          After Dealius receives this voucher, we'll queue:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TodoRow icon={<Icons.Sign size={14}/>} label="Remove signs from property"/>
          <TodoRow icon={<Icons.Listing size={14}/>} label="Notify MLS of closed status"/>
          <TodoRow icon={<Icons.Docs size={14}/>} label="Archive closed deal to Dropbox"/>
        </div>
      </Card>
    </div>
  );
}

function RowKV({ k, v, sub, big }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: sub ? 11 : 12, color: sub ? 'var(--ink-500)' : 'var(--ink-600)' }}>{sub && '  ↳ '}{k}</span>
      <span className="lee-mono" style={{ fontSize: big ? 18 : 13, fontWeight: big ? 700 : (sub ? 500 : 600), color: big ? 'var(--ink-900)' : 'var(--ink-700)' }}>{v}</span>
    </div>
  );
}
function TodoRow({ icon, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,.04)', borderRadius: 6, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-300)' }}>{icon}</span>
      <span style={{ color: '#fff', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--ink-400)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Queued</span>
    </div>
  );
}

export {  VoucherScreen  };
// ── AI assist panel (slide-over) ──
function AiPanel({ open, onClose }) {
  return (
    <>
      {open && <div onClick={onClose} style={{ position:'absolute', inset: 0, background:'rgba(10,10,11,.4)', zIndex: 20 }}/>}
      <aside style={{
        position:'absolute', top: 0, right: 0, height: '100%', width: 440,
        background: 'var(--ink-0)', borderLeft: '1px solid var(--ink-200)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform .3s var(--ease-out)',
        zIndex: 21, display:'flex', flexDirection:'column',
        boxShadow: open ? 'var(--shadow-xl)' : 'none',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--ink-150)', display:'flex', alignItems:'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ai-gradient)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
            <Icons.Sparkles size={16}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Deal Assist</div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Deal Assist · extracts fields from brochures and drafts</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ink-500)' }}><Icons.X size={18}/></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24, display:'flex', flexDirection:'column', gap: 16 }}>
          {/* Natural language input */}
          <div>
            <div className="lee-eyebrow" style={{ marginBottom: 8 }}>Describe the deal</div>
            <div style={{ border: '1px solid var(--ai-400)', borderRadius: 10, padding: 14, background: '#FBF8FE', boxShadow: 'var(--ring-ai)' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.5 }}>
                5 year industrial lease on 24,500 SF at 2847 Newport Blvd. Tenant is <b>Relay Robotics</b>. Start June 1, 2026, $1.45/SF NNN, 3% annual steps, 2 months free rent, 6% total commission split 50/50 between me and Marcus.
              </div>
              <div style={{ marginTop: 14, display:'flex', gap: 8, justifyContent:'flex-end' }}>
                <Button variant="ghost" size="sm">Clear</Button>
                <Button variant="ai" size="sm" icon={<Icons.Wand size={13}/>}>Populate form</Button>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--ink-200)' }}/>
            <span style={{ fontSize: 10, color: 'var(--ink-400)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--ink-200)' }}/>
          </div>

          <Button variant="secondary" style={{ width: '100%', justifyContent:'flex-start' }} icon={<Icons.Upload size={14}/>}>
            Upload brochure, LOI or contract
          </Button>
          <Button variant="secondary" style={{ width: '100%', justifyContent:'flex-start' }} icon={<Icons.Sparkles size={14}/>}>
            Smart-complete empty fields
          </Button>

          {/* Suggested actions */}
          <div>
            <div className="lee-eyebrow" style={{ marginBottom: 8 }}>Suggestions</div>
            <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
              {[
                'Pull comparable industrial leases within 3mi',
                'Draft the MLS description from property details',
                'Check commission math',
              ].map((s,i) => (
                <button key={i} style={{
                  display:'flex', alignItems:'center', gap: 10,
                  padding: '10px 12px', textAlign:'left',
                  background: 'var(--ink-50)', border: '1px solid var(--ink-200)',
                  borderRadius: 8, cursor:'pointer', fontSize: 13, color: 'var(--ink-700)',
                }}>
                  <Icons.Sparkles size={12} style={{ color: 'var(--ai-500)' }}/>
                  <span style={{ flex: 1 }}>{s}</span>
                  <Icons.Arrow size={12} style={{ color: 'var(--ink-400)' }}/>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── My Profile modal — single user only; brokers cannot view each other ──
function ProfileModal({ open, onClose }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'absolute', inset: 0, background:'rgba(10,10,11,.4)', zIndex: 30 }}/>
      <div style={{
        position:'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 520, maxHeight: '85vh', background:'var(--ink-0)',
        borderRadius: 14, boxShadow: 'var(--shadow-xl)', zIndex: 31,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header banner with avatar */}
        <div style={{ position: 'relative', height: 100, background: 'linear-gradient(120deg, var(--ink-900) 0%, var(--lee-crimson-ink) 100%)' }}>
          <button onClick={onClose} style={{ position:'absolute', top: 14, right: 14, background:'rgba(255,255,255,.12)', border:'none', cursor:'pointer', color:'#fff', width: 28, height: 28, borderRadius: 6, display:'flex', alignItems:'center', justifyContent:'center' }}><Icons.X size={16}/></button>
          <div style={{ position: 'absolute', top: 16, left: 24, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>My Profile</div>
        </div>

        <div style={{ padding: '0 24px', marginTop: -40, display: 'flex', alignItems:'flex-end', gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, background: 'var(--lee-crimson)', color: '#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 26, fontWeight: 800, border: '4px solid var(--ink-0)', boxShadow: 'var(--shadow-md)' }}>JB</div>
          <div style={{ flex: 1, paddingBottom: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Jane Broker</div>
            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>Senior Broker · Industrial · DRE #01234567</div>
          </div>
          <Badge tone="success" size="sm" icon={<Icons.Check size={10} strokeWidth={3}/>}>Signed in</Badge>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px', display:'flex', flexDirection:'column', gap: 16 }}>
          <div>
            <div className="lee-eyebrow" style={{ marginBottom: 10 }}>Account</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
              <Field label="First name" required><Input defaultValue="Jane"/></Field>
              <Field label="Last name" required><Input defaultValue="Broker"/></Field>
              <Field label="Email" required span={2}><Input prefix="@" defaultValue="jbroker@lee-associates.com" auto/></Field>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 6, display:'flex', alignItems:'center', gap: 4 }}>
              <Icons.Info size={11}/> Email is tied to your sign-in and can't be changed here. Contact Admin to update.
            </div>
          </div>

          <div>
            <div className="lee-eyebrow" style={{ marginBottom: 10 }}>Broker details <span style={{ color: 'var(--ink-400)', fontWeight: 500, textTransform:'none', letterSpacing: 0 }}>— used to pre-fill forms</span></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
              <Field label="Title"><Input defaultValue="Senior Broker"/></Field>
              <Field label="DRE license #" required><Input defaultValue="02135478"/></Field>
              <Field label="Direct phone"><Input defaultValue="714.555.0142"/></Field>
              <Field label="Fax"><Input defaultValue="714.555.0143"/></Field>
            </div>
          </div>

          <div style={{ padding: 14, background: 'var(--ink-50)', border: '1px solid var(--ink-200)', borderRadius: 10, display:'flex', alignItems:'center', gap: 12 }}>
            <Icons.Lock size={18} style={{ color: 'var(--ink-500)' }}/>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-600)' }}>
              Your profile is private. Other brokers can't see it — only Admin can view it for deal processing.
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems: 'center', paddingTop: 8 }}>
            <Button variant="ghost" size="sm">Sign out</Button>
            <div style={{ display:'flex', gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="primary" size="sm">Save changes</Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export { AiPanel, ProfileModal, Metric, SummaryRow };





