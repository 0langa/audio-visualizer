import { useState, type ReactNode } from "react";
import { Slider } from "./Slider";
import { Switch } from "./Switch";
import type { ParamSpec } from "../render/types";

/**
 * The shared control kit. Every settings surface builds rows from these —
 * one toggle idiom, one slider row, one segmented control — instead of the
 * three hand-rolled variants that had accumulated (ParamsPanel's private
 * rows, LayersPanel's private slider, `.segmented` markup duplicated five
 * times across ParamsPanel/ExportDialog).
 *
 * All components are plain function components taking value + onChange —
 * safe inside memoized panels as long as callers keep handlers stable
 * (the H13 discipline).
 */

/** Pointer + keyboard hint wiring for a row (H17: focus mirrors hover). */
function hintProps(hint: string | undefined, onHint?: (h: string | null) => void) {
  return {
    title: hint,
    onPointerEnter: () => onHint?.(hint ?? null),
    onPointerLeave: () => onHint?.(null),
    onFocus: () => onHint?.(hint ?? null),
    onBlur: () => onHint?.(null),
  };
}

/** Labelled switch row. */
export function ToggleRow(props: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  onHint?: (hint: string | null) => void;
}) {
  return (
    <label className="row toggle-row" {...hintProps(props.hint, props.onHint)}>
      <span className="row-label">{props.label}</span>
      <Switch checked={props.checked} onChange={props.onChange} label={props.label} />
    </label>
  );
}

/** Labelled slider row with a numeric readout. */
export function SliderRow(props: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  onHint?: (hint: string | null) => void;
}) {
  const fmt = props.format ?? ((v: number) => v.toFixed(props.step < 1 ? 2 : 0));
  return (
    <label className="row param-row" {...hintProps(props.hint, props.onHint)}>
      <span className="row-label">{props.label}</span>
      <Slider
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={props.onChange}
      />
      <span className="row-value">{fmt(props.value)}</span>
    </label>
  );
}

/** A ParamSpec-driven row: 0/1 step-1 specs render as a switch, everything
 * else as a slider — the auto-UI behind every preset parameter. */
export function ParamRow(props: {
  spec: ParamSpec;
  value: number;
  onChange: (v: number) => void;
  onHint: (hint: string | null) => void;
}) {
  const { spec: p, value } = props;
  const isToggle = p.step === 1 && p.min === 0 && p.max === 1;
  return isToggle ? (
    <label className="row toggle-row" {...hintProps(p.hint, props.onHint)}>
      <span className="row-label">{p.label}</span>
      <button
        className={`switch ${value > 0.5 ? "on" : ""}`}
        role="switch"
        aria-checked={value > 0.5}
        onClick={() => props.onChange(value > 0.5 ? 0 : 1)}
      >
        <span className="knob" />
      </button>
    </label>
  ) : (
    <label className="row param-row" {...hintProps(p.hint, props.onHint)}>
      <span className="row-label">{p.label}</span>
      <Slider min={p.min} max={p.max} step={p.step} value={value} onChange={props.onChange} />
      <span className="row-value">{value.toFixed(p.step < 1 ? 2 : 0)}</span>
    </label>
  );
}

/** Labelled native select row. */
export function SelectRow<T extends string | number>(props: {
  label: string;
  hint?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
  parse?: (raw: string) => T;
}) {
  const parse = props.parse ?? ((raw: string) => raw as T);
  return (
    <label className="field" title={props.hint}>
      <span>{props.label}</span>
      <select
        className="select"
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(parse(e.target.value))}
      >
        {props.options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Tooltip AND footer-hint text (via the onHint prop). */
  hint?: string;
  disabled?: boolean;
}

/** Segmented control — one active choice out of a small row of buttons. */
export function Segmented<T extends string | number>(props: {
  options: Array<SegmentOption<T>>;
  value: T;
  onChange: (v: T) => void;
  /** Disables every segment (e.g. while an export runs). */
  disabled?: boolean;
  ariaLabel?: string;
  /** Footer-hint sink (panels route this to their hint bar). */
  onHint?: (hint: string | null) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={props.ariaLabel}>
      {props.options.map((o) => (
        <button
          key={String(o.value)}
          className={`segment ${props.value === o.value ? "active" : ""}`}
          disabled={props.disabled || o.disabled}
          aria-pressed={props.value === o.value}
          {...hintProps(o.hint, props.onHint)}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Collapsible section shell: a header button toggling its body, with
 * aria-expanded. Uncontrolled by default (open unless told otherwise);
 * pass `open`/`onToggle` to control it (the v2.41 tabbed panel persists
 * per-section state through exactly that pair).
 */
export function CollapsibleSection(props: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /** Extra header content (e.g. a Reset button), right-aligned. */
  headerExtra?: ReactNode;
}) {
  const [localOpen, setLocalOpen] = useState(props.defaultOpen ?? true);
  const open = props.open ?? localOpen;
  const toggle = () => {
    props.onToggle?.(!open);
    if (props.open === undefined) setLocalOpen(!open);
  };
  return (
    <div className="panel-section">
      <div className="section-head">
        <button
          className="section-toggle"
          aria-expanded={open}
          onClick={toggle}
          title={open ? "Collapse" : "Expand"}
        >
          <span className={`section-chevron ${open ? "open" : ""}`}>▸</span>
          {props.title}
        </button>
        {props.headerExtra}
      </div>
      {open && props.children}
    </div>
  );
}
