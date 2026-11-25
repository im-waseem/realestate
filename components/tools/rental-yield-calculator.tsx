"use client";

import { useMemo, useState } from "react";
import { formatINR, NumberField, parseNumber, ResultMetric, ResultPanel, ToolCard } from "./shared";
import styles from "./tool-ui.module.css";

export function RentalYieldCalculator() {
  const [price, setPrice] = useState("7500000");
  const [rent, setRent] = useState("35000");
  const [expenses, setExpenses] = useState("60000");
  const [appreciation, setAppreciation] = useState("5");
  const [years, setYears] = useState("10");

  const result = useMemo(() => {
    const purchasePrice = parseNumber(price, 1, 1_000_000_000_000);
    const monthlyRent = parseNumber(rent, 0, 1_000_000_000);
    const annualExpenses = parseNumber(expenses, 0, 1_000_000_000);
    const annualAppreciation = parseNumber(appreciation, -50, 50);
    const holdYears = parseNumber(years, 1, 50);
    if (purchasePrice === undefined || monthlyRent === undefined || annualExpenses === undefined || annualAppreciation === undefined || holdYears === undefined) return undefined;
    const annualGrossRent = monthlyRent * 12;
    const annualNetRent = annualGrossRent - annualExpenses;
    const futureValue = purchasePrice * (1 + annualAppreciation / 100) ** holdYears;
    const estimatedProfit = annualNetRent * holdYears + futureValue - purchasePrice;
    return {
      grossYield: annualGrossRent / purchasePrice * 100,
      netYield: annualNetRent / purchasePrice * 100,
      annualNetRent,
      futureValue,
      estimatedProfit,
      roi: estimatedProfit / purchasePrice * 100,
    };
  }, [price, rent, expenses, appreciation, years]);

  const shareText = result
    ? `Rental yield and ROI estimate\nPurchase price: ${formatINR(Number(price))}\nMonthly rent: ${formatINR(Number(rent))}\nAnnual expenses: ${formatINR(Number(expenses))}\nGross yield: ${result.grossYield.toFixed(2)}%\nNet yield: ${result.netYield.toFixed(2)}%\nEstimated value after ${years} years: ${formatINR(result.futureValue)}\nSimple total ROI: ${result.roi.toFixed(2)}%\nAssumptions: flat rent and expenses; appreciation compounds annually.`
    : "";

  return (
    <ToolCard title="Rental yield & ROI" description="Compare rental income with purchase price and model a simple hold-period return.">
      <div className={styles.formGrid}>
        <NumberField label="Purchase price" prefix="₹" value={price} onChange={setPrice} min={1} max={1_000_000_000_000} step={10000} />
        <NumberField label="Expected monthly rent" prefix="₹" value={rent} onChange={setRent} min={0} max={1_000_000_000} step={1000} />
        <NumberField label="Annual operating expenses" prefix="₹" value={expenses} onChange={setExpenses} min={0} max={1_000_000_000} step={1000} />
        <NumberField label="Annual appreciation (%)" value={appreciation} onChange={setAppreciation} min={-50} max={50} step={0.25} />
        <NumberField label="Holding period (years)" value={years} onChange={setYears} min={1} max={50} step={1} />
      </div>
      {result && (
        <ResultPanel title="Estimated investment view" shareText={shareText}>
          <div className={styles.resultGrid}>
            <ResultMetric label="Gross rental yield" value={`${result.grossYield.toFixed(2)}%`} />
            <ResultMetric label="Net rental yield" value={`${result.netYield.toFixed(2)}%`} />
            <ResultMetric label="Annual net rent" value={formatINR(result.annualNetRent)} />
            <ResultMetric label={`Estimated value in ${years} years`} value={formatINR(result.futureValue)} />
            <ResultMetric label="Simple total ROI" value={`${result.roi.toFixed(2)}%`} note={`${formatINR(result.estimatedProfit)} estimated profit`} />
          </div>
        </ResultPanel>
      )}
      <p className={styles.disclaimer}>Simple estimate only. Assumes rent and annual expenses stay flat, compounds appreciation annually, and excludes vacancy, tax, financing, transaction costs and maintenance beyond the expense input.</p>
    </ToolCard>
  );
}
