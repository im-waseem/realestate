"use client";

import { useMemo, useState } from "react";
import { calculateEmi, formatINR, NumberField, parseNumber, ResultMetric, ResultPanel, ToolCard } from "./shared";
import styles from "./tool-ui.module.css";

export function EmiCalculator() {
  const [amount, setAmount] = useState("5000000");
  const [rate, setRate] = useState("8.5");
  const [years, setYears] = useState("20");

  const result = useMemo(() => {
    const principal = parseNumber(amount, 1, 1_000_000_000_000);
    const annualRate = parseNumber(rate, 0, 30);
    const termYears = parseNumber(years, 1, 50);
    if (principal === undefined || annualRate === undefined || termYears === undefined) return undefined;
    const months = Math.round(termYears * 12);
    const emi = calculateEmi(principal, annualRate, months);
    let balance = principal;
    const rows: { month: number; payment: number; principal: number; interest: number; balance: number }[] = [];
    for (let month = 1; month <= months && balance > 0.01; month += 1) {
      const interest = balance * annualRate / 1200;
      const payment = Math.min(emi, balance + interest);
      const principalPaid = Math.min(balance, payment - interest);
      balance = Math.max(0, balance - principalPaid);
      rows.push({ month, payment, principal: principalPaid, interest, balance });
    }
    const totalInterest = rows.reduce((total, row) => total + row.interest, 0);
    const totalPaid = principal + totalInterest;
    return { emi, months: rows.length, totalInterest, totalPaid, rows };
  }, [amount, rate, years]);

  const shareText = result
    ? `Home loan EMI estimate\nLoan amount: ${formatINR(Number(amount))}\nInterest rate: ${rate}% p.a.\nTenure: ${years} years\nMonthly EMI: ${formatINR(result.emi)}\nTotal interest: ${formatINR(result.totalInterest)}\nTotal payment: ${formatINR(result.totalPaid)}`
    : "";
  const principalShare = result ? Number(amount) / result.totalPaid * 100 : 0;

  return (
    <ToolCard title="EMI calculator" description="Estimate monthly instalments and review how each payment reduces principal and interest over time.">
      <div className={styles.formGrid}>
        <NumberField label="Loan amount" prefix="₹" value={amount} onChange={setAmount} min={1} max={1_000_000_000_000} step={1000} />
        <NumberField label="Annual interest rate (%)" value={rate} onChange={setRate} min={0} max={30} step={0.05} />
        <NumberField label="Tenure (years)" value={years} onChange={setYears} min={1} max={50} step={1} />
      </div>
      {result ? (
        <ResultPanel title="Estimated repayment" shareText={shareText}>
          <div className={styles.resultGrid}>
            <ResultMetric label="Monthly EMI" value={formatINR(result.emi)} />
            <ResultMetric label="Total interest" value={formatINR(result.totalInterest)} />
            <ResultMetric label="Total payment" value={formatINR(result.totalPaid)} />
          </div>
          <div className={styles.chartRow}>
            <div className={styles.pieChart} role="img" aria-label={`Repayment split: ${Math.round(principalShare)} percent principal, ${Math.round(100 - principalShare)} percent interest`} style={{ background: `conic-gradient(#24483d 0% ${principalShare}%, #c9d5a7 ${principalShare}% 100%)` }} />
            <div className={styles.legend}>
              <span><i style={{ background: "#24483d" }} />Principal: {formatINR(Number(amount))}</span>
              <span><i style={{ background: "#c9d5a7" }} />Interest: {formatINR(result.totalInterest)}</span>
              <span>Estimated schedule: {result.months} monthly payments</span>
            </div>
          </div>
          <div className={styles.tableScroller}>
            <table>
              <thead><tr><th>Month</th><th>EMI</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead>
              <tbody>{result.rows.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{formatINR(row.payment)}</td>
                  <td>{formatINR(row.principal)}</td>
                  <td>{formatINR(row.interest)}</td>
                  <td>{formatINR(row.balance)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </ResultPanel>
      ) : <p className={styles.disclaimer}>Enter an amount, rate from 0–30%, and tenure from 1–50 years to see the estimate.</p>}
      <p className={styles.disclaimer}>Illustrative calculation only. Lender fees, rate changes and payment timing are not included.</p>
    </ToolCard>
  );
}
