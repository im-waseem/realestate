"use client";

import { useMemo, useState } from "react";

type Home = {
  id: number;
  name: string;
  location: string;
  price: number;
  rent?: number;
  beds: number;
  baths: number;
  area: number;
  image: string;
  tag?: string;
};

const homes: Home[] = [
  {
    id: 1,
    name: "The Glasshouse",
    location: "Silver Lake, Los Angeles",
    price: 1249000,
    rent: 6400,
    beds: 3,
    baths: 2,
    area: 2180,
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85",
    tag: "JUST LISTED",
  },
  {
    id: 2,
    name: "Casa Solana",
    location: "La Jolla, San Diego",
    price: 1895000,
    rent: 8200,
    beds: 4,
    baths: 3,
    area: 2940,
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85",
    tag: "OPEN SUNDAY",
  },
  {
    id: 3,
    name: "The Sunday House",
    location: "Silver Lake, Los Angeles",
    price: 975000,
    rent: 5100,
    beds: 2,
    baths: 2,
    area: 1760,
    image:
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: 4,
    name: "Olive & Oak",
    location: "Pasadena, Los Angeles",
    price: 1460000,
    rent: 6900,
    beds: 4,
    baths: 3,
    area: 2510,
    image:
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85",
    tag: "PRICE IMPROVED",
  },
  {
    id: 5,
    name: "The Blue Door",
    location: "Encinitas, San Diego",
    price: 2175000,
    rent: 9100,
    beds: 3,
    baths: 3,
    area: 2860,
    image:
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=85",
  },
  {
    id: 6,
    name: "Little Canyon",
    location: "Topanga, Los Angeles",
    price: 1125000,
    rent: 5700,
    beds: 3,
    baths: 2,
    area: 2010,
    image:
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85",
  },
];

