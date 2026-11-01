import { register } from "@/app/actions";
import { PlatformHeader,Notice } from "@/components/platform";

export default async function Register({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const query = await searchParams;

  return (
    <>
      <PlatformHeader />
      <main className="auth-wrap">
        <div className="auth-intro">
          <p className="kicker">GROW WITH WASEEM REALTY</p>
          <h1>Your agency.<br /><em>One workspace.</em></h1>
          <p>List homes, manage enquiries, and keep your team connected.</p>
        </div>
        <section className="panel auth-panel">
          <h2>Register your agency</h2>
          <p className="muted">Your request will be reviewed by the main admin before workspace access is enabled.</p>
          <Notice message={query.message} />
          <form action={register} className="stack">
            <label>Your name<input name="name" required maxLength={100} /></label>
            <label>Agency name<input name="agency" required maxLength={150} /></label>
            <label>Agency phone<input name="phone" type="tel" required maxLength={25} /></label>
            <label>Office address<input name="address" required maxLength={500} /></label>
            <p className="muted">Optional: enter map coordinates to show your agency location in the private dashboard.</p>
            <div className="form-grid">
              <label>Latitude<input name="lat" type="number" min="-90" max="90" step="any" /></label>
              <label>Longitude<input name="lng" type="number" min="-180" max="180" step="any" /></label>
            </div>
            <label>Work email<input name="email" type="email" required maxLength={254} /></label>
            <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><small>At least 12 characters.</small></label>
            <button className="btn">Submit for approval →</button>
          </form>
        </section>
      </main>
    </>
  );
}
