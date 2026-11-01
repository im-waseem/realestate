import Link from "next/link";
import { SearchableCollection } from "@/components/dashboard/searchable-collection";
import { WorkspaceShell, WorkspaceSection, WorkspaceNavLink } from "@/components/dashboard/workspace-shell";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import type { Lead, Property, User } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import { addStaff, deleteAgency, deleteProperty, deleteStaff, logout, propertyStatus, setAgencyStatus, updateAgencyProfile, updateStaff } from "@/app/actions";
import { Money, Notice } from "@/components/platform";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EnquiriesTable } from "@/components/dashboard/enquiries-table";
import enquiryStyles from "@/components/dashboard/enquiry-item.module.css";

type Agency = {
  id: string;
  name: string;
  status: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  user_count: number;
  property_count: number;
  activity_count: number;
};
type DashboardProperty = Property & { agency_name?: string };
type DashboardLead = Lead & { agency_name?: string };
const ENQUIRIES_PER_PAGE = 10;

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="panel dashboard-metric">
      <p className="dashboard-metric-label">{label}</p>
      <strong className="dashboard-metric-value">{value}</strong>
      <p className="dashboard-metric-detail">{detail}</p>
    </article>
  );
}

function AgencyDetails({
  agency,
  editable = false,
  superAdmin = false,
}: {
  agency: Agency;
  editable?: boolean;
  superAdmin?: boolean;
}) {
  const hasLocation = agency.lat !== null && agency.lng !== null;
  const mapSrc = hasLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${agency.lng! - 0.015}%2C${agency.lat! - 0.015}%2C${agency.lng! + 0.015}%2C${agency.lat! + 0.015}&layer=mapnik&marker=${agency.lat}%2C${agency.lng}`
    : undefined;

  return (
    <div className="agency-details-card">
      <div className="agency-details-copy">
        <h3>{agency.name}</h3>
        <p><strong>Office</strong><span>{agency.address || "Address not provided"}</span></p>
        <p>
          <strong>Phone</strong>
          {agency.phone
            ? <a href={`tel:${agency.phone}`}>{agency.phone}</a>
            : <span>Phone not provided</span>}
        </p>
        {hasLocation && (
          <a
            className="agency-map-link"
            href={`https://www.openstreetmap.org/?mlat=${agency.lat}&mlon=${agency.lng}#map=15/${agency.lat}/${agency.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Open location in map
          </a>
        )}
      </div>
      {mapSrc ? (
        <iframe
          className="agency-dashboard-map"
          title={`${agency.name} office location`}
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="agency-map-placeholder">
          <span>Map location not added</span>
          <small>Add latitude and longitude when registering to display an office map here.</small>
        </div>
      )}
      {editable && (
        <form action={updateAgencyProfile} className="stack agency-profile-form">
          <p className="kicker">EDIT BUSINESS DETAILS</p>
          {superAdmin && <input type="hidden" name="agency_id" value={agency.id} />}
          <label>Agency name<input name="name" defaultValue={agency.name} maxLength={150} required /></label>
          <label>Phone<input name="phone" type="tel" defaultValue={agency.phone} maxLength={25} required /></label>
          <label>Office address<input name="address" defaultValue={agency.address} maxLength={500} required /></label>
          <div className="form-grid">
            <label>Latitude<input name="lat" type="number" min="-90" max="90" step="any" defaultValue={agency.lat ?? ""} /></label>
            <label>Longitude<input name="lng" type="number" min="-180" max="180" step="any" defaultValue={agency.lng ?? ""} /></label>
          </div>
          <small>Enter both map coordinates or leave both blank. This map appears only inside the dashboard.</small>
          <button className="btn small">Save agency details</button>
        </form>
      )}
    </div>
  );
}

function SidebarIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
    agencies: <><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-5h6v5M9 9h.01M15 9h.01" /></>,
    properties: <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h14V9M9 21v-7h6v7" /></>,
    leads: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 8v6m3-3h-6" /></>,
    team: <><path d="M16 21v-2a4 4 0 0 0-3-3.87" /><path d="M8 21v-2a4 4 0 0 1 4-4h1" /><circle cx="9" cy="7" r="4" /><path d="M18 8a4 4 0 0 1 0 8" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
  };

  return (
    <svg aria-hidden="true" className="dashboard-sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ message?: string; leadsPage?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const isSuperAdmin = user.role === "super_admin";
  const supabase = await createSupabaseServerClient();
  const parsedPage = Number(query.leadsPage);
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= 1_000_000 ? parsedPage : 1;
  const [propertyResult, leadResult, summaryResult, staffResult] = await Promise.all([
    supabase.from("properties").select("*").order("created_at", { ascending: false }),
    supabase.from("leads")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((requestedPage - 1) * ENQUIRIES_PER_PAGE, requestedPage * ENQUIRIES_PER_PAGE - 1),
    supabase.rpc("realty_dashboard_summary", {}),
    supabase.from("profiles").select("id,name,email,role,agency_id").neq("role", "super_admin").order("name"),
  ]);
  const rawProperties = supabaseData(propertyResult.data, propertyResult.error, "Unable to load properties");
  const rawLeads = supabaseData(leadResult.data, leadResult.error, "Unable to load enquiries");
  const summary = supabaseData(summaryResult.data, summaryResult.error, "Unable to load dashboard summary. Apply sql/migrations/20261101_dashboard_summary.sql")?.[0];
  if (!summary || leadResult.count === null) throw new Error("Unable to load dashboard counts.");
  const totalLeadCount = leadResult.count;
  const activeLeads = summary.open_leads;
  const totalLeadPages = Math.max(1, Math.ceil(totalLeadCount / ENQUIRIES_PER_PAGE));
  if (requestedPage > totalLeadPages) {
    redirect(`/dashboard?leadsPage=${totalLeadPages}#leads`);
  }
  const staff: User[] = supabaseData(staffResult.data, staffResult.error, "Unable to load agency users");
  let agencies: Agency[] = [];
  let agencyDetails: Agency | undefined;
  let activity: { id: string; agency_id: string | null; actor: string; action: string; created_at: string }[] = [];
  if (isSuperAdmin) {
    const [agencyResult, activityResult] = await Promise.all([
      supabase.from("agencies").select("*").order("created_at", { ascending: false }),
      supabase.from("activity").select("*").order("created_at", { ascending: false }).limit(60),
    ]);
    const agencyRows = supabaseData(agencyResult.data, agencyResult.error, "Unable to load agencies");
    activity = supabaseData(activityResult.data, activityResult.error, "Unable to load activity");
    agencies = agencyRows.map((agency) => ({
      ...agency,
      user_count: staff.filter((member) => member.agency_id === agency.id).length,
      property_count: rawProperties.filter((property) => property.agency_id === agency.id).length,
      activity_count: activity.filter((entry) => entry.agency_id === agency.id).length,
    }));
  } else if (user.agency_id) {
    const { data, error } = await supabase.from("agencies").select("*").eq("id", user.agency_id).maybeSingle();
    const agency = supabaseData(data, error, "Unable to load your agency profile");
    agencyDetails = {
      ...agency,
      user_count: staff.filter((member) => member.agency_id === agency.id).length,
      property_count: 0,
      activity_count: 0,
    };
  }
  const agenciesById = new Map(agencies.map((agency) => [agency.id, agency.name]));
  const properties: DashboardProperty[] = rawProperties.map((property) => ({
    ...property,
    agency_name: agenciesById.get(property.agency_id) || agencyDetails?.name,
  }));
  const leads: DashboardLead[] = rawLeads.map((lead) => ({ ...lead, agency_name: agenciesById.get(lead.agency_id) || agencyDetails?.name }));
  const agencyName = agencyDetails?.name;
  const pendingProperties = summary.pending;
  const pendingAgencies = summary.pending_agencies;
  const navigation = [
    { label: "Overview", href: "#overview", icon: "overview" },
    ...(isSuperAdmin ? [{ label: "Agencies", href: "#agencies", icon: "agencies", count: pendingAgencies }] : []),
    ...(!isSuperAdmin ? [{ label: "Agency details", href: "#agency-details", icon: "agencies" }] : []),
    { label: isSuperAdmin ? "All properties" : "My properties", href: "#inventory", icon: "properties", count: isSuperAdmin ? pendingProperties : undefined },
    { label: "Enquiries", href: "#leads", icon: "leads", count: activeLeads },
    { label: isSuperAdmin ? "Agency users" : "Team", href: "#team", icon: "team" },
    ...(isSuperAdmin ? [{ label: "Activity", href: "#activity", icon: "activity" }] : []),
  ];

  return (
    <WorkspaceShell allowedViews={isSuperAdmin ? ["overview", "agencies", "inventory", "leads", "team", "activity"] : ["overview", "agency-details", "inventory", "leads", "team"]}>
      <aside className="dashboard-sidebar">
        <Link className="dashboard-sidebar-brand" href="/">
          <span className="dashboard-sidebar-brandmark">{isSuperAdmin ? "W" : agencyName?.trim().slice(0, 1).toUpperCase() || "W"}</span>
          <span className="dashboard-sidebar-brandtext">{isSuperAdmin ? "WASEEM REALTY" : agencyName || "AGENCY"}<small>WORKSPACE</small></span>
        </Link>

        <div className="dashboard-sidebar-account">
          <span className="dashboard-sidebar-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <span className="dashboard-sidebar-account-copy">
            <strong>{user.name}</strong>
            <small>{isSuperAdmin ? "Super admin" : agencyName || "Agency workspace"}</small>
          </span>
        </div>

        <p className="dashboard-sidebar-label">WORKSPACE</p>
        <nav aria-label="Dashboard sections" className="dashboard-sidebar-nav">
          {navigation.map((item) => (
            <WorkspaceNavLink href={item.href} key={item.href}>
              <SidebarIcon name={item.icon} />
              <span>{item.label}</span>
              {item.count ? <small>{item.count}</small> : null}
            </WorkspaceNavLink>
          ))}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <Link className="dashboard-sidebar-add" href="/dashboard/properties/new"><span>+</span>Add property</Link>
          <Link className="dashboard-sidebar-public" href="/">View public website</Link>
          <form action={logout}>
            <button className="dashboard-sidebar-signout" type="submit">
              <span aria-hidden="true">↗</span> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="dashboard-main">
        <main className="workspace dashboard">
        <header className="workspace-topbar"><div><span className="workspace-status-dot" /> {isSuperAdmin ? "Platform control center" : "Agency workspace"}</div><span>{user.role.replaceAll("_", " ")} <strong>{user.name}</strong></span></header>
        <Notice message={query.message} />
        <WorkspaceSection id="overview">
        <section className={`dashboard-hero ${isSuperAdmin ? "dashboard-hero-admin" : "dashboard-hero-agency"}`}>
          <div className="dashboard-hero-copy">
            <p className="kicker">{isSuperAdmin ? "PLATFORM ADMINISTRATION" : "AGENCY WORKSPACE"}</p>
            <h1>
              {isSuperAdmin ? "Your platform, at a glance." : <>Welcome back, <em>{user.name}.</em></>}
            </h1>
            <p className="muted">
              {isSuperAdmin
                ? "Manage agency profiles, listings, enquiries, teams, account status, and activity across the platform."
                : `${agencyName || "Your agency"} · Manage your listings, customer enquiries, and team in one place.`}
            </p>
          </div>
          <Link className="btn" href="/dashboard/properties/new">+ Add property</Link>
        </section>



        <section aria-label="Dashboard summary" className="dashboard-metrics">
          {isSuperAdmin ? (
            <>
              <Metric label="Agencies" value={summary.agency_total} detail="All registered agencies" />
              <Metric
                label="Pending agencies"
                value={summary.pending_agencies}
                detail="Current agency status"
              />
              <Metric label="Pending listings" value={pendingProperties} detail="Current listing status" />
              <Metric
                label="Published listings"
                value={summary.published}
                detail="Private to their agency workspaces"
              />
            </>
          ) : (
            <>
              <Metric label="Property listings" value={summary.property_total} detail="Across your agency" />
              <Metric label="Published listings" value={summary.published} detail="Private to your agency workspace" />
              <Metric label="Open enquiries" value={activeLeads} detail="Needs a follow-up" />
              <Metric label="Team members" value={summary.team_count} detail="People in your workspace" />
            </>
          )}
        </section>

        <div className="workspace-overview-grid">
          <article className="panel workspace-priorities">
            <div className="workspace-card-heading"><div><p className="kicker">YOUR NEXT STEPS</p><h2>Needs your attention</h2></div><span className="workspace-round-icon"><SidebarIcon name="activity" /></span></div>
            {isSuperAdmin && <a className="workspace-task" href="#agencies"><span className="workspace-task-icon"><SidebarIcon name="agencies" /></span><span><strong>Agency approvals</strong><small>Review registrations and manage workspace access</small></span><b>{pendingAgencies}</b><span>→</span></a>}
            <a className="workspace-task" href="#inventory"><span className="workspace-task-icon"><SidebarIcon name="properties" /></span><span><strong>{isSuperAdmin ? "Listing review" : "Your property inventory"}</strong><small>{pendingProperties} pending · keep availability up to date</small></span><b>{summary.property_total}</b><span>→</span></a>
            <a className="workspace-task" href="#leads"><span className="workspace-task-icon"><SidebarIcon name="leads" /></span><span><strong>Customer follow-ups</strong><small>Open conversations waiting for their next step</small></span><b>{activeLeads}</b><span>→</span></a>
            <a className="workspace-task" href="#team"><span className="workspace-task-icon"><SidebarIcon name="team" /></span><span><strong>{isSuperAdmin ? "People & access" : "Your team"}</strong><small>{isSuperAdmin ? "Manage agency roles and accounts" : "Find your agents and manage team access"}</small></span><b>{summary.team_count}</b><span>→</span></a>
          </article>
          <article className="panel workspace-inventory-summary">
            <p className="kicker">INVENTORY SNAPSHOT</p><h2>A clearer view of your listings</h2>
            <div className="workspace-inventory-total"><strong>{summary.property_total}</strong><span>total properties</span></div>
            {[{ label: "Published", status: "published" }, { label: "Pending review", status: "pending" }, { label: "Sold", status: "sold" }, { label: "Rented", status: "rented" }, { label: "Withdrawn", status: "withdrawn" }, { label: "Rejected", status: "rejected" }].map(({ label, status }) => {
              const count = summary[status as "published" | "pending" | "sold" | "rented" | "withdrawn" | "rejected"];
              return <div className="workspace-progress" key={status}><div><span>{label}</span><strong>{count}</strong></div><progress aria-label={label} max={Math.max(summary.property_total, 1)} value={count} /></div>;
            })}
          </article>
        </div>
        <article className="panel workspace-get-started"><div><p className="kicker">{isSuperAdmin ? "BUILT FOR YOUR PLATFORM" : "MAKE YOUR NEXT MOVE"}</p><h2>{isSuperAdmin ? "Every workspace. One clear view." : "More time for clients. Less time searching."}</h2><p className="muted">{isSuperAdmin ? "Use the navigation to manage agencies, properties, customer enquiries and account access separately." : "Add a listing, record a customer enquiry, or update your business profile. Each task has its own space."}</p></div><div><Link className="btn" href="/dashboard/properties/new">+ Create listing</Link><Link className="btn workspace-secondary" href="/dashboard/leads/new">+ Add enquiry</Link></div></article>
        </WorkspaceSection>

        {!isSuperAdmin && agencyDetails && (
          <WorkspaceSection id="agency-details" className="dashboard-section agency-profile-section">
            <div className="dashboard-section-heading">
              <div>
                <p className="kicker">YOUR BUSINESS PROFILE</p>
                <h2>Agency details</h2>
              </div>
              <span className={`badge ${agencyDetails.status}`}>{agencyDetails.status}</span>
            </div>
            <AgencyDetails agency={agencyDetails} editable={user.role === "agency_admin"} />
          </WorkspaceSection>
        )}

        {isSuperAdmin && (
          <WorkspaceSection id="agencies" className="dashboard-section">
            <div className="dashboard-section-heading">
              <div>
                <p className="kicker">AGENCY ADMINISTRATION</p>
                <h2>Manage agencies</h2>
              </div>
              <p className="muted">Edit profiles, control access, and manage each agency workspace and its data.</p>
            </div>
            <div className="panel dashboard-list">
              <SearchableCollection label="Find an agency" items={agencies.map((agency) => ({ id: agency.id, search: `${agency.name} ${agency.phone} ${agency.status}`, content: (
                <details className="agency-row workspace-agency" key={agency.id}><summary><span className="workspace-agency-avatar">{agency.name.slice(0, 1).toUpperCase()}</span><span><strong>{agency.name}</strong><small>{agency.user_count} people · {agency.property_count} properties</small></span><span className={`badge ${agency.status}`}>{agency.status}</span><span className="workspace-expand">Manage ↗</span></summary>
                  <div className="dashboard-agency-detail">
                    <AgencyDetails agency={agency} editable superAdmin />
                    <div className="dashboard-row-end">
                      <span className={`badge ${agency.status}`}>{agency.status}</span>
                      <span className="muted">{agency.user_count} users · {agency.property_count} listings</span>
                      <form action={setAgencyStatus}>
                        <input type="hidden" name="agency_id" value={agency.id} />
                        <input type="hidden" name="status" value={agency.status === "active" ? "suspended" : "active"} />
                        <button className="btn small">
                          {agency.status === "pending" ? "Approve agency" : agency.status === "suspended" ? "Reactivate agency" : "Suspend agency"}
                        </button>
                      </form>
                      <form action={deleteAgency}>
                        <input type="hidden" name="agency_id" value={agency.id} />
                        <ConfirmDeleteButton confirmMessage={`Permanently delete ${agency.name} and all its users, properties, enquiries, and activity? This cannot be undone.`}>
                          Delete agency and all data
                        </ConfirmDeleteButton>
                      </form>
                    </div>
                  </div>
                </details>
              ) }))} />
            </div>
          </WorkspaceSection>
        )}

        <WorkspaceSection id="inventory" className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="kicker">{isSuperAdmin ? "ALL AGENCY LISTINGS" : "YOUR INVENTORY"}</p>
              <h2>{isSuperAdmin ? "All agency properties" : "Property listings"}</h2>
            </div>
            <p className="muted">
              {isSuperAdmin
                ? "Create, edit, publish, change status, or delete any agency property."
                : "Manage your own sale, rent, and lease listings."}
            </p>
            {isSuperAdmin
              ? <Link className="btn small" href="/dashboard/properties/new">+ Add agency property</Link>
              : <Link className="btn small" href="/dashboard/properties">Open my property workspace →</Link>}
          </div>
          <div className="panel workspace-property-list">
            <SearchableCollection label="Find a property" placeholder="Search title, city, agency or status…" tableHeader={
                <tr>
                  <th>Property</th>
                  {isSuperAdmin && <th>Agency</th>}
                  <th>Price</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              } items={properties.map((property) => ({ id: property.id, search: `${property.title} ${property.city} ${property.locality} ${property.agency_name || ""} ${property.status} ${property.intent}`, content: (
                  <tr key={property.id}>
                    <td>
                      <strong>{property.title}</strong>
                      <small>{property.locality}, {property.city} · {property.intent}</small>
                    </td>
                    {isSuperAdmin && <td>{property.agency_name}</td>}
                    <td><Money value={property.price} /></td>
                    <td><span className={`badge ${property.status}`}>{property.status}</span></td>
                    <td>
                      {(
                        <div className="row-actions">
                          <Link href={`/dashboard/properties/${property.id}`}>Edit</Link>
                          <form action={deleteProperty}>
                            <input type="hidden" name="id" value={property.id} />
                            <ConfirmDeleteButton
                              title={isSuperAdmin
                                ? "Permanently delete this property"
                                : "Deletion is blocked when customer enquiries are linked to this property."}
                              confirmMessage={`Permanently delete "${property.title}"? This cannot be undone.`}
                            >
                              Delete property
                            </ConfirmDeleteButton>
                          </form>
                          <form action={propertyStatus}>
                            <input type="hidden" name="id" value={property.id} />
                            <select name="status" aria-label={`Status for ${property.title}`} defaultValue="">
                              <option value="" disabled>Change status</option>
                              {["published", "sold", "rented", "withdrawn"].map((status) => <option key={status}>{status}</option>)}
                            </select>
                            <button className="btn small">Save</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
            ) }))} />
          </div>
        </WorkspaceSection>

        <WorkspaceSection id="leads" className="dashboard-section">
          <div className="dashboard-section-heading dashboard-section-heading-action">
            <div>
              <p className="kicker">CUSTOMER RELATIONSHIPS</p>
              <h2>Customer enquiries</h2>
            </div>
            <Link className="btn small" href="/dashboard/leads/new">+ Add customer</Link>
          </div>
          {leads.length > 0 ? (
            <EnquiriesTable leads={leads} />
          ) : (
            <p className="empty panel">Customer enquiries will appear here.</p>
          )}
          {totalLeadCount > 0 && (
            <nav className={enquiryStyles.enquiryPagination} aria-label="Customer enquiry pages">
              <span className={enquiryStyles.enquiryPaginationSummary}>
                Showing {(requestedPage - 1) * ENQUIRIES_PER_PAGE + 1}–{Math.min(requestedPage * ENQUIRIES_PER_PAGE, totalLeadCount)} of {totalLeadCount}
              </span>
              <div className={enquiryStyles.enquiryPaginationControls}>
                {requestedPage > 1
                  ? <Link href={`/dashboard?leadsPage=${requestedPage - 1}#leads`}>← Previous</Link>
                  : <span aria-disabled="true">Previous</span>}
                <strong>{requestedPage} <span>/</span> {totalLeadPages}</strong>
                {requestedPage < totalLeadPages
                  ? <Link href={`/dashboard?leadsPage=${requestedPage + 1}#leads`}>Next →</Link>
                  : <span aria-disabled="true">Next</span>}
              </div>
            </nav>
          )}
        </WorkspaceSection>

        <WorkspaceSection id="team" className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="kicker">{isSuperAdmin ? "WORKSPACE ACCESS" : "PEOPLE"}</p>
              <h2>{isSuperAdmin ? "Agency users" : "Your team"}</h2>
            </div>
            <p className="muted">
              {isSuperAdmin ? "Edit, reassign, add, or remove people across agency accounts." : "Manage the agents in your agency."}
            </p>
          </div>
          <div className="detail-columns">
            <div className="panel dashboard-list">
              <SearchableCollection label="Find a team member" items={staff.map((member) => ({ id: member.id, search: `${member.name} ${member.email} ${member.role} ${agenciesById.get(member.agency_id || "") || ""}`, content: (
                <div className="agency-row" key={member.id}>
                  <div>
                    <strong>{member.name}</strong>
                    <small>{member.email}</small>
                  </div>
                  <div className="dashboard-row-end">
                    {isSuperAdmin && <small>{agencies.find((agency) => agency.id === member.agency_id)?.name}</small>}
                    <span className="badge">{member.role.replaceAll("_", " ")}</span>
                    {(isSuperAdmin || (user.role === "agency_admin" && member.role === "agent")) && <details className="workspace-member-edit"><summary>Edit account</summary><form action={updateStaff} className="team-member-edit">
                      <input type="hidden" name="id" value={member.id} />
                      {isSuperAdmin && (
                        <label>Agency<select name="agency_id" required defaultValue={member.agency_id || ""}>
                          <option value="" disabled>Select agency</option>
                          {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}
                        </select></label>
                      )}
                      {!isSuperAdmin && <input type="hidden" name="agency_id" value={user.agency_id || ""} />}
                      <label>Name<input name="name" defaultValue={member.name} maxLength={100} required /></label>
                      <label>Email<input name="email" type="email" defaultValue={member.email} maxLength={254} required /></label>
                      {isSuperAdmin && <label>Role<select name="role" defaultValue={member.role === "agency_admin" ? "agency_admin" : "agent"}><option value="agent">Agent</option><option value="agency_admin">Agency admin</option></select></label>}
                      {!isSuperAdmin && <input type="hidden" name="role" value="agent" />}
                      <button className="btn small">Save team member</button>
                    </form></details>}
                    {(isSuperAdmin || (user.role === "agency_admin" && member.role === "agent")) && <form action={deleteStaff}>
                      <input type="hidden" name="id" value={member.id} />
                      <ConfirmDeleteButton confirmMessage={`Remove ${member.name} from this agency? Their active sessions will be revoked.`}>Remove user</ConfirmDeleteButton>
                    </form>}
                  </div>
                </div>
              ) }))} />
            </div>
            {(user.role === "agency_admin" || isSuperAdmin) && (
              <form action={addStaff} className="panel stack dashboard-add-staff">
                <div>
                  <p className="kicker">{isSuperAdmin ? "WORKSPACE ACCESS" : "GROW YOUR TEAM"}</p>
                  <h3>{isSuperAdmin ? "Add an agency user" : "Add an agent"}</h3>
                </div>
                {isSuperAdmin && <label>Agency<select name="agency_id" required defaultValue=""><option value="" disabled>Select agency</option>{agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name} · {agency.status}</option>)}</select></label>}
                <label>Name<input name="name" required maxLength={100} /></label>
                <label>Email<input name="email" type="email" required /></label>
                <label>Initial password<input type="password" name="password" minLength={12} maxLength={128} required /></label>
                <button className="btn">{isSuperAdmin ? "Create user account" : "Create agent account"}</button>
              </form>
            )}
          </div>
        </WorkspaceSection>

        {isSuperAdmin && <WorkspaceSection id="activity" className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="kicker">AUDIT TRAIL</p>
              <h2>Recent activity</h2>
            </div>
            <p className="muted">Recent events across agency workspaces.</p>
          </div>
          <div className="panel dashboard-list">
            {activity.map((item) => (
              <div className="activity-row" key={item.id}>
                <span className="activity-dot" />
                <div><strong>{item.actor}</strong><p>{item.action}</p></div>
                <time>{item.created_at} UTC</time>
              </div>
            ))}
            {!activity.length && <p className="empty">Activity will appear here as your workspace is used.</p>}
          </div>
        </WorkspaceSection>}
        </main>
      </div>
    </WorkspaceShell>
  );
}
