"use client";

import { useMemo, useState } from "react";
import { formatINR, NumberField, parseNumber, principalForEmi, ResultMetric, ResultPanel, ToolCard } from "./shared";
import styles from "./tool-ui.module.css";

export function AffordabilityCalculator() {
  const [income, setIncome] = useState("150000");
  const [existingEmis, setExistingEmis] = useState("20000");
  const [downPayment, setDownPayment] = useState("1500000");
  const [rate, setRate] = useState("8.5");
  const [years, setYears] = useState("20");

  const result = useMemo(() => {
    const monthlyIncome = parseNumber(income, 1, 1_000_000_000);
    const currentEmis = parseNumber(existingEmis, 0, 1_000_000_000);
    const ownFunds = parseNumber(downPayment, 0, 1_000_000_000_000);
    const annualRate = parseNumber(rate, 0, 30);
    const term = parseNumber(years, 1, 50);
    if (monthlyIncome === undefined || currentEmis === undefined || ownFunds === undefined || annualRate === undefined || term === undefined) return undefined;
    const affordableEmi = Math.max(0, monthlyIncome * 0.5 - currentEmis);
    const loan = principalForEmi(affordableEmi, annualRate, Math.round(term * 12));
    return { affordableEmi, loan, budget: loan + ownFunds };
  }, [income, existingEmis, downPayment, rate, years]);

  const shareText = result
    ? `Property affordability estimate\nMonthly income: ${formatINR(Number(income))}\nExisting EMIs: ${formatINR(Number(existingEmis))}\nDown payment: ${formatINR(Number(downPayment))}\nEstimated affordable EMI: ${formatINR(result.affordableEmi)}\nEstimated loan: ${formatINR(result.loan)}\nIndicative property budget: ${formatINR(result.budget)}\nAssumption: total EMIs capped at 50% of monthly income.`
    : "";

  return (
    <ToolCard title="Affordability" description="Translate income and available down payment into a rough property budget.">
      <div className={styles.formGrid}>
        <NumberField label="Monthly income" prefix="₹" value={income} onChange={setIncome} min={1} max={1_000_000_000} step={1000} />
        <NumberField label="Existing monthly EMIs" prefix="₹" value={existingEmis} onChange={setExistingEmis} min={0} max={1_000_000_000} step={1000} />
        <NumberField label="Available down payment" prefix="₹" value={downPayment} onChange={setDownPayment} min={0} max={1_000_000_000_000} step={10000} />
        <NumberField label="Annual interest rate (%)" value={rate} onChange={setRate} min={0} max={30} step={0.05} />
        <NumberField label="Tenure (years)" value={years} onChange={setYears} min={1} max={50} step={1} />
      </div>
      {result && (
        <ResultPanel title="Indicative property budget" shareText={shareText}>
          <div className={styles.resultGrid}>
            <ResultMetric label="Estimated total budget" value={formatINR(result.budget)} />
            <ResultMetric label="Estimated loan amount" value={formatINR(result.loan)} />
            <ResultMetric label="Estimated EMI capacity" value={formatINR(result.affordableEmi)} />
            <ResultMetric label="Down payment" value={formatINR(Number(downPayment))} />
          </div>
        </ResultPanel>
      )}
      <p className={styles.disclaimer}>Based on an illustrative 50% EMI-to-income ceiling. Does not include stamp duty, registration, lender charges or other purchase costs.</p>
    </ToolCard>
  );
}
