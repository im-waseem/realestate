"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

export function AgencyLeadQr({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
    const siteOrigin = configuredOrigin || "https://realestatewaseem.vercel.app";
    setUrl(`${siteOrigin}/agency/${encodeURIComponent(agencyId)}`);
  }, [agencyId]);

  function downloadQr() {
    const svg = document.querySelector<SVGSVGElement>("#agency-lead-qr svg");
    if (!svg || !url) return;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${agencyName.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "agency"}-lead-qr.svg`;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <article className="panel agency-lead-qr-card">
      <div>
        <p className="kicker">LET CLIENTS FIND YOU</p>
        <h2>Agency enquiry QR</h2>
        <p className="muted">Display this code at your office or add it to a flyer. Anyone scanning can view this active agency&apos;s contact details and send an enquiry without signing in.</p>
        {url && <p className="agency-lead-qr-url"><a href={url} target="_blank" rel="noreferrer">{url}</a></p>}
        <button className="btn workspace-secondary" type="button" onClick={downloadQr} disabled={!url}>Download QR code</button>
      </div>
      <div id="agency-lead-qr" className="agency-lead-qr-image" aria-label="QR code linking to the agency enquiry page">
        {url ? <QRCodeSVG value={url} size={168} level="M" includeMargin fgColor="#153c30" bgColor="#ffffff" /> : <span>Preparing QR code…</span>}
      </div>
    </article>
  );
}
