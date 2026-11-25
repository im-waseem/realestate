"use client";

import { useId } from "react";
import { useToast } from "@/components/dashboard/toaster";
import styles from "./tool-ui.module.css";

export { calculateEmi, principalForEmi } from "@/lib/property-finance";

export function ToolCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <p className="kicker">PROPERTY FINANCE TOOL</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = "any",
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number | string;
  prefix?: string;
}) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <span className={styles.inputWrap}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function ResultActions({ text }: { text: string }) {
  const toast = useToast();
  async function copyResult() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable in this browser.");
      await navigator.clipboard.writeText(text);
      toast("Result copied to clipboard.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to copy this result.", "error");
    }
  }

  return (
    <div className={styles.resultActions}>
      <button type="button" onClick={() => void copyResult()}>Copy result</button>
      <button type="button" onClick={() => window.print()}>Print</button>
    </div>
  );
}

export function ResultPanel({ title, children, shareText }: {
  title: string;
  children: React.ReactNode;
  shareText: string;
}) {
  return (
    <section className={styles.resultPanel} aria-live="polite">
      <div className={styles.resultHeader}><h3>{title}</h3><ResultActions text={shareText} /></div>
      {children}
    </section>
  );
}

export function ResultMetric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

export function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(value);
}

export function parseNumber(value: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

