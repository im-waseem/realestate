import styles from "@/components/dashboard/workspace.module.css";

export default function DashboardLoading() {
  return (
    <div className={`dashboard-shell workspace-redesign ${styles.shell}`} aria-busy="true">
      <aside className="dashboard-sidebar" aria-hidden="true">
        <div className="dashboard-sidebar-brand"><span className="dashboard-sidebar-brandmark">W</span><span className="dashboard-sidebar-brandtext">WASEEM REALTY<small>WORKSPACE</small></span></div>
        <nav className="dashboard-sidebar-nav" aria-label="Loading navigation">
          {["Overview", "Properties", "Enquiries", "Team", "Settings"].map((item) => <span className={styles.skeletonNavItem} key={item} />)}
        </nav>
      </aside>
      <div className="dashboard-main">
        <main className="workspace dashboard">
          <header className="workspace-topbar">
            <p className="muted" role="status">Loading your workspace…</p>
            <span className={styles.skeletonUser} aria-hidden="true" />
          </header>
          <section className="dashboard-metrics" aria-label="Loading dashboard summary">
            {[1, 2, 3, 4].map((item) => <div className={`panel ${styles.skeletonMetric}`} key={item}><span /><strong /><small /></div>)}
          </section>
          <section className={styles.skeletonLower} aria-hidden="true"><div className="panel" /><div className="panel" /></section>
        </main>
      </div>
    </div>
  );
}
