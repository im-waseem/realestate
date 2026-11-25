"use client";

import { useState } from "react";
import type { Lead } from "@/lib/db";
import { EnquiryDialog } from "./enquiry-item";
import { EnquiryRow } from "./enquiry-item";
import enquiryStyles from "./enquiry-item.module.css";

export function EnquiriesTable({ leads, assignees, properties, homeLoansEnabled = false }: {
  leads: (Lead & { agency_name?: string; property_title?: string; assignee_name?: string })[];
  assignees: { id: string; name: string; agency_id: string | null }[];
  properties: { id: string; title: string; agency_id: string }[];
  homeLoansEnabled?: boolean;
}) {
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
              <th scope="col">Assignee</th>
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
          assignees={assignees.filter((person) => person.agency_id === lead.agency_id)}
          properties={properties.filter((property) => property.agency_id === lead.agency_id)}
          homeLoansEnabled={homeLoansEnabled}
          open={isOpen(lead.id)}
          onClose={() => setOpenId(null)}
        />
      ))}
    </>
  );
}
