"use client";

import { useMemo, useState } from "react";
import { formatINR, NumberField, parseNumber, principalForEmi, ResultMetric, ResultPanel, ToolCard } from "./shared";
import styles from "./tool-ui.module.css";

export function LoanEligibilityCalculator() {
  const [income, setIncome] = useState("150000");
  const [existingEmis, setExistingEmis] = useState("20000");
  const [rate, setRate] = useState("8.5");
  const [years, setYears] = useState("20");

  const result = useMemo(() => {
    const monthlyIncome = parseNumber(income, 1, 1_000_000_000);
    const currentEmis = parseNumber(existingEmis, 0, 1_000_000_000);
    const annualRate = parseNumber(rate, 0, 30);
    const term = parseNumber(years, 1, 50);
    if (monthlyIncome === undefined || currentEmis === undefined || annualRate === undefined || term === undefined) return undefined;
    const maximumTotalEmi = monthlyIncome * 0.5;
    const availableEmi = Math.max(0, maximumTotalEmi - currentEmis);
    const eligibleLoan = principalForEmi(availableEmi, annualRate, Math.round(term * 12));
    return { maximumTotalEmi, availableEmi, eligibleLoan };
  }, [income, existingEmis, rate, years]);

  const shareText = result
    ? `Home loan eligibility estimate\nMonthly income: ${formatINR(Number(income))}\nExisting EMIs: ${formatINR(Number(existingEmis))}\nRate: ${rate}% p.a. · Tenure: ${years} years\nEstimated eligible EMI: ${formatINR(result.availableEmi)}\nEstimated loan amount: ${formatINR(result.eligibleLoan)}\nAssumption: total EMIs capped at 50% of monthly income.`
    : "";

  return (
    <ToolCard title="Loan eligibility" description="Get a rough borrowing estimate from monthly income, existing repayments, rate and tenure.">
      <div className={styles.formGrid}>
        <NumberField label="Monthly income" prefix="₹" value={income} onChange={setIncome} min={1} max={1_000_000_000} step={1000} />
        <NumberField label="Existing monthly EMIs" prefix="₹" value={existingEmis} onChange={setExistingEmis} min={0} max={1_000_000_000} step={1000} />
        <NumberField label="Annual interest rate (%)" value={rate} onChange={setRate} min={0} max={30} step={0.05} />
        <NumberField label="Tenure (years)" value={years} onChange={setYears} min={1} max={50} step={1} />
      </div>
      {result && (
        <ResultPanel title="Indicative eligibility" shareText={shareText}>
          <div className={styles.resultGrid}>
            <ResultMetric label="Estimated eligible loan" value={formatINR(result.eligibleLoan)} />
            <ResultMetric label="EMI capacity after existing loans" value={formatINR(result.availableEmi)} />
            <ResultMetric label="50% income EMI ceiling" value={formatINR(result.maximumTotalEmi)} />
          </div>
          {result.availableEmi === 0 && <p className={styles.disclaimer}>Existing EMIs meet or exceed the assumed repayment ceiling; this estimate shows no additional EMI capacity.</p>}
        </ResultPanel>
      )}
      <p className={styles.disclaimer}>Uses an illustrative 50% fixed-obligation-to-income ceiling. Banks apply their own eligibility rules, income proof, credit checks and property criteria.</p>
    </ToolCard>
  );
}
