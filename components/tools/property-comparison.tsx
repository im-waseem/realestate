"use client";

import { useMemo, useState } from "react";
import { formatINR, NumberField, parseNumber, ResultPanel, ToolCard } from "./shared";
import styles from "./tool-ui.module.css";

type Listing = {
  name: string;
  price: string;
  area: string;
  bedrooms: string;
  bathrooms: string;
  monthlyRent: string;
};

const blankListing = (name: string): Listing => ({
  name,
  price: "",
  area: "",
  bedrooms: "2",
  bathrooms: "2",
  monthlyRent: "",
});

export function PropertyComparison() {
  const [listings, setListings] = useState<Listing[]>([blankListing("Listing A"), blankListing("Listing B")]);

  const comparisons = useMemo(() => {
    const parsed = listings.map((listing) => ({
      name: listing.name.trim() || "Untitled listing",
      price: parseNumber(listing.price, 1, 1_000_000_000_000),
      area: parseNumber(listing.area, 1, 1_000_000),
      bedrooms: parseNumber(listing.bedrooms, 0, 50),
      bathrooms: parseNumber(listing.bathrooms, 0, 50),
      monthlyRent: listing.monthlyRent.trim() ? parseNumber(listing.monthlyRent, 0, 1_000_000_000) : 0,
    }));
    if (parsed.some((listing) => Object.values(listing).some((value) => value === undefined))) return undefined;
    return parsed.map((listing) => ({
      name: listing.name,
      price: listing.price!,
      area: listing.area!,
      pricePerSqft: listing.price! / listing.area!,
      bedrooms: listing.bedrooms!,
      bathrooms: listing.bathrooms!,
      monthlyRent: listing.monthlyRent!,
      grossYield: listing.monthlyRent! * 12 / listing.price! * 100,
    }));
  }, [listings]);

  const shareText = comparisons
    ? `Property comparison\n${comparisons.map((listing) =>
      `${listing.name}: ${formatINR(listing.price)}, ${listing.area.toLocaleString("en-IN")} sq ft, ${formatINR(listing.pricePerSqft)}/sq ft, ${listing.bedrooms} bed / ${listing.bathrooms} bath, gross yield ${listing.grossYield.toFixed(2)}%`,
    ).join("\n")}`
    : "";

  function update(index: number, field: keyof Listing, value: string) {
    setListings((current) => current.map((listing, itemIndex) => itemIndex === index ? { ...listing, [field]: value } : listing));
  }

  return (
    <ToolCard title="Property comparison" description="Compare two or three listings side by side. Enter listing details manually; this tool does not read or save database records.">
      <div className={styles.compareGrid}>
        {listings.map((listing, index) => (
          <div className={styles.compareCard} key={index}>
            <h3>Listing {String.fromCharCode(65 + index)}</h3>
            <label className={styles.field}>
              <span>Listing name or locality</span>
              <input value={listing.name} maxLength={100} onChange={(event) => update(index, "name", event.target.value)} />
            </label>
            <NumberField label="Price" prefix="₹" value={listing.price} onChange={(value) => update(index, "price", value)} min={1} max={1_000_000_000_000} step={10000} />
            <NumberField label="Area (sq ft)" value={listing.area} onChange={(value) => update(index, "area", value)} min={1} max={1_000_000} step={10} />
            <NumberField label="Bedrooms" value={listing.bedrooms} onChange={(value) => update(index, "bedrooms", value)} min={0} max={50} step={1} />
            <NumberField label="Bathrooms" value={listing.bathrooms} onChange={(value) => update(index, "bathrooms", value)} min={0} max={50} step={1} />
            <NumberField label="Expected monthly rent (optional)" prefix="₹" value={listing.monthlyRent} onChange={(value) => update(index, "monthlyRent", value)} min={0} max={1_000_000_000} step={1000} />
            {listings.length > 2 && <button className="quiet" type="button" onClick={() => setListings((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove listing</button>}
          </div>
        ))}
      </div>
      {listings.length < 3 && (
        <div className={styles.inlineControl}>
          <button className="btn small workspace-secondary" type="button" onClick={() => setListings((current) => [...current, blankListing(`Listing ${String.fromCharCode(65 + current.length)}`)])}>+ Add another listing</button>
        </div>
      )}
      {comparisons && (
        <ResultPanel title="Side-by-side comparison" shareText={shareText}>
          <div className={styles.tableScroller}>
            <table className={styles.simpleTable}>
              <thead><tr><th>Measure</th>{comparisons.map((listing, index) => <th key={index}>{listing.name}</th>)}</tr></thead>
              <tbody>
                <tr><th>Price</th>{comparisons.map((listing, index) => <td key={index}>{formatINR(listing.price)}</td>)}</tr>
                <tr><th>Area</th>{comparisons.map((listing, index) => <td key={index}>{listing.area.toLocaleString("en-IN")} sq ft</td>)}</tr>
                <tr><th>Price per sq ft</th>{comparisons.map((listing, index) => <td key={index}>{formatINR(listing.pricePerSqft)}</td>)}</tr>
                <tr><th>Beds / baths</th>{comparisons.map((listing, index) => <td key={index}>{listing.bedrooms} / {listing.bathrooms}</td>)}</tr>
                <tr><th>Monthly rent</th>{comparisons.map((listing, index) => <td key={index}>{formatINR(listing.monthlyRent)}</td>)}</tr>
                <tr><th>Gross rental yield</th>{comparisons.map((listing, index) => <td key={index}>{listing.grossYield.toFixed(2)}%</td>)}</tr>
              </tbody>
            </table>
          </div>
        </ResultPanel>
      )}
      {!comparisons && <p className={styles.disclaimer}>Enter a valid price and area for each listing to compare the results.</p>}
      <p className={styles.disclaimer}>Gross rental yield excludes vacancies, expenses, taxes, financing and purchase costs.</p>
    </ToolCard>
  );
}