function Icon({
  name,
  size = 20,
}: {
  name: "search" | "heart" | "pin" | "arrow" | "bed" | "bath" | "area" | "menu";
  size?: number;
}) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "search":
      return (
        <svg {...shared}>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.3 4.3" />
        </svg>
      );
    case "heart":
      return (
        <svg {...shared}>
          <path d="M20.4 8.8c0 4.6-8.4 10-8.4 10s-8.4-5.4-8.4-10a4.6 4.6 0 0 1 8.4-2.5 4.6 4.6 0 0 1 8.4 2.5Z" />
        </svg>
      );
    case "pin":
      return (
        <svg {...shared}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...shared}>
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      );
    case "bed":
      return (
        <svg {...shared}>
          <path d="M3 18v-6m0 2h18v4M3 14V7m0 5h18a2 2 0 0 1 2 2v4M7 11V8a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3" />
        </svg>
      );
    case "bath":
      return (
        <svg {...shared}>
          <path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3Zm0 0V6a2 2 0 0 1 4 0v1m-1 13v2m10-2v2" />
        </svg>
      );
    case "area":
      return (
        <svg {...shared}>
          <path d="M4 9V4h5M4 4l6 6m10 5v5h-5m5 0-6-6M15 4h5v5m0-5-6 6M9 20H4v-5m0 5 6-6" />
        </svg>
      );
    case "menu":
      return (
        <svg {...shared}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
  }
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function HomePage() {
  const [intent, setIntent] = useState<"buy" | "rent">("buy");
  const [location, setLocation] = useState("");
  const [bedrooms, setBedrooms] = useState("Any");
  const [saved, setSaved] = useState<number[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const filteredHomes = useMemo(() => {
    const query = location.trim().toLowerCase();
    return homes.filter((home) => {
      const matchesLocation =
        !query ||
        home.location.toLowerCase().includes(query) ||
        home.name.toLowerCase().includes(query);
      const matchesBedrooms =
        bedrooms === "Any" || home.beds >= Number(bedrooms);
      const matchesSaved = !savedOnly || saved.includes(home.id);
      return matchesLocation && matchesBedrooms && matchesSaved;
    });
  }, [bedrooms, location, saved, savedOnly]);

  const visibleHomes = showAll ? filteredHomes : filteredHomes.slice(0, 3);

  function toggleSaved(id: number) {
    setSaved((current) =>
      current.includes(id)
        ? current.filter((savedId) => savedId !== id)
        : [...current, id],
    );
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSearched(true);
    document.getElementById("homes")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Waseem Realty home">
          <span className="brand-mark">w.</span>
          <span className="brand-name">
            WASEEM<span>REALTY</span>
          </span>
        </a>

        <button
          className="mobile-menu-button"
          type="button"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <Icon name="menu" />
        </button>

        <nav className={`main-nav${mobileMenuOpen ? " is-open" : ""}`}>
          <a href="#homes" onClick={() => setMobileMenuOpen(false)}>Buy</a>
          <a
            href="#homes"
            onClick={() => {
              setIntent("rent");
              setMobileMenuOpen(false);
            }}
          >
            Rent
          </a>
          <a href="#selling" onClick={() => setMobileMenuOpen(false)}>Sell</a>
          <a href="#about" onClick={() => setMobileMenuOpen(false)}>Our story</a>
          <a className="mobile-contact" href="mailto:hello@waseemrealty.com">
            Let&apos;s talk
          </a>
        </nav>

        <div className="header-actions">
          <button
            className={`saved-link${savedOnly ? " is-active" : ""}`}
            type="button"
            onClick={() => {
              setSavedOnly((current) => !current);
              document.getElementById("homes")?.scrollIntoView({ behavior: "smooth" });
            }}
            aria-pressed={savedOnly}
          >
            <Icon name="heart" size={18} />
            <span>Saved</span>
            {saved.length > 0 && <span className="saved-count">{saved.length}</span>}
          </button>
          <a className="contact-link" href="mailto:hello@waseemrealty.com">
            Let&apos;s talk <Icon name="arrow" size={16} />
          </a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> GOOD HOMES. GOOD PEOPLE.</p>
          <h1>Find a place<br />to <em>feel at home.</em></h1>
          <p className="hero-description">
            A more thoughtful way to find your next chapter. Discover homes
            you&apos;ll love, with people who genuinely care.
          </p>
          <div className="hero-social-proof">
            <div className="avatar-stack" aria-hidden="true">
              <span>J</span><span>M</span><span>A</span><span>K</span>
            </div>
            <p><strong>2,400+</strong> happy homeowners<br />and counting</p>
          </div>
        </div>

        <div className="hero-photo" role="img" aria-label="Sunlit modern home surrounded by trees">
          <div className="hero-photo-caption">
            <span className="caption-dot" />
            <span>Somewhere you can exhale.</span>
          </div>
          <div className="hero-photo-note">
            <span className="note-star">✳</span>
            <span>Find your<br /><strong>kind of home.</strong></span>
          </div>
        </div>

        <form className="search-panel" onSubmit={handleSearch}>
          <div className="search-intent" role="group" aria-label="Listing type">
            <button
              className={intent === "buy" ? "selected" : ""}
              type="button"
              onClick={() => setIntent("buy")}
              aria-pressed={intent === "buy"}
            >
              Buy
            </button>
            <button
              className={intent === "rent" ? "selected" : ""}
              type="button"
              onClick={() => setIntent("rent")}
              aria-pressed={intent === "rent"}
            >
              Rent
            </button>
          </div>
          <label className="search-field location-field">
            <span>LOCATION</span>
            <span className="input-with-icon">
              <Icon name="pin" size={18} />
              <input
                type="search"
                placeholder="City, neighborhood, or ZIP"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </span>
          </label>
          <label className="search-field bedroom-field">
            <span>BEDROOMS</span>
            <select value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}>
              <option>Any</option>
              <option value="1">1+ beds</option>
              <option value="2">2+ beds</option>
              <option value="3">3+ beds</option>
              <option value="4">4+ beds</option>
            </select>
          </label>
          <button className="search-button" type="submit">
            <Icon name="search" size={19} /><span>Find my home</span>
          </button>
        </form>
      </section>

      <div className="trust-strip" aria-label="Our service commitments">
        <span>Local hearts, local know-how</span><i />
        <span>No-pressure, ever</span><i />
        <span>Good people. Great keys.</span>
      </div>

      <section className="listings-section section-wrap" id="homes">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span /> THE GOOD STUFF</p>
            <h2>{savedOnly ? "Your saved homes." : "Homes with a little heart."}</h2>
            <p className="section-intro">
              {savedOnly
                ? "The places you’ve had your eye on, all in one spot."
                : "Thoughtfully picked places, in the neighborhoods we know best."}
            </p>
          </div>
          <a className="text-link" href="#homes" onClick={() => { setSavedOnly(false); setShowAll(true); }}>
            See all homes <Icon name="arrow" size={17} />
          </a>
        </div>

        <div className="listing-toolbar">
          <div className="listing-tabs" role="group" aria-label="Filter listings by type">
            <button className={intent === "buy" ? "active" : ""} type="button" onClick={() => setIntent("buy")}>For sale</button>
            <button className={intent === "rent" ? "active" : ""} type="button" onClick={() => setIntent("rent")}>For rent</button>
          </div>
          <span className="result-count">
            {filteredHomes.length} {filteredHomes.length === 1 ? "lovely home" : "lovely homes"}
            {hasSearched && location.trim() && ` near “${location.trim()}”`}
          </span>
        </div>

        {visibleHomes.length > 0 ? (
          <div className="property-grid">
            {visibleHomes.map((home) => (
              <article className="property-card" key={home.id}>
                <a
                  className="property-image"
                  href="mailto:hello@waseemrealty.com?subject=Tell%20me%20about%20a%20home"
                  style={{ backgroundImage: `url("${home.image}")` }}
                  aria-label={`Ask us about ${home.name}`}
                >
                  {home.tag && <span className="property-tag">{home.tag}</span>}
                </a>
                <button
                  className={`favorite-button${saved.includes(home.id) ? " is-saved" : ""}`}
                  type="button"
                  aria-label={saved.includes(home.id) ? `Remove ${home.name} from saved homes` : `Save ${home.name}`}
                  aria-pressed={saved.includes(home.id)}
                  onClick={() => toggleSaved(home.id)}
                >
                  <Icon name="heart" size={19} />
                </button>
                <div className="property-details">
                  <div className="property-title-row">
                    <h3>{home.name}</h3>
                    <span className="property-price">
                      {formatPrice(intent === "rent" ? home.rent ?? home.price : home.price)}
                      {intent === "rent" && <small>/mo</small>}
                    </span>
                  </div>
                  <p className="property-location"><Icon name="pin" size={15} />{home.location}</p>
                  <div className="property-specs">
                    <span><Icon name="bed" size={16} />{home.beds} beds</span>
                    <span><Icon name="bath" size={16} />{home.baths} baths</span>
                    <span><Icon name="area" size={15} />{home.area.toLocaleString()} sqft</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-heart"><Icon name="heart" size={22} /></span>
            <h3>{savedOnly ? "No saved homes just yet." : "No homes found this time."}</h3>
            <p>{savedOnly ? "Tap the heart on a home that catches your eye." : "Try a different neighborhood or broaden your search."}</p>
            <button
              type="button"
              className="outline-button"
              onClick={() => {
                setSavedOnly(false);
                setLocation("");
                setBedrooms("Any");
                setHasSearched(false);
              }}
            >
              Show me all homes
            </button>
          </div>
        )}

        {filteredHomes.length > 3 && (
          <div className="load-more-row">
            <button className="outline-button" type="button" onClick={() => setShowAll((current) => !current)}>
              {showAll ? "Show a little less" : "Explore all homes"}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </section>

      <section className="about-section" id="about">
        <div className="about-image" role="img" aria-label="A welcoming home interior filled with natural light">
          <span className="image-sticker"><span>✳</span> Made for<br />real life</span>
        </div>
        <div className="about-copy">
          <p className="eyebrow"><span /> A DIFFERENT KIND OF REALTY</p>
          <h2>It&apos;s not just<br />a house. <em>We get it.</em></h2>
          <p>
            Moving is a big deal. So we built a little real estate company that
            treats it like one. No scripts, no pressure — just thoughtful
            guidance from people who know these neighborhoods by heart.
          </p>
          <a className="text-link" href="mailto:hello@waseemrealty.com">
            Get to know us <Icon name="arrow" size={17} />
          </a>
          <div className="about-stat"><strong>12</strong><span>years of helping<br />people feel at home</span></div>
        </div>
      </section>

      <section className="sell-section section-wrap" id="selling">
        <div>
          <p className="eyebrow"><span /> THINKING ABOUT A MOVE?</p>
          <h2>Your next chapter<br />starts with a <em>hello.</em></h2>
        </div>
        <div className="sell-cta">
          <p>Buying, selling, or just figuring it all out? We&apos;re here for all of it.</p>
          <a className="contact-link" href="mailto:hello@waseemrealty.com">
            Let&apos;s find your way <Icon name="arrow" size={17} />
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark">w.</span>
          <span className="brand-name">WASEEM<span>REALTY</span></span>
        </a>
        <p>Good homes. Good people. Wherever life takes you.</p>
        <div className="footer-bottom">
          <span>© 2025 Waseem Realty. Made with a little heart.</span>
          <a href="mailto:hello@waseemrealty.com">hello@waseemrealty.com</a>
          <a href="#top">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
