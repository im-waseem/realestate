"use client";

import Image from "next/image";
import { useState } from "react";
import { updateAgencyProfile } from "@/app/actions";
import { SubmitButton } from "./submit-button";
import styles from "./agency-profile-editor.module.css";

type LocationResult = { display_name: string; lat: string; lon: string };
const project = (lat: number, lng: number, zoom: number) => {
  const sin = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
  return { x: (lng + 180) / 360 * 256 * 2 ** zoom, y: (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 256 * 2 ** zoom };
};
const unproject = (x: number, y: number, zoom: number) => {
  const size = 256 * 2 ** zoom;
  return { lng: Math.max(-180, Math.min(180, x / size * 360 - 180)), lat: Math.max(-85, Math.min(85, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI)) };
};

export function AgencyProfileEditor({ agency, superAdmin = false }: { agency: { id: string; name: string; phone: string; address: string; lat: number | null; lng: number | null }; superAdmin?: boolean }) {
  const [address, setAddress] = useState(agency.address);
  const [lat, setLat] = useState(agency.lat === null ? "" : String(agency.lat));
  const [lng, setLng] = useState(agency.lng === null ? "" : String(agency.lng));
  const [confirmed, setConfirmed] = useState(true);
  const [zoom, setZoom] = useState(agency.lat === null ? 4 : 14);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const valid = lat !== "" && lng !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 85 && Math.abs(Number(lng)) <= 180;
  const center = project(valid ? Number(lat) : 22, valid ? Number(lng) : 79, zoom);
  function selectLocation(latitude: number, longitude: number) { setLat(latitude.toFixed(6)); setLng(longitude.toFixed(6)); setConfirmed(true); setMessage("Pin selected. Save to update your agency office location."); }
  async function findAddress() {
    setSearching(true); setMessage(""); setResults([]);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Address lookup unavailable.");
      setResults(data);
      if (!data.length) setMessage("No matching address. Place the pin on the map or enter coordinates.");
    } catch { setMessage("Address search is unavailable. You can still choose the pin on the map or enter coordinates."); }
    finally { setSearching(false); }
  }
  return <form action={updateAgencyProfile} className={`stack agency-profile-form ${styles.editor}`}>
    <p className="kicker">BUSINESS PROFILE & OFFICE LOCATION</p>
    {superAdmin && <input type="hidden" name="agency_id" value={agency.id} />}
    <input type="hidden" name="location_confirmed" value={confirmed ? "yes" : "no"} />
    <label>Agency name<input name="name" defaultValue={agency.name} maxLength={150} required /></label>
    <label>Phone<input name="phone" type="tel" defaultValue={agency.phone} maxLength={25} required /></label>
    <label className={styles.wide}>Office address<input name="address" value={address} maxLength={500} required onChange={event => { setAddress(event.target.value); setConfirmed(false); setResults([]); }} /></label>
    <div className={styles.wide}><button type="button" className="btn workspace-secondary" disabled={searching || address.trim().length < 3} onClick={findAddress}>{searching ? "Finding address…" : "Find address on map"}</button><p className="muted">Click the map to place the pin. Use + / − to zoom, or arrow keys to adjust the pin.</p></div>
    {results.length > 0 && <ul className={styles.results}>{results.map(result => <li key={`${result.lat},${result.lon}`}><button type="button" onClick={() => { setAddress(result.display_name.slice(0,500)); selectLocation(Number(result.lat),Number(result.lon)); setZoom(15); setResults([]); }}>{result.display_name}</button></li>)}</ul>}
    <div className={styles.map} role="button" tabIndex={0} aria-label="Office location map. Click to place a pin or use arrow keys to adjust it."
      onKeyDown={event => { if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)) { event.preventDefault(); const point = unproject(center.x + (event.key === "ArrowRight" ? 20 : event.key === "ArrowLeft" ? -20 : 0),center.y + (event.key === "ArrowDown" ? 20 : event.key === "ArrowUp" ? -20 : 0),zoom); selectLocation(point.lat,point.lng); } }}
      onClick={event => { const bounds=event.currentTarget.getBoundingClientRect(); const point=unproject(center.x+(event.clientX-bounds.left-bounds.width/2),center.y+(event.clientY-bounds.top-bounds.height/2),zoom); selectLocation(point.lat,point.lng); }}>
      <div className={styles.tiles} aria-hidden="true">{Array.from({length:25},(_,i)=>{const x=Math.floor(center.x/256)+i%5-2,y=Math.floor(center.y/256)+Math.floor(i/5)-2; if(y<0||y>=2**zoom)return null; return <Image key={`${zoom}-${x}-${y}`} alt="" src={`https://tile.openstreetmap.org/${zoom}/${((x%2**zoom)+2**zoom)%2**zoom}/${y}.png`} width={256} height={256} unoptimized draggable={false} style={{position:"absolute",left:`calc(50% + ${x*256-center.x}px)`,top:`calc(50% + ${y*256-center.y}px)`}} />;})}</div>
      {valid && <span className={styles.pin} aria-hidden="true">●</span>}
      <div className={styles.zoom}>{[1,-1].map(direction=><button key={direction} type="button" aria-label={direction===1?"Zoom in":"Zoom out"} onClick={event=>{event.stopPropagation();setZoom(value=>Math.min(18,Math.max(1,value+direction)));}}>{direction===1?"+":"−"}</button>)}</div>
      <a className={styles.attribution} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()}>© OpenStreetMap contributors</a>
    </div>
    <label>Latitude<input name="lat" type="number" min="-85" max="85" step="any" value={lat} onChange={event=>{setLat(event.target.value);setConfirmed(false);}} /></label>
    <label>Longitude<input name="lng" type="number" min="-180" max="180" step="any" value={lng} onChange={event=>{setLng(event.target.value);setConfirmed(false);}} /></label>
    {!confirmed && <div className={styles.wide}><p role="status">Confirm the office pin for this address before saving.</p><button type="button" className="btn workspace-secondary" disabled={!valid} onClick={()=>setConfirmed(true)}>Confirm this map pin</button></div>}
    <p className={styles.wide} role="status">{message || "The office address and pin are saved together. Property locations stay separate."}</p>
    {confirmed ? <SubmitButton>Save agency & map</SubmitButton> : <button type="button" className="btn" disabled>Confirm location to save</button>}
  </form>;
}
