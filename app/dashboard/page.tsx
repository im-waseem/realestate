import Link from "next/link";
import Image from "next/image";
import { AgencyProfileEditor } from "@/components/dashboard/agency-profile-editor";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { SearchableCollection } from "@/components/dashboard/searchable-collection";
import { PropertyTable } from "@/components/dashboard/property-table";
import { WorkspaceShell, WorkspaceSection, WorkspaceNavLink } from "@/components/dashboard/workspace-shell";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import type { Lead, Property, ServiceProvider, User } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseData } from "@/lib/supabase/results";
import { sevenDaysAgoIso } from "@/lib/dates";
import { addStaff, deleteAgency, deleteServiceProvider, logout, saveServiceProvider, setAgencyStatus, setStaffActive, updateAgencyFeature, updateStaff } from "@/app/actions";
import { Notice } from "@/components/platform";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EnquiriesTable } from "@/components/dashboard/enquiries-table";
import { AgencyLeadQr } from "@/components/dashboard/agency-lead-qr";
import enquiryStyles from "@/components/dashboard/enquiry-item.module.css";
import { hasAgencyFeature, type AgencyFeature } from "@/lib/features";

type Agency = {
  id: string;
  name: string;
  status: string;
  features: { home_loans: boolean; tools: boolean };
  logo_url: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  whatsapp: string;
  website: string;
  registration_number: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  service_areas: string;
  working_hours: string;
  description: string;
  lat: number | null;
  lng: number | null;
  user_count: number;
  property_count: number;
  lead_count: number;
  open_lead_count: number;
  closed_lead_count: number;
  lost_lead_count: number;
  activity_count: number;
};
type DashboardProperty = Property & { agency_name?: string };
type DashboardLead = Lead & { agency_name?: string; property_title?: string; assignee_name?: string };
type DashboardServiceProvider = ServiceProvider & { agency_name?: string };
const ENQUIRIES_PER_PAGE = 10;
export const metadata: Metadata = { title: "Overview" };
const SERVICE_CATEGORIES = [
  "Plumber", "Electrician", "Painter", "Carpenter", "Mason / bricklayer", "Builder / construction contractor",
  "Civil engineer", "Structural engineer", "Architect", "Interior designer", "3D / space designer",
  "Property surveyor", "Property valuer / appraiser", "Property lawyer", "Property manager", "Home inspector",
  "Renovation contractor", "Demolition contractor", "Tile installer", "Flooring installer", "Roofer",
  "Waterproofing specialist", "Glazier", "Aluminium fabricator", "Welder / fabricator", "HVAC technician",
  "AC technician", "Lift / elevator technician", "Solar installer", "Appliance repair technician", "Cleaner",
  "Pest control", "Gardener", "Landscaper", "Locksmith", "Security / CCTV installer", "Mover / packer",
  "Borewell contractor", "Water tank service", "Drainage / septic service", "Other",
];

function ServiceProviderForm({
  agencies,
  provider,
  agencyId,
  superAdmin,
  compact = false,
}: {
  agencies: Agency[];
  provider?: ServiceProvider;
  agencyId?: string;
  superAdmin: boolean;
  compact?: boolean;
}) {
  return (
    <form action={saveServiceProvider} className={`stack service-provider-form ${compact ? "is-compact" : ""}`}>
      {provider && <input type="hidden" name="id" value={provider.id} />}
      {superAdmin && (
        <label>Agency<select name="agency_id" defaultValue={provider?.agency_id || agencyId || ""} required>
          <option value="" disabled>Select an agency</option>
          {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name} · {agency.status}</option>)}
        </select></label>
      )}
      <div className="form-grid">
        <label>Provider name<input name="name" defaultValue={provider?.name || ""} required maxLength={100} placeholder="e.g. Ramesh Kumar" /></label>
        <label>Trade or service<select name="category" defaultValue={provider?.category || "Plumber"} required>
          {SERVICE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          {provider?.category && !SERVICE_CATEGORIES.includes(provider.category) && <option value={provider.category}>{provider.category} (current)</option>}
        </select></label>
        <label>Mobile number<input name="phone" type="tel" defaultValue={provider?.phone || ""} required maxLength={25} placeholder="+91 ..." /></label>
        <label>Email (optional)<input name="email" type="email" defaultValue={provider?.email || ""} maxLength={254} /></label>
        <label>Service area<input name="service_area" defaultValue={provider?.service_area || ""} required maxLength={200} placeholder="Locality or city" /></label>
        <label>Address (optional)<input name="address" defaultValue={provider?.address || ""} maxLength={500} /></label>
      </div>
      <label>Notes (optional)<textarea name="notes" defaultValue={provider?.notes || ""} maxLength={2000} placeholder="Services, working hours, or availability" /></label>
      <label className="service-provider-active"><input type="checkbox" name="is_active" defaultChecked={provider?.is_active ?? true} /> Available for referrals</label>
      <button type="submit" className={`btn ${compact ? "small" : ""}`}>{provider ? "Save contact" : "Add service provider"}</button>
    </form>
  );
}

