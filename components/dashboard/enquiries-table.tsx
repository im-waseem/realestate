"use client";

import { useState } from "react";
import type { Lead } from "@/lib/db";
import { EnquiryDialog } from "./enquiry-item";
import { EnquiryRow } from "./enquiry-item";
import enquiryStyles from "./enquiry-item.module.css";

export function EnquiriesTable({ leads }: { leads: (Lead & { agency_name?: string })[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const isOpen = (id: string) => openId === id;

  return (
    <>
      <div className={enquiryStyles.tableScroller}>
        <table className={enquiryStyles.table} aria-label="Customer enquiries">
          <caption className={enquiryStyles.caption}>Customer enquiries</caption>
          <thead className={enquiryStyles.head}>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Agency</th>
              <th scope="col">Contact</th>
              <th scope="col">Looking to</th>
              <th scope="col">Progress</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <EnquiryRow
                key={lead.id}
                lead={lead}
                isOpen={isOpen(lead.id)}
                onOpen={() => setOpenId(lead.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {leads.map((lead) => (
        <EnquiryDialog
          key={lead.id}
          lead={lead}
          open={isOpen(lead.id)}
          onClose={() => setOpenId(null)}
        />
      ))}
    </>
  );
}