"use client";

import { useMemo, useState } from "react";
import { calculateEmi, formatINR, NumberField, parseNumber, ResultMetric, ResultPanel, ToolCard } from "./shared";
import styles from "./tool-ui.module.css";

function amortize(balance: number, annualRate: number, monthlyPayment: number, maxMonths: number) {
  let interestTotal = 0;
  let months = 0;
  const rate = annualRate / 1200;
  while (balance > 0.01 && months < maxMonths) {
    const interest = balance * rate;
    const payment = Math.min(monthlyPayment, balance + interest);
    if (payment <= interest) return { interestTotal, months, cleared: false };
    balance = Math.max(0, balance - (payment - interest));
    interestTotal += interest;
    months += 1;
  }
  return { interestTotal, months, cleared: balance <= 0.01 };
}

export function PrepaymentCalculator() {
  const [balance, setBalance] = useState("4000000");
  const [rate, setRate] = useState("8.5");
  const [years, setYears] = useState("18");
  const [extra, setExtra] = useState("10000");

  const result = useMemo(() => {
    const outstanding = parseNumber(balance, 1, 1_000_000_000_000);
    const annualRate = parseNumber(rate, 0, 30);
    const term = parseNumber(years, 1, 50);
    const extraPayment = parseNumber(extra, 1, 1_000_000_000);
    if (outstanding === undefined || annualRate === undefined || term === undefined || extraPayment === undefined) return undefined;
    const months = Math.round(term * 12);
    const regularEmi = calculateEmi(outstanding, annualRate, months);
    const regular = amortize(outstanding, annualRate, regularEmi, months + 1);
    const accelerated = amortize(outstanding, annualRate, regularEmi + extraPayment, months + 1);
    return {
      regularEmi,
      interestSaved: Math.max(0, regular.interestTotal - accelerated.interestTotal),
      monthsSaved: Math.max(0, regular.months - accelerated.months),
      newMonths: accelerated.months,
      oldInterest: regular.interestTotal,
      newInterest: accelerated.interestTotal,
    };
  }, [balance, rate, years, extra]);

  const shareText = result
    ? `Monthly prepayment estimate\nOutstanding balance: ${formatINR(Number(balance))}\nRate: ${rate}% p.a. · Remaining tenure: ${years} years\nExtra monthly payment: ${formatINR(Number(extra))}\nEstimated interest saved: ${formatINR(result.interestSaved)}\nEstimated tenure reduction: ${result.monthsSaved} months\nNew payoff time: ${result.newMonths} months`
    : "";

  return (
    <ToolCard title="Prepayment impact" description="Estimate interest savings and payoff-time reduction from an additional monthly payment.">
      <div className={styles.formGrid}>
        <NumberField label="Outstanding loan balance" prefix="₹" value={balance} onChange={setBalance} min={1} max={1_000_000_000_000} step={1000} />
        <NumberField label="Annual interest rate (%)" value={rate} onChange={setRate} min={0} max={30} step={0.05} />
        <NumberField label="Remaining tenure (years)" value={years} onChange={setYears} min={1} max={50} step={1} />
        <NumberField label="Extra payment each month" prefix="₹" value={extra} onChange={setExtra} min={1} max={1_000_000_000} step={1000} />
      </div>
      {result && (
        <ResultPanel title="Estimated prepayment impact" shareText={shareText}>
          <div className={styles.resultGrid}>
            <ResultMetric label="Interest saved" value={formatINR(result.interestSaved)} />
            <ResultMetric label="Tenure reduced" value={`${result.monthsSaved} months`} />
            <ResultMetric label="New payoff time" value={`${Math.floor(result.newMonths / 12)} yr ${result.newMonths % 12} mo`} />
            <ResultMetric label="Regular EMI" value={formatINR(result.regularEmi)} />
          </div>
          <p className={styles.disclaimer}>Interest estimate: {formatINR(result.oldInterest)} without extra payments vs {formatINR(result.newInterest)} with them.</p>
        </ResultPanel>
      )}
      <p className={styles.disclaimer}>Assumes the extra amount is paid monthly and reduces principal immediately. Lender prepayment terms, fees and changing rates are not included.</p>
    </ToolCard>
  );
}
