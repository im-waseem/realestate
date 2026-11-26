import Link from "next/link";

export function AdminAnalyticsPanel() {
  return (
    <section className="panel" aria-labelledby="admin-analytics-title">
      <div className="workspace-card-heading">
        <div>
          <p className="kicker">VERCEL WEB ANALYTICS</p>
          <h3 id="admin-analytics-title">Traffic reports</h3>
        </div>
      </div>
      <p className="muted">
        Visit counts and popular routes are available in the Analytics tab for this project in Vercel.
        The site is configured to collect Web Analytics when deployed.
      </p>
      <Link
        className="btn workspace-secondary"
        href="https://vercel.com/dashboard"
        target="_blank"
        rel="noreferrer"
      >
        Open Vercel dashboard
      </Link>
    </section>
  );
}
