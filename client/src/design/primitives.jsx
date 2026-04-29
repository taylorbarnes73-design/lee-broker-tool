/* Lee Broker Tool — Primitives: Button, Input, Select, Badge, Card, Chip */

// ── Button ──
function Button({ variant = 'primary', size = 'md', icon, iconRight, children, style, disabled, ...rest }) {
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
    danger: { bg: 'var(--err-600)', color: '#fff', border: 'var(--err-600)', hover: '#9A1A10' },
  };
  const v = variants[variant] || variants.primary;
  const [hover, setHover] = React.useState(false);
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: s.gap,
        height: s.h, padding: `0 ${s.px}px`,
        fontSize: s.fs, fontWeight: 600, letterSpacing: '-0.005em',
        background: v.gradient && !disabled ? 'var(--ai-gradient)' : (hover && !disabled ? v.hover : v.bg),
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: 'var(--r-6)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background .12s var(--ease-out), box-shadow .12s, transform .06s',
        boxShadow: variant === 'primary' && !disabled ? '0 1px 0 rgba(0,0,0,.04), inset 0 1px 0 rgba(255,255,255,.08)' : 'none',
        ...style,
      }}
      {...rest}
    >
      {icon}
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
            {required && <span style={{ color: 'var(--lee-crimson)' }}>*</span>}
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
    crimson:  { bg: 'var(--lee-crimson-wash)', color: 'var(--lee-crimson-ink)', border: 'rgba(155,13,42,.2)' },
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
  return (
    <div
      onMouseEnter={() => hoverable && setHover(true)}
      onMouseLeave={() => hoverable && setHover(false)}
      style={{
        background: 'var(--ink-0)',
        border: '1px solid var(--ink-200)',
        borderRadius: 'var(--r-12)',
        padding,
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

Object.assign(window, { Button, Field, Input, Select, Toggle, Badge, Card, StepCard, SectionHeader });
