"use client";

import { useState } from "react";
import { AffordabilityCalculator } from "./affordability-calculator";
import { AreaConverter } from "./area-converter";
import { EmiCalculator } from "./emi-calculator";
import { LoanEligibilityCalculator } from "./loan-eligibility";
import { PrepaymentCalculator } from "./prepayment-calculator";
import { PropertyComparison } from "./property-comparison";
import { RentalYieldCalculator } from "./rental-yield-calculator";
import { StampDutyEstimator } from "./stamp-duty-estimator";
import styles from "./dashboard-tools.module.css";

const tools = [
  { id: "emi", label: "EMI calculator", Component: EmiCalculator },
  { id: "eligibility", label: "Loan eligibility", Component: LoanEligibilityCalculator },
  { id: "affordability", label: "Affordability", Component: AffordabilityCalculator },
  { id: "prepayment", label: "Prepayment impact", Component: PrepaymentCalculator },
  { id: "stamp-duty", label: "Stamp duty", Component: StampDutyEstimator },
  { id: "rental-yield", label: "Rental yield & ROI", Component: RentalYieldCalculator },
  { id: "area", label: "Area converter", Component: AreaConverter },
  { id: "comparison", label: "Compare listings", Component: PropertyComparison },
] as const;

export function DashboardTools() {
  const [active, setActive] = useState<(typeof tools)[number]["id"]>("emi");
  const selected = tools.find((tool) => tool.id === active) || tools[0];
  const ActiveTool = selected.Component;

  return (
    <div className={styles.layout}>
      <nav className={styles.navigation} aria-label="Property finance tools" role="tablist">
        {tools.map((tool) => (
          <button
            type="button"
            role="tab"
            id={`tool-tab-${tool.id}`}
            aria-controls="tool-panel"
            aria-selected={active === tool.id}
            className={active === tool.id ? styles.activeTab : ""}
            key={tool.id}
            onClick={() => setActive(tool.id)}
          >
            {tool.label}
          </button>
        ))}
      </nav>
      <div id="tool-panel" role="tabpanel" aria-labelledby={`tool-tab-${selected.id}`} className={styles.panel}>
        <ActiveTool />
      </div>
    </div>
  );
}
