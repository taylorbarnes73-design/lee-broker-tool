import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "../design/index.jsx";

export type AddressSuggestion = {
  address: string;
  city: string;
  state: string;
  zip: string;
};

type AddressAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
};

const DEBOUNCE_MS = 280;
const MIN_QUERY_LEN = 3;

export default function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder,
}: AddressAutocompleteInputProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const fetchSeq = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressFetchRef = useRef(false);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSuggestions([]);
    setActiveIdx(-1);
  }, []);

  const fetchSuggestions = useCallback(
    (query: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (query.length < MIN_QUERY_LEN) {
        fetchSeq.current += 1;
        setLoading(false);
        closeDropdown();
        return;
      }

      setLoading(true);
      const seq = ++fetchSeq.current;
      timerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/places/autocomplete?input=${encodeURIComponent(query)}`
          );
          if (seq !== fetchSeq.current) return;
          const data = (await res.json()) as { results?: AddressSuggestion[] };
          const results = data.results ?? [];
          setSuggestions(results);
          setActiveIdx(-1);
          setOpen(results.length > 0);
        } catch {
          if (seq === fetchSeq.current) closeDropdown();
        } finally {
          if (seq === fetchSeq.current) setLoading(false);
        }
      }, DEBOUNCE_MS);
    },
    [closeDropdown]
  );

  const selectSuggestion = useCallback(
    (idx: number) => {
      const suggestion = suggestions[idx];
      if (!suggestion) return;
      suppressFetchRef.current = true;
      onChange(suggestion.address);
      onSelect?.(suggestion);
      fetchSeq.current += 1;
      setLoading(false);
      closeDropdown();
      queueMicrotask(() => {
        suppressFetchRef.current = false;
      });
    },
    [closeDropdown, onChange, onSelect, suggestions]
  );

  const handleChange = (next: string) => {
    onChange(next);
    if (suppressFetchRef.current) return;
    fetchSuggestions(next.trim());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIdx(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIdx(prev => Math.max(prev - 1, 0));
    } else if (event.key === "Enter" && activeIdx >= 0) {
      event.preventDefault();
      selectSuggestion(activeIdx);
    } else if (event.key === "Escape") {
      closeDropdown();
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <Input
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          fetchSeq.current += 1;
          if (timerRef.current) clearTimeout(timerRef.current);
          setLoading(false);
          setTimeout(closeDropdown, 150);
        }}
        placeholder={placeholder ?? "Start typing an address…"}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined
        }
        suffix={loading ? "…" : undefined}
      />
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "var(--ink-0)",
            border: "1px solid var(--ink-200)",
            borderRadius: "var(--r-6)",
            boxShadow: "var(--shadow-md)",
            overflow: "hidden",
          }}
        >
          {suggestions.map((s, idx) => {
            const active = idx === activeIdx;
            return (
              <div
                key={`${s.address}-${s.city}-${idx}`}
                id={`${listboxId}-opt-${idx}`}
                role="option"
                aria-selected={active ? "true" : "false"}
                onMouseDown={e => {
                  e.preventDefault();
                  selectSuggestion(idx);
                }}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom:
                    idx < suggestions.length - 1 ? "1px solid var(--ink-150)" : undefined,
                  background: active ? "var(--lee-crimson-wash)" : "var(--ink-0)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>
                  {s.address}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                  {[s.city, s.state, s.zip].filter(Boolean).join(", ")}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
