# Local Real Estate Agency Platform — Product Requirements

## Product goal

Help local real estate agencies keep property inventory and customer enquiries in one secure workspace. Agency staff should be able to find suitable properties and understand each enquiry's progress from a laptop, without relying on paper registers or searching through old calls and messages.

The platform owner works directly with agencies to understand their problems, help them adopt the system, and monitor activity across participating agencies.

## Users and access

### Platform owner

- Approve, suspend, and manage agency workspaces.
- See platform-wide totals for agencies, properties, and enquiries.
- See each agency's total, open, closed, and lost enquiry counts.
- Review agency listings, teams, and enquiry activity when needed to support the agency.
- Remove staff access when a person leaves an agency; removed users must no longer be able to sign in.

### Agency administrator

- Manage the agency's property inventory and customer enquiries.
- Add, update, and remove agency staff accounts.
- View agency-level property and enquiry totals and enquiry progress.
- Retain control of the agency's business records and keep its workspace separate from other agencies.

### Agent or agency staff member

- Sign in with an individual account.
- Add and update properties and customer enquiries for their own agency, subject to the agency's permissions.
- Search the agency's available properties and customer requirements.

## Property inventory

- Record each property under a clear property type, including house, apartment, shop, office, and empty land/plot.
- Record the transaction purpose separately: for sale, for rent, or for lease.
- Store the property title, full address, locality, city, price, size, description, photos, and availability status. Capture relevant details such as bedrooms, bathrooms, floor, and parking when they apply.
- Let staff record the property owner or landlord's name, mobile, and optional email in a separate private contact section. Keep these details out of public listing pages and separate from buyer/renter enquiries.
- Let staff search and filter inventory by property type, transaction purpose, location, price, and availability.
- Let agency staff import property listings from a clearly labeled Excel/CSV template, with row validation and a preview of errors before saving.
- Make it easy for staff to view the full property details from the agency workspace when helping a client.
- Keep internal property information and exact addresses private from public visitors unless the agency intentionally publishes it.

## Customer enquiries and leads

- Let staff record enquiries received in person, by phone, from the website, or through another source.
- Capture the client's name, mobile number, optional email, area/address when provided, what they want to do (buy, sell, rent, or lease), preferred property type and location, budget, requirements, and notes.
- Link an enquiry to a property when one is already known; allow enquiries that are not linked to a specific property.
- Show all enquiries for the agency in one searchable list, with contact details and requirements available to authorized staff.
- Track progress using clear stages: new, contacted, visit scheduled, negotiating, closed, and lost.
- Allow staff to update progress, add internal notes, and remove an enquiry when authorized.
- Provide quick ways to contact a client from the enquiry record, such as phone and email links.
- Let agencies import customer enquiries separately from property listings, using a matching template and validating contact, source, and stage fields.

## Local service providers

- Let each agency keep its own directory of trusted local tradespeople and service providers, such as plumbers, electricians, painters, carpenters, cleaners, movers, or any other locally useful service.
- Record a provider's name, trade/category, mobile number, service area or address, optional email, and notes about services or availability.
- Let agency staff search and filter providers by trade and service area, then open or call a provider from the agency workspace.
- Keep this directory separate from property inventory and client enquiries. A provider contact is not automatically a property lead or a platform user.
- Limit each provider directory to its agency, with platform-owner access for support and administration.

## Dashboards and reporting

### Platform owner dashboard — first implementation priority

- Show platform-wide counts for total, open, closed, and lost enquiries.
- Show lead counts by agency, alongside each agency's staff and property totals.
- Make pending agency approvals and listing status easy to review.
- Provide a direct path from an agency's summary to that agency's records and workspace details.
- Use actual database counts and the existing enquiry stages; do not substitute sample or hard-coded figures.

### Agency workspace — subsequent implementation phase

- Give agency staff a distinct visual identity from the platform owner's dashboard.
- Show agency property and enquiry totals, open follow-ups, and inventory availability.
- Make the property list and enquiry list easy to search and use on a laptop and phone.
- Include the agency's local service-provider directory so staff can find a plumber, electrician, painter, or other trusted contact for a client.
- Keep the agency's records isolated from other agencies.

## Security and privacy requirements

- Enforce role-based access on the server and database; hiding a button is not sufficient authorization.
- An agency user may access only records belonging to that user's agency. The platform owner may access cross-agency records for administration.
- Use individual staff accounts and the authentication provider for password handling. Never store or display a client's password in an enquiry record.
- When an agency staff member leaves, an authorized administrator can disable or remove the staff account and revoke active access.
- Limit access to client contact information to authorized users. Collect only the information needed to help with the property enquiry.
- Provide an authorized way to correct or delete client enquiry data and document the agency's retention process.
- Keep public listing data separate from private client records, agency contact details, and internal property information.

## Rollout order

1. **Platform owner first:** finish and review platform-wide and per-agency reporting, agency administration, and access controls.
2. **Agency workspace next:** refine staff workflows for properties, walk-in and phone enquiries, search, and follow-up.
3. **Pilot:** use the system with a small number of local agencies, observe their real workflows, and prioritize changes from their feedback.
4. **Pricing:** consider a modest monthly agency subscription only after agencies have used the workflow and confirmed it saves them time.

## Acceptance criteria

- The platform owner can see current total, open, closed, and lost enquiry counts, both platform-wide and per agency.
- Agency users cannot read or change another agency's properties, staff, or client enquiries.
- Staff can record an in-person client enquiry without requiring the client to create an account.
- Staff can find a relevant property using its type, purpose, location, and availability.
- Owner/landlord contact details stay private and are not shown in public listing projections.
- Property and enquiry spreadsheets are imported as separate record types, with clear validation errors for invalid rows.
- Staff can add, find, and contact service providers by trade and service area, without mixing those records with client enquiries.
- Enquiry details show the client's needs and current progress, and authorized staff can update or delete the record.
- Removing an agency user prevents that person from accessing the agency workspace.
- Client passwords are never collected or stored as part of a lead.

## Existing project context

The project already includes agency and staff roles, property listings with sale/rent/lease purposes, property search, enquiry capture and status updates, agency workspaces, and an owner dashboard. The owner dashboard is being prioritized first; this document records the intended workflow and the requirements to use when extending the current application.
