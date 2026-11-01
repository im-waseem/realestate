"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions";

export type Home = {
  id: string; name: string; location: string; price: number;
  beds: number; baths: number; area: number; image: string | null; type: string;
  intent?: string; status?: string; workspaceHref?: string;
  floorNumber: number; totalFloors: number | null; carParking: number; twoWheelerParking: number;
};
type IconName = "arrow" | "search" | "pin" | "heart" | "menu" | "close" | "home" | "check" | "bed" | "area";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    heart: <path d="M20 9c0 4.5-8 10-8 10S4 13.5 4 9a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 9Z" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    home: <><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    bed: <><path d="M3 18v-7h18v7M3 15h18M5 11V6h14v5M8 8h3m2 0h3" /></>,
    area: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 4l6 6m10 10-6-6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

function PropertyCard({ home, agencyWorkspace = false }: { home: Home; agencyWorkspace?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const href = home.workspaceHref || `/properties/${home.id}`;
  return (
    <article className="home-card">
      <div className="home-card-visual">
        <Link href={href} className="home-card-image" aria-label={`${agencyWorkspace ? "Manage" : "View"} ${home.name}`}>
          {home.image && !imageFailed ? <Image src={home.image} alt={home.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw" unoptimized onError={() => setImageFailed(true)} /> : <span className="photo-unavailable"><Icon name="home" size={36} /><span>Photos coming soon</span></span>}
        </Link>
        <span className="home-card-tag">{agencyWorkspace ? home.status : "For sale"}</span>
      </div>
      <div className="home-card-body">
        <p className="home-card-price">{money(home.price)}</p>
        <h3><Link href={href}>{home.name}</Link></h3>
        <p className="home-card-location"><Icon name="pin" size={16} />{home.location}</p>
        <div className="home-card-specs"><span><Icon name="bed" size={17} />{home.beds} beds</span><span>{home.baths} baths</span><span><Icon name="area" size={16} />{home.area.toLocaleString("en-IN")} sq ft</span></div>
        <p className="home-card-extra">
          {agencyWorkspace ? `${home.intent} · ` : ""}{home.type} · {home.floorNumber === 0 ? "Ground floor" : `Floor ${home.floorNumber}`}
          {home.totalFloors ? ` of ${home.totalFloors}` : ""}
          · {home.carParking} car · {home.twoWheelerParking} two-wheeler parking
        </p>
      </div>
    </article>
  );
}

export default function HomeClient({
  homes,
  year,
  agencyName,
  agencyPhone,
  agencyAddress,
  canEditAgency = false,
}: {
  homes: Home[];
  year: number;
  agencyName?: string;
  agencyPhone?: string;
  agencyAddress?: string;
  canEditAgency?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const visible = homes.slice(0, 6);

  useEffect(() => {
    const root = pageRef.current;
    if (!root || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } });
    }, { threshold: 0.1 });
    root.querySelectorAll("[data-reveal]").forEach(element => observer.observe(element));
    root.classList.add("motion-ready");
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <div className="realty-home" ref={pageRef} id="top">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="home-header">
        <Link href="/" className="home-brand" aria-label={`${agencyName || "Waseem Realty"} home`}><span className="home-monogram">{agencyName ? `${agencyName.trim().slice(0, 1).toLowerCase()}.` : "w."}</span><span>{agencyName || "WASEEM"}<small>{agencyName ? "AGENCY WORKSPACE" : "REALTY"}</small></span></Link>
        <nav id="home-navigation" className={`home-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
          {agencyName ? (
            <>
              <Link href="/dashboard" onClick={() => setMenuOpen(false)}>Workspace</Link>
              <Link href="/dashboard/properties" onClick={() => setMenuOpen(false)}>My properties</Link>
              <Link href="/dashboard/properties/new" onClick={() => setMenuOpen(false)}>Add property</Link>
            </>
          ) : (
            <>
              <Link href="/properties" onClick={() => setMenuOpen(false)}>Homes for sale</Link>
              <a href="#our-approach" onClick={() => setMenuOpen(false)}>Our approach</a>
              <Link href="/register" className="nav-agencies" onClick={() => setMenuOpen(false)}>For agencies <Icon name="arrow" size={15} /></Link>
            </>
          )}
        </nav>
        <div className="home-header-actions">
          {agencyName
            ? <form action={logout}><button className="home-sign-in" type="submit">Sign out</button></form>
            : <Link href="/login" className="home-sign-in">Sign in <Icon name="arrow" size={16} /></Link>}
          <button ref={menuButton} type="button" className="home-menu-button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="home-navigation" onClick={() => setMenuOpen(value => !value)}><Icon name={menuOpen ? "close" : "menu"} /></button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="home-hero" aria-labelledby="hero-title">
          <div className="home-hero-copy">
            <p className="home-eyebrow"><span />A PLACE FOR YOUR NEXT CHAPTER</p>
            <h1 id="hero-title">{agencyName ? <>Your agency.<br />Your properties.<br /><em>Your workspace.</em></> : <>Good spaces.<br />Better living.<br /><em>Your next home.</em></>}</h1>
            <p className="home-hero-description">{agencyName ? `Welcome to ${agencyName}. Manage your property listings and agency details from one place.` : "More than an address. Find a space for slow mornings, new beginnings, and everything that makes life yours."}</p>
            <a href="#discover" className="home-link">{agencyName ? "View your properties" : "Discover your possibilities"} <Icon name="arrow" size={19} /></a>
            <div className="hero-detail"><span className="hero-detail-icon"><Icon name="home" size={22} /></span><p>{agencyName ? "Your listings.<br />" : <>For the way you live.<br /></>}<strong>{agencyName ? "Your agency workspace." : "For the life you’re building."}</strong></p></div>
          </div>
          <div className="home-hero-visual">
            <Image src="/images/architecture.jpg" alt="Light-filled contemporary home opening onto a landscaped courtyard" fill preload sizes="(max-width: 800px) 100vw, 55vw" className="hero-architecture" />
            <div className="hero-image-shade" />
            <span className="hero-photo-label">THE ART OF FEELING AT HOME</span>
            <div className="hero-caption"><span className="hero-caption-star" aria-hidden="true">✳</span><p>Room for<br /><em>what matters.</em></p></div>
            <span className="hero-photo-credit">A little inspiration for your next chapter.</span>
          </div>
        </section>

        {!agencyName && <div className="home-search-wrap">
          <form className="home-search" action="/properties" method="get" aria-label="Find a property">
            <input type="hidden" name="intent" value="sale" />
            <label className="home-search-field"><span>YOUR NEIGHBOURHOOD</span><span className="home-search-input"><Icon name="pin" size={19} /><input name="q" type="search" placeholder="City or locality" maxLength={100} /></span></label>
            <label className="home-search-field home-bedrooms"><span>ROOM TO GROW</span><select name="beds" defaultValue=""><option value="">Any bedrooms</option>{[1, 2, 3, 4, 5].map(number => <option key={number} value={number}>{number}+ bedrooms</option>)}</select></label>
            <button className="home-button" type="submit"><Icon name="search" size={18} />Find a home</button>
          </form>
          <div className="home-assurances"><span><Icon name="check" size={15} />Agency-managed listings</span><span><Icon name="check" size={15} />Private agency workspaces</span><span><Icon name="check" size={15} />Secure team access</span></div>
        </div>}

        {agencyName ? (
          <section id="discover" className="home-section discover-section" aria-labelledby="discover-heading" data-reveal>
            <div className="home-section-heading"><div><p className="home-eyebrow">PRIVATE PROPERTY WORKSPACES</p><h2 id="discover-heading">Every agency, its own listings.</h2><p>{agencyName} properties are private to your agency. Select a listing to manage it.</p></div><Link href="/dashboard/properties" className="home-link">Manage all properties <Icon name="arrow" size={19} /></Link></div>
            {visible.length ? <div className="home-property-grid">{visible.map(home => <PropertyCard key={home.id} home={home} agencyWorkspace />)}</div> : <div className="home-empty"><span className="home-empty-icon"><Icon name="home" size={30} /></span><h3>No properties yet.</h3><p>Add your agency&apos;s first property to see it here.</p><Link href="/dashboard/properties/new" className="home-button home-button-outline">Add a property <Icon name="arrow" size={18} /></Link></div>}
          </section>
        ) : null}

        {agencyName ? (
          <section className="home-section home-agency-contact" aria-labelledby="agency-contact-heading">
            <div className="home-section-heading">
              <div>
                <p className="home-eyebrow">YOUR AGENCY PROFILE</p>
                <h2 id="agency-contact-heading">{agencyName}</h2>
                <p>Agency contact details shown only in this signed-in workspace.</p>
              </div>
              {canEditAgency && <Link className="home-link" href="/dashboard#agency-details">Update agency details <Icon name="arrow" size={19} /></Link>}
            </div>
            <div className="panel agency-details-copy">
              <p><strong>Phone</strong>{agencyPhone ? <a href={`tel:${agencyPhone}`}>{agencyPhone}</a> : <span>Phone not provided</span>}</p>
              <p><strong>Office</strong><span>{agencyAddress || "Address not provided"}</span></p>
            </div>
          </section>
        ) : (
          <section id="our-approach" className="home-approach" aria-labelledby="approach-heading">
          <div className="approach-visual"><Image src="/images/interior.jpg" alt="Warm neutral living room with natural materials and a sunlit seating area" fill sizes="(max-width: 800px) 100vw, 50vw" /><span className="approach-image-note">A home should feel like <em>you.</em></span></div>
          <div className="approach-copy" data-reveal><p className="home-eyebrow">REAL ESTATE. A LITTLE MORE HUMAN.</p><h2 id="approach-heading">A big decision.<br /><em>A thoughtful approach.</em></h2><p>A home is where your everyday life happens. We make it easier to explore your options, understand the details, and take the next step with a local agency.</p><div className="approach-points"><div><span>01</span><p><strong>Start with what matters.</strong>Find a place around your location, space, and budget.</p></div><div><span>02</span><p><strong>Look a little closer.</strong>Explore photos, property details, and the neighbourhood.</p></div><div><span>03</span><p><strong>Make a real connection.</strong>Send an enquiry directly to the listing agency.</p></div></div><Link href="/properties" className="home-link">Let&apos;s find your place <Icon name="arrow" size={19} /></Link></div>
          </section>
        )}

        {!agencyName && <section className="home-section home-paths" aria-labelledby="paths-heading" data-reveal><div className="home-section-heading"><div><p className="home-eyebrow">WHERE WOULD YOU LIKE TO BEGIN?</p><h2 id="paths-heading">Every move has a story.</h2></div><p>Let&apos;s make room for yours.</p></div><div className="home-path-grid">{[{ number: "01", title: "A home to call your own.", text: "Find a space to put down roots and make your own.", href: "/properties", action: "Explore homes for sale", icon: "home" }, { number: "02", title: "Know the details before you visit.", text: "Explore photos, property details, and the neighbourhood.", href: "/properties", action: "Browse sale listings", icon: "pin" }, { number: "03", title: "Your agency. More possibility.", text: "Bring your listings, your team, and your customers together.", href: "/register", action: "Register your agency", icon: "area" }].map(path => <Link href={path.href} className="home-path-card" key={path.number}><div className="path-card-top"><Icon name={path.icon as IconName} size={27} /><span>{path.number}</span></div><h3>{path.title}</h3><p>{path.text}</p><span className="path-card-action">{path.action}<Icon name="arrow" size={19} /></span></Link>)}</div></section>}

        {!agencyName && <section className="home-contact" aria-labelledby="contact-heading"><div className="home-contact-inner" data-reveal><span className="contact-star" aria-hidden="true">✳</span><p className="home-eyebrow">GOOD HOMES. GOOD PEOPLE.</p><h2 id="contact-heading">Your next chapter<br />starts with <em>a hello.</em></h2><p>Tell us what you have in mind.<br />We&apos;ll help you find where to begin.</p><a className="home-button home-button-cream" href="mailto:waseemakram060396@gmail.com">Let&apos;s talk about home <Icon name="arrow" size={19} /></a></div></section>}

        {!agencyName && <section className="home-section home-faq" aria-labelledby="faq-heading" data-reveal><div><p className="home-eyebrow">A LITTLE CLARITY</p><h2 id="faq-heading">Before you<br /><em>make your move.</em></h2></div><div className="faq-list">{[{ question: "How do I arrange a property visit?", answer: "Open a home for sale and send an enquiry with your contact details and requirements. The listing agency can follow up with you to discuss availability and arrange a visit." }, { question: "Can I save homes to compare later?", answer: "Yes. Tap the heart on a property card. Your saved selections stay in this browser. The homepage shows saved homes that are still available in its latest listings." }, { question: "How can I list a property?", answer: "Register your agency, sign in to your workspace, and add your property details and photos. Sale listings are published by your agency; rent and lease listings stay inside its dashboard." }].map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>}
      </main>

      <footer className="home-footer"><div className="home-footer-top"><Link href="/" className="home-brand"><span className="home-monogram">{agencyName ? `${agencyName.trim().slice(0, 1).toLowerCase()}.` : "w."}</span><span>{agencyName || "WASEEM"}<small>{agencyName ? "AGENCY WORKSPACE" : "REALTY"}</small></span></Link><p>Thoughtful spaces.<br />New beginnings.</p><nav aria-label="Footer navigation">{agencyName ? <><Link href="/dashboard">Workspace</Link><Link href="/dashboard/properties">My properties</Link><Link href="/dashboard/properties/new">Add property</Link></> : <><Link href="/properties">Explore properties</Link><Link href="/register">For agencies</Link><Link href="/dashboard">Agency workspace</Link></>}<a href="mailto:waseemakram060396@gmail.com">Get in touch <Icon name="arrow" size={15} /></a></nav></div><div className="home-footer-bottom"><span>© {year} {agencyName || "Waseem Realty"}. All rights reserved.</span><span>Made for the way you live.</span><a href="#top">Back to top ↑</a></div></footer>
    </div>
  );
}
