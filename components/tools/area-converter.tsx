"use client";

import { useMemo, useState } from "react";
import { AREA_UNITS, convertArea } from "@/lib/property-finance";
import { formatNumber, NumberField, parseNumber, ResultActions, ToolCard, SelectField } from "./shared";
import styles from "./tool-ui.module.css";

export function AreaConverter() {
  const [amount, setAmount] = useState("1000");
  const [from, setFrom] = useState("sqft");
  const [to, setTo] = useState("sqm");

  const result = useMemo(() => {
    const sourceAmount = parseNumber(amount, 0, 1_000_000_000_000);
    const sourceUnit = AREA_UNITS.find((unit) => unit.value === from);
    const targetUnit = AREA_UNITS.find((unit) => unit.value === to);
    if (sourceAmount === undefined || !sourceUnit || !targetUnit) return undefined;
    return convertArea(sourceAmount, sourceUnit.value, targetUnit.value);
  }, [amount, from, to]);

  const sourceLabel = AREA_UNITS.find((unit) => unit.value === from)?.label || from;
  const targetLabel = AREA_UNITS.find((unit) => unit.value === to)?.label || to;
  const shareText = result === undefined ? "" : `Area conversion\n${formatNumber(Number(amount))} ${sourceLabel} = ${formatNumber(result, 4)} ${targetLabel}`;

  return (
    <ToolCard title="Area unit converter" description="Convert common property area units used across Indian listings.">
      <div className={styles.formGrid}>
        <NumberField label="Area" value={amount} onChange={setAmount} min={0} max={1_000_000_000_000} step="any" />
        <SelectField label="From" value={from} onChange={setFrom} options={AREA_UNITS.map((unit) => ({ value: unit.value, label: unit.label }))} />
        <SelectField label="To" value={to} onChange={setTo} options={AREA_UNITS.map((unit) => ({ value: unit.value, label: unit.label }))} />
      </div>
      {result !== undefined && (
        <section className={styles.resultPanel} aria-live="polite">
          <div className={styles.resultHeader}>
            <h3>{formatNumber(Number(amount))} {sourceLabel} = {formatNumber(result, 4)} {targetLabel}</h3>
            <ResultActions text={shareText} />
          </div>
        </section>
      )}
      <p className={styles.disclaimer}>Conversions use standard area definitions: 1 acre = 40 guntas = 100 cents; local property records may use rounded values.</p>
    </ToolCard>
  );
}