function AgencyFeatureControl({ agency, feature, label }: { agency: Agency; feature: AgencyFeature; label: string }) {
  const enabled = agency.features[feature];
  return (
    <form action={updateAgencyFeature} className="agency-feature-control">
      <input type="hidden" name="agency_id" value={agency.id} />
      <input type="hidden" name="feature" value={feature} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <span>{label}</span>
      <span className={`badge ${enabled ? "active" : "suspended"}`}>{enabled ? "Enabled" : "Disabled"}</span>
      <SubmitButton className="btn small workspace-secondary">{enabled ? "Disable" : "Enable"}</SubmitButton>
    </form>
  );
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  const normalizedLabel = label.toLowerCase();
  const icon = normalizedLabel.includes("enquir") ? "leads" : normalizedLabel.includes("team") ? "team" : normalizedLabel.includes("agenc") ? "agencies" : "properties";
  return (
    <article className="panel dashboard-metric">
      <p className="dashboard-metric-label"><span className="metric-icon"><SidebarIcon name={icon} /></span>{label}</p>
      <strong className="dashboard-metric-value">{value}</strong>
      <p className="dashboard-metric-detail">{detail}</p>
    </article>
  );
}

function AgencyDetails({
  agency,
  editable = false,
  superAdmin = false,
  primaryContact,
}: {
  agency: Agency;
  editable?: boolean;
  superAdmin?: boolean;
  primaryContact?: Pick<User, "name" | "email">;
}) {
  const hasLocation = agency.lat !== null && agency.lng !== null;
  const mapSrc = hasLocation
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${agency.lng! - 0.015}%2C${agency.lat! - 0.015}%2C${agency.lng! + 0.015}%2C${agency.lat! + 0.015}&layer=mapnik&marker=${agency.lat}%2C${agency.lng}`
    : undefined;

  return (
    <div className="agency-details-card">
      <div className="agency-details-copy">
        {agency.logo_url && <Image className="agency-logo-preview" src={agency.logo_url} alt={`${agency.name} logo`} width={72} height={72} unoptimized />}
        <h3>{agency.name}</h3>
        {primaryContact && <p><strong>Agency login</strong><span>{primaryContact.name} · {primaryContact.email}</span></p>}
        {agency.contact_name && <p><strong>Primary contact</strong><span>{agency.contact_name}</span></p>}
        {agency.contact_email && <p><strong>Business email</strong><a href={`mailto:${agency.contact_email}`}>{agency.contact_email}</a></p>}
        <p>
          <strong>Phone</strong>
          {agency.phone
            ? <a href={`tel:${agency.phone}`}>{agency.phone}</a>
            : <span>Phone not provided</span>}
        </p>
        {agency.whatsapp && <p><strong>WhatsApp</strong><a href={`https://wa.me/${agency.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{agency.whatsapp}</a></p>}
        {agency.website && <p><strong>Website</strong><a href={agency.website} target="_blank" rel="noreferrer">{agency.website}</a></p>}
        {agency.registration_number && <p><strong>Registration / RERA</strong><span>{agency.registration_number}</span></p>}
        <p><strong>Office address</strong><span>{[agency.address, agency.city, agency.state, agency.postal_code].filter(Boolean).join(", ") || "Address not provided"}</span></p>
        {agency.service_areas && <p><strong>Service areas</strong><span>{agency.service_areas}</span></p>}
        {agency.working_hours && <p><strong>Working hours</strong><span>{agency.working_hours}</span></p>}
        {agency.description && <p><strong>About the agency</strong><span>{agency.description}</span></p>}
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
      {!editable && (mapSrc ? (
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
      ))}
      {editable && <AgencyProfileEditor agency={agency} superAdmin={superAdmin} />}
    </div>
  );
}

function SidebarIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
    agencies: <><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-5h6v5M9 9h.01M15 9h.01" /></>,
    properties: <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h14V9M9 21v-7h6v7" /></>,
    leads: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 8v6m3-3h-6" /></>,
    loans: <><path d="M3 10h18" /><path d="M5 10v10h14V10M4 20h16" /><path d="M7 6h10M9 3h6" /><path d="M9 14h6" /></>,
    tools: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h2m4 0h2M8 15h2m4 0h2" /><path d="M10 19v-2h4v2" /></>,
    team: <><path d="M16 21v-2a4 4 0 0 0-3-3.87" /><path d="M8 21v-2a4 4 0 0 1 4-4h1" /><circle cx="9" cy="7" r="4" /><path d="M18 8a4 4 0 0 1 0 8" /></>,
    services: <><path d="m14.7 6.3 3 3" /><path d="M4 20 14.7 9.3" /><path d="M12.2 5.8a5 5 0 0 0 6 6L21 14.6 17.6 18l-2.8-2.8a5 5 0 0 0-6-6L6 6.4l3.4-3.4z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.9z" transform="translate(-1 -1)" /></>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
  };

  return (
    <svg aria-hidden="true" className="dashboard-sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ message?: string; leadsPage?: string; enquiryStatus?: string; enquirySearch?: string; assignedTo?: string; propertyId?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const isSuperAdmin = user.role === "super_admin";
  const toolsEnabled = hasAgencyFeature(user, "tools");
  const homeLoansEnabled = hasAgencyFeature(user, "home_loans");
  const supabase = await createSupabaseServerClient();
  const parsedPage = Number(query.leadsPage);
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 && parsedPage <= 1_000_000 ? parsedPage : 1;
  const enquiryStatuses = ["new", "contacted", "visit", "visit scheduled", "negotiating", "closed", "lost"];
  const enquiryStatus = enquiryStatuses.includes(query.enquiryStatus || "") ? query.enquiryStatus! : "";
  const enquirySearch = (query.enquirySearch || "").trim().slice(0, 100).replace(/[,%_*()]/g, " ").trim();
  const assignedTo = /^[0-9a-f-]{36}$/i.test(query.assignedTo || "") ? query.assignedTo! : "";
  const propertyId = /^[a-zA-Z0-9-]{1,100}$/.test(query.propertyId || "") ? query.propertyId! : "";
  const sevenDaysAgo = sevenDaysAgoIso();
  const [propertyResult, leadResult, allLeadCountResult, summaryResult, staffResult, recentEnquiryResult] = await Promise.all([
    supabase.from("properties").select("*").order("created_at", { ascending: false }),
    (() => {
      let leadsQuery = supabase.from("leads")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
      if (enquiryStatus) leadsQuery = leadsQuery.eq("status", enquiryStatus);
      if (enquirySearch) leadsQuery = leadsQuery.ilike("name", `%${enquirySearch}%`);
      if (assignedTo) leadsQuery = leadsQuery.eq("assigned_to", assignedTo);
      if (propertyId) leadsQuery = leadsQuery.eq("property_id", propertyId);
      return leadsQuery.range((requestedPage - 1) * ENQUIRIES_PER_PAGE, requestedPage * ENQUIRIES_PER_PAGE - 1);
    })(),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.rpc("realty_dashboard_summary", {}),
    supabase.from("profiles").select("id,name,email,role,agency_id,is_active").neq("role", "super_admin").order("name"),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
  ]);
  const serviceProviderResult = toolsEnabled
    ? await supabase.from("service_providers").select("*").order("category").order("name")
    : null;
  const rawProperties = supabaseData(propertyResult.data, propertyResult.error, "Unable to load properties");
  const rawLeads = supabaseData(leadResult.data, leadResult.error, "Unable to load enquiries");
  const rawServiceProviders: ServiceProvider[] = serviceProviderResult
    ? supabaseData(serviceProviderResult.data, serviceProviderResult.error, "Unable to load service providers. Apply sql/migrations/20261103_service_provider_directory.sql.")
    : [];
  const summary = supabaseData(summaryResult.data, summaryResult.error, "Unable to load dashboard summary. Apply sql/migrations/20261101_dashboard_summary.sql")?.[0];
  if (!summary || leadResult.count === null || allLeadCountResult.count === null) throw new Error("Unable to load dashboard counts.");
  if (recentEnquiryResult.error) throw new Error("Unable to load recent enquiry counts.");
  const recentEnquiryCount = recentEnquiryResult.count ?? 0;
  const filteredLeadCount = leadResult.count;
  const totalLeadCount = allLeadCountResult.count;
  const activeLeads = summary.open_leads;
  const totalLeadPages = Math.max(1, Math.ceil(filteredLeadCount / ENQUIRIES_PER_PAGE));
  if (requestedPage > totalLeadPages) {
    redirect(`/dashboard?leadsPage=${totalLeadPages}&enquiryStatus=${encodeURIComponent(enquiryStatus)}&enquirySearch=${encodeURIComponent(enquirySearch)}&assignedTo=${encodeURIComponent(assignedTo)}&propertyId=${encodeURIComponent(propertyId)}#leads`);
  }
  const staff: User[] = supabaseData(staffResult.data, staffResult.error, "Unable to load agency users");
  const agencyAdminsById = new Map<string, User>();
  for (const member of staff) {
    if (member.role === "agency_admin" && member.agency_id && !agencyAdminsById.has(member.agency_id)) {
      agencyAdminsById.set(member.agency_id, member);
    }
  }
  let agencies: Agency[] = [];
  let agencyDetails: Agency | undefined;
  if (isSuperAdmin) {
    const agencyResult = await supabase.from("agencies").select("*").order("created_at", { ascending: false });
    const agencyRows = supabaseData(agencyResult.data, agencyResult.error, "Unable to load agencies");
    agencies = await Promise.all(agencyRows.map(async (agency) => {
      const [leadCount, openLeadCount, closedLeadCount] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("agency_id", agency.id),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).not("status", "in", "(closed,lost)"),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("agency_id", agency.id).eq("status", "closed"),
      ]);
      if (leadCount.error || openLeadCount.error || closedLeadCount.error) {
        throw new Error("Unable to load agency enquiry totals.");
      }
      const total = leadCount.count ?? 0;
      const open = openLeadCount.count ?? 0;
      const closed = closedLeadCount.count ?? 0;
      return {
        ...agency,
        user_count: staff.filter((member) => member.agency_id === agency.id).length,
        property_count: rawProperties.filter((property) => property.agency_id === agency.id).length,
        lead_count: total,
        open_lead_count: open,
        closed_lead_count: closed,
        lost_lead_count: Math.max(0, total - open - closed),
        activity_count: 0,
      };
    }));
  } else if (user.agency_id) {
    const { data, error } = await supabase.from("agencies").select("*").eq("id", user.agency_id).maybeSingle();
    const agency = supabaseData(data, error, "Unable to load your agency profile");
    agencyDetails = {
      ...agency,
      user_count: staff.filter((member) => member.agency_id === agency.id).length,
      property_count: 0,
      lead_count: totalLeadCount,
      open_lead_count: activeLeads,
      closed_lead_count: 0,
      lost_lead_count: 0,
      activity_count: 0,
    };
  }
  const agenciesById = new Map(agencies.map((agency) => [agency.id, agency.name]));
  const properties: DashboardProperty[] = rawProperties.map((property) => ({
    ...property,
    agency_name: agenciesById.get(property.agency_id) || agencyDetails?.name,
  }));
  const staffById = new Map(staff.map((member) => [member.id, member.name]));
  const propertyTitleById = new Map(rawProperties.map((property) => [property.id, property.title]));
  const leads: DashboardLead[] = rawLeads.map((lead) => ({
    ...lead,
    agency_name: agenciesById.get(lead.agency_id) || agencyDetails?.name,
    property_title: lead.property_id ? propertyTitleById.get(lead.property_id) : undefined,
    assignee_name: lead.assigned_to ? staffById.get(lead.assigned_to) : undefined,
  }));
  const serviceProviders: DashboardServiceProvider[] = rawServiceProviders.map((provider) => ({
    ...provider,
    agency_name: agenciesById.get(provider.agency_id) || agencyDetails?.name,
  }));
  const agencyName = agencyDetails?.name;
  const pendingProperties = summary.pending;
  const pendingAgencies = summary.pending_agencies;
  const newEnquiriesDetail = recentEnquiryCount === 0 ? "No new enquiries in the last seven days" : "Submitted in the last seven days";
  const navigation = [
    { label: "Overview", href: "#overview", icon: "overview" },
    { label: "Properties", href: "#inventory", icon: "properties", count: isSuperAdmin ? pendingProperties : undefined },
    { label: "Enquiries", href: "#leads", icon: "leads", count: activeLeads },
    ...(homeLoansEnabled ? [{ label: "Home loans", href: "/dashboard/home-loans", icon: "loans" }] : []),
    { label: "Team", href: "#team", icon: "team" },
    ...(toolsEnabled ? [
      { label: "Tools", href: "/dashboard/tools", icon: "tools" },
      { label: "Service providers", href: "#services", icon: "services" },
    ] : []),
    { label: "Settings", href: isSuperAdmin ? "#agencies" : "#agency-details", icon: "settings" },
  ];

  return (
    <WorkspaceShell theme={isSuperAdmin ? "platform" : "agency"} allowedViews={isSuperAdmin ? ["overview", "agencies", "inventory", "leads", "team", "services"] : ["overview", "agency-details", "inventory", "leads", ...(toolsEnabled ? ["services"] : []), "team"]}>
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
            item.href.startsWith("/") ? (
              <Link href={item.href} key={item.href}>
                <SidebarIcon name={item.icon} />
                <span>{item.label}</span>
                {item.count ? <small>{item.count}</small> : null}
              </Link>
            ) : (
              <WorkspaceNavLink href={item.href} key={item.href}>
                <SidebarIcon name={item.icon} />
                <span>{item.label}</span>
                {item.count ? <small>{item.count}</small> : null}
              </WorkspaceNavLink>
            )
          ))}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <Link className="dashboard-sidebar-add" href="/dashboard/properties/new"><span>+</span>Add property</Link>
          <Link className="dashboard-sidebar-public" href="/">View public website</Link>
          <form action={logout}>
            <button className="dashboard-sidebar-signout" type="submit">
              <SidebarIcon name="logout" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="dashboard-main">
        <main className={`workspace dashboard ${isSuperAdmin ? "platform-dashboard-page" : "agency-dashboard-page"}`}>
        <header className="workspace-topbar">
          <div><span className="workspace-status-dot" /> {isSuperAdmin ? "Platform control center" : "Agency workspace"}</div>
          <details className="dashboard-user-menu">
            <summary aria-label={`Account menu for ${user.name}`}>
              <span className="dashboard-user-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span>
              <span className="dashboard-user-copy"><strong>{user.name}</strong><small>{isSuperAdmin ? "Administrator" : agencyName || "Agency workspace"}</small></span>
              <span className="dashboard-user-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="dashboard-user-menu-panel">
              <strong>{user.name}</strong><small>{user.email}</small>
              <form action={logout}><button className="dashboard-topbar-signout" type="submit">Sign out</button></form>
            </div>
          </details>
        </header>
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
                ? "Manage agency profiles, listings, enquiries, teams, and account access across the platform."
                : `${agencyName || "Your agency"} · Manage your listings, customer enquiries, and team in one place.`}
            </p>
          </div>
          <div className="hero-actions"><Link className="btn workspace-secondary" href="/dashboard/leads/new">+ Add enquiry</Link><Link className="btn" href="/dashboard/properties/new">+ Add property</Link></div>
        </section>



        <section aria-label="Dashboard summary" className="dashboard-metrics">
          <Metric label="Listings" value={summary.property_total} detail={summary.property_total ? `${summary.published} published · ${pendingProperties} pending` : "Add your first listing to get started"} />
          <Metric label="Active / sold" value={`${summary.published} / ${summary.sold}`} detail="Published listings and completed sales" />
          <Metric label="New enquiries (7d)" value={recentEnquiryCount} detail={newEnquiriesDetail} />
          <Metric label="Team" value={summary.team_count} detail={summary.team_count ? "People in your workspace" : "Invite your first teammate"} />
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
        {!isSuperAdmin && agencyDetails && <AgencyLeadQr agencyId={agencyDetails.id} agencyName={agencyDetails.name} />}
        <article className="panel workspace-get-started"><div><p className="kicker">{isSuperAdmin ? "BUILT FOR YOUR PLATFORM" : "MAKE YOUR NEXT MOVE"}</p><h2>{isSuperAdmin ? "Every workspace. One clear view." : "More time for clients. Less time searching."}</h2><p className="muted">{isSuperAdmin ? "Use the navigation to manage agencies, properties, customer enquiries and account access separately." : "Add a listing, record a customer enquiry, or update your business profile. Each task has its own space."}</p></div><div><Link className="btn" href="/dashboard/properties/new">+ Create listing</Link><Link className="btn workspace-secondary" href="/dashboard/leads/new">+ Add enquiry</Link></div></article>
        </WorkspaceSection>

        {!isSuperAdmin && agencyDetails && (
          <WorkspaceSection id="agency-details" className="dashboard-section agency-profile-section">
            <div className="dashboard-section-heading">
              <div>
                <p className="kicker">YOUR BUSINESS PROFILE</p>
                <h2>Agency details</h2>
              </div>
              <div className="property-page-actions">
                <a className="btn small workspace-secondary" href="#services">Service providers</a>
                <span className={`badge ${agencyDetails.status}`}>{agencyDetails.status}</span>
              </div>
            </div>
            <AgencyDetails agency={agencyDetails} editable={user.role === "agency_admin"} primaryContact={agencyAdminsById.get(agencyDetails.id)} />
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
            {agencies.some((agency) => agency.status === "pending") && <section className="panel agency-approval-queue" aria-label="Pending agency approvals">
              <div><p className="kicker">REVIEW REQUIRED</p><h3>Agency approval queue</h3><p className="muted">New registrations stay locked until approved.</p></div>
              {agencies.filter((agency) => agency.status === "pending").map((agency) => <div className="agency-approval-item" key={agency.id}>
                <span><strong>{agency.name}</strong><small>{agency.contact_email || agency.phone || "Contact details not provided"}</small></span>
                <div className="agency-approval-actions"><form action={setAgencyStatus}><input type="hidden" name="agency_id" value={agency.id} /><input type="hidden" name="status" value="active" /><SubmitButton className="btn small">Approve</SubmitButton></form><form action={setAgencyStatus}><input type="hidden" name="agency_id" value={agency.id} /><input type="hidden" name="status" value="suspended" /><SubmitButton className="btn small workspace-secondary">Decline</SubmitButton></form></div>
              </div>)}
            </section>}
            <div className="panel dashboard-list">
              <SearchableCollection label="Find an agency" items={agencies.map((agency) => ({ id: agency.id, search: `${agency.name} ${agency.phone} ${agency.status}`, content: (
                <details className="agency-row workspace-agency" key={agency.id}><summary><span className="workspace-agency-avatar">{agency.name.slice(0, 1).toUpperCase()}</span><span><strong>{agency.name}</strong><small>{agency.user_count} people · {agency.property_count} properties · {agency.lead_count} leads ({agency.open_lead_count} open, {agency.closed_lead_count} closed, {agency.lost_lead_count} lost)</small></span><span className={`badge ${agency.status}`}>{agency.status}</span><span className="workspace-expand">Manage ↗</span></summary>
                  <div className="dashboard-agency-detail">
                    <AgencyDetails agency={agency} editable superAdmin primaryContact={agencyAdminsById.get(agency.id)} />
                      <section className="panel agency-feature-controls" aria-label={`${agency.name} feature access`}>
                        <h3>Feature access</h3>
                        <AgencyFeatureControl agency={agency} feature="home_loans" label="Home loans" />
                        <AgencyFeatureControl agency={agency} feature="tools" label="Tools (service providers)" />
                      </section>
                    <section className="panel dashboard-agency-properties" aria-label={`${agency.name} properties`}>
                      <div className="workspace-card-heading"><div><p className="kicker">AGENCY INVENTORY</p><h3>{agency.name} properties</h3></div></div>
                      {rawProperties.filter((property) => property.agency_id === agency.id).length > 0 ? (
                        <ul>{rawProperties.filter((property) => property.agency_id === agency.id).slice(0, 8).map((property) => (
                          <li key={property.id}><span><Link href={`/dashboard/properties/${property.id}`}>{property.title}</Link><small>{property.locality}, {property.city}</small></span><span className={`badge ${property.status}`}>{property.status}</span></li>
                        ))}</ul>
                      ) : <p className="empty">This agency has no properties yet.</p>}
                    </section>
                    <div className="dashboard-row-end">
                      <span className={`badge ${agency.status}`}>{agency.status}</span>
                      <span className="muted">{agency.user_count} users · {agency.property_count} listings</span>
                      <form action={setAgencyStatus}>
                        <input type="hidden" name="agency_id" value={agency.id} />
                        <input type="hidden" name="status" value={agency.status === "active" ? "suspended" : "active"} />
                        <SubmitButton className="btn small" pendingLabel="Updating access…">
                          {agency.status === "pending" ? "Approve agency" : agency.status === "suspended" ? "Reactivate agency" : "Suspend agency"}
                        </SubmitButton>
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
            <div className="property-page-actions">
              <Link className="btn small workspace-secondary" href="/dashboard/import?kind=properties">Import Excel</Link>
              {isSuperAdmin
                ? <Link className="btn small" href="/dashboard/properties/new">+ Add agency property</Link>
                : <Link className="btn small" href="/dashboard/properties">Open my property workspace →</Link>}
            </div>
          </div>
          <PropertyTable properties={properties} isAdmin={isSuperAdmin} />
        </WorkspaceSection>

        <WorkspaceSection id="leads" className="dashboard-section">
          <div className="dashboard-section-heading dashboard-section-heading-action">
            <div>
              <p className="kicker">CUSTOMER RELATIONSHIPS</p>
              <h2>Customer enquiries</h2>
            </div>
            <div className="property-page-actions">
              <Link className="btn small workspace-secondary" href="/dashboard/import?kind=leads">Import enquiries</Link>
              <Link className="btn small" href="/dashboard/leads/new">+ Add customer</Link>
            </div>
          </div>
          <form className="enquiry-filters" method="get" action="/dashboard#leads">
            <input type="hidden" name="leadsPage" value="1" />
            <label>Search name<input name="enquirySearch" defaultValue={enquirySearch} maxLength={100} placeholder="Customer name" /></label>
            <label>Status<select name="enquiryStatus" defaultValue={enquiryStatus}><option value="">All statuses</option>{enquiryStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Assignee<select name="assignedTo" defaultValue={assignedTo}><option value="">Anyone</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label>Property<select name="propertyId" defaultValue={propertyId}><option value="">All properties</option>{rawProperties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
            <button className="btn small">Apply filters</button>
          </form>
          {leads.length > 0 ? (
            <EnquiriesTable leads={leads} assignees={staff.map((member) => ({ id: member.id, name: member.name, agency_id: member.agency_id }))} properties={rawProperties.map((property) => ({ id: property.id, title: property.title, agency_id: property.agency_id }))} homeLoansEnabled={homeLoansEnabled} />
          ) : (
            <div className="empty panel dashboard-empty-state">
              <span className="metric-icon"><SidebarIcon name="leads" /></span>
              <h3>{totalLeadCount ? "No enquiries match these filters" : "No enquiries yet"}</h3>
              <p>{totalLeadCount ? "Try a different filter." : "New customer enquiries will appear here when someone contacts your workspace."}</p>
              <Link className="btn workspace-secondary" href="/dashboard/leads/new">Add an enquiry</Link>
            </div>
          )}
          {filteredLeadCount > 0 && (
            <nav className={enquiryStyles.enquiryPagination} aria-label="Customer enquiry pages">
              <span className={enquiryStyles.enquiryPaginationSummary}>
                Showing {(requestedPage - 1) * ENQUIRIES_PER_PAGE + 1}–{Math.min(requestedPage * ENQUIRIES_PER_PAGE, filteredLeadCount)} of {filteredLeadCount}
              </span>
              <div className={enquiryStyles.enquiryPaginationControls}>
                {requestedPage > 1
                  ? <Link href={`/dashboard?leadsPage=${requestedPage - 1}&enquiryStatus=${encodeURIComponent(enquiryStatus)}&enquirySearch=${encodeURIComponent(enquirySearch)}&assignedTo=${encodeURIComponent(assignedTo)}&propertyId=${encodeURIComponent(propertyId)}#leads`}>← Previous</Link>
                  : <span aria-disabled="true">Previous</span>}
                <strong>{requestedPage} <span>/</span> {totalLeadPages}</strong>
                {requestedPage < totalLeadPages
                  ? <Link href={`/dashboard?leadsPage=${requestedPage + 1}&enquiryStatus=${encodeURIComponent(enquiryStatus)}&enquirySearch=${encodeURIComponent(enquirySearch)}&assignedTo=${encodeURIComponent(assignedTo)}&propertyId=${encodeURIComponent(propertyId)}#leads`}>Next →</Link>
                  : <span aria-disabled="true">Next</span>}
              </div>
            </nav>
          )}
        </WorkspaceSection>

        {toolsEnabled && <WorkspaceSection id="services" className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="kicker">LOCAL SERVICE DIRECTORY</p>
              <h2>Service providers</h2>
            </div>
              <p className="muted">Keep plumbers, electricians, painters, and any other trusted local service contacts together. These stay separate from customer enquiries.</p>
          </div>
          <div className="detail-columns service-provider-layout">
            <div className="panel dashboard-list service-provider-list">
              <SearchableCollection
                label="Find a provider"
                placeholder="Search name, trade, area, phone, or agency"
                items={serviceProviders.map((provider) => ({
                  id: provider.id,
                  search: `${provider.name} ${provider.category} ${provider.phone} ${provider.email} ${provider.service_area} ${provider.address} ${provider.notes} ${provider.agency_name || ""} ${provider.is_active ? "available" : "unavailable"}`,
                  content: (
                    <article className="service-provider-card" key={provider.id}>
                      <div className="service-provider-card-heading">
                        <div><span className="service-provider-category">{provider.category}</span><h3>{provider.name}</h3></div>
                        <span className={`service-provider-status ${provider.is_active ? "is-active" : "is-inactive"}`}>{provider.is_active ? "Available" : "Inactive"}</span>
                      </div>
                      {isSuperAdmin && <p className="service-provider-agency">{provider.agency_name || "Agency"}</p>}
                      <p className="service-provider-area"><strong>Service area</strong> {provider.service_area}</p>
                      {provider.address && <p className="service-provider-address"><strong>Address</strong> {provider.address}</p>}
                      {provider.notes && <p className="service-provider-notes">{provider.notes}</p>}
                      <div className="service-provider-actions"><a href={`tel:${provider.phone}`}>Call {provider.phone}</a>{provider.email && <a href={`mailto:${provider.email}`}>Email provider</a>}</div>
                      <details className="service-provider-edit"><summary>Edit contact</summary>
                        <ServiceProviderForm agencies={agencies} provider={provider} superAdmin={isSuperAdmin} compact />
                      </details>
                      <form action={deleteServiceProvider} className="service-provider-delete">
                        <input type="hidden" name="id" value={provider.id} />
                        <ConfirmDeleteButton confirmMessage={`Remove ${provider.name} from the service directory? This cannot be undone.`}>Remove contact</ConfirmDeleteButton>
                      </form>
                    </article>
                  ),
                }))}
              />
            </div>
            <div className="service-provider-create">
              <div><p className="kicker">ADD A LOCAL CONTACT</p><h3>New service provider</h3><p className="muted">Keep useful tradespeople easy to find for your team.</p></div>
              <ServiceProviderForm agencies={agencies} agencyId={user.agency_id || undefined} superAdmin={isSuperAdmin} />
            </div>
          </div>
        </WorkspaceSection>}

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
                    <span className={`badge ${member.is_active ? "active" : "suspended"}`}>{member.is_active ? "Active" : "Deactivated"}</span>
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
                      <SubmitButton className="btn small">Save team member</SubmitButton>
                    </form></details>}
                    {(isSuperAdmin || (user.role === "agency_admin" && member.role === "agent")) && member.id !== user.id && <form action={setStaffActive}>
                      <input type="hidden" name="id" value={member.id} /><input type="hidden" name="is_active" value={member.is_active ? "false" : "true"} />
                      <SubmitButton className="btn small workspace-secondary">{member.is_active ? "Deactivate" : "Reactivate"}</SubmitButton>
                    </form>}
                  </div>
                </div>
              ) }))} />
            </div>
            {(user.role === "agency_admin" || isSuperAdmin) && (
              <form action={addStaff} className="panel stack dashboard-add-staff">
                <div>
                  <p className="kicker">{isSuperAdmin ? "WORKSPACE ACCESS" : "GROW YOUR TEAM"}</p>
                  <h3>{isSuperAdmin ? "Invite an agency user" : "Invite an agent"}</h3>
                </div>
                {isSuperAdmin && <label>Agency<select name="agency_id" required defaultValue=""><option value="" disabled>Select agency</option>{agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name} · {agency.status}</option>)}</select></label>}
                <label>Name<input name="name" required maxLength={100} /></label>
                <label>Email<input name="email" type="email" required /></label>
                {isSuperAdmin && <label>Role<select name="role" defaultValue="agent"><option value="agent">Agent</option><option value="agency_admin">Agency admin</option></select></label>}
                {!isSuperAdmin && <input type="hidden" name="role" value="agent" />}
                <SubmitButton className="btn" pendingLabel="Sending invite…">Send email invite</SubmitButton>
              </form>
            )}
          </div>
        </WorkspaceSection>

        </main>
      </div>
    </WorkspaceShell>
  );
}
