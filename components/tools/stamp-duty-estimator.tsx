"use client";

import { useMemo, useState } from "react";
import { INDIA_STAMP_DUTY_RATES } from "./india-stamp-duty-rates";
import { formatINR, NumberField, parseNumber, ResultMetric, ResultPanel, SelectField, ToolCard } from "./shared";
import styles from "./tool-ui.module.css";

export function StampDutyEstimator() {
  const [price, setPrice] = useState("7500000");
  const [state, setState] = useState("Karnataka");

  const result = useMemo(() => {
    const propertyPrice = parseNumber(price, 1, 1_000_000_000_000);
    const rates = INDIA_STAMP_DUTY_RATES.find((item) => item.state === state);
    if (propertyPrice === undefined || !rates) return undefined;
    const stampDuty = propertyPrice * rates.stampDutyPercent / 100;
    const registration = propertyPrice * rates.registrationPercent / 100;
    return { rates, stampDuty, registration, total: stampDuty + registration, totalCost: propertyPrice + stampDuty + registration };
  }, [price, state]);

  const shareText = result
    ? `Stamp duty and registration estimate\nProperty value: ${formatINR(Number(price))}\nState/UT: ${result.rates.state}\nIndicative stamp duty: ${result.rates.stampDutyPercent}% = ${formatINR(result.stampDuty)}\nIndicative registration: ${result.rates.registrationPercent}% = ${formatINR(result.registration)}\nEstimated charges: ${formatINR(result.total)}\nProperty value plus estimated charges: ${formatINR(result.totalCost)}`
    : "";

  return (
    <ToolCard title="Stamp duty & registration" description="Estimate purchase charges using the editable state/UT rate table configured for this tool.">
      <div className={styles.formGrid}>
        <NumberField label="Property value" prefix="₹" value={price} onChange={setPrice} min={1} max={1_000_000_000_000} step={10000} />
        <SelectField
          label="State or union territory"
          value={state}
          onChange={setState}
          options={INDIA_STAMP_DUTY_RATES.map((item) => ({ value: item.state, label: item.state }))}
        />
      </div>
      {result && (
        <ResultPanel title="Indicative transaction charges" shareText={shareText}>
          <div className={styles.resultGrid}>
            <ResultMetric label={`Stamp duty (${result.rates.stampDutyPercent}%)`} value={formatINR(result.stampDuty)} />
            <ResultMetric label={`Registration (${result.rates.registrationPercent}%)`} value={formatINR(result.registration)} />
            <ResultMetric label="Estimated charges" value={formatINR(result.total)} />
            <ResultMetric label="Value plus estimated charges" value={formatINR(result.totalCost)} />
          </div>
        </ResultPanel>
      )}
      <p className={styles.disclaimer}>
        Indicative editable defaults only—not official rates or legal advice. Actual amounts may vary by city, market value, property type, buyer eligibility, surcharges, caps and current state rules. Verify with the relevant registration authority before relying on this estimate.
      </p>
    </ToolCard>
  );
}
