import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformHeader,Money,Notice } from "@/components/platform";
import { publicProperties,propertyImages } from "@/lib/public-properties";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { submitPublicEnquiry } from "../enquiry-actions";
import styles from "@/components/property-market.module.css";

export const dynamic="force-dynamic";
export default async function Detail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{message?:string;sent?:string}>}) {
  const {id}=await params;
  const query=await searchParams;
  const property=(await publicProperties({target_id:id}))[0];
  if(!property) notFound();
  const images=propertyImages(property.images);
  return <><PlatformHeader/><main className={styles.market}><Link href="/properties">← Back to properties</Link><p className="kicker">{property.type} · FOR {property.intent.toUpperCase()}</p><h1>{property.title}</h1><p className={styles.intro}>{property.locality}, {property.city} · Listed by {property.agency_name}</p>
  {images.length>0&&<div className={styles.gallery} aria-label="Property photos">{images.map((image,index)=><div key={image}><Image src={image} alt={`${property.title}, photo ${index+1}`} fill unoptimized sizes="(max-width:760px) 95vw, 80vw" /></div>)}</div>}
  <div className={styles.detailGrid}><div className={styles.detailPanel}><p className={styles.price}><Money value={property.price}/>{property.intent==="rent"?" / month":""}</p><h2>Space for your next chapter</h2><dl>{[["Bedrooms",property.beds],["Bathrooms",property.baths],["Area",`${property.area} sq ft`],["Furnishing",property.furnishing.replaceAll("_"," ")],["Car parking",property.car_parking],["Two-wheeler parking",property.two_wheeler_parking],["Floor",property.floor_number===0?"Ground":property.floor_number],["Property age",property.age_years===null?"Not specified":`${property.age_years} years`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h2>About this property</h2><p>{property.description}</p><h2>Amenities</h2><p>{property.amenities||"Ask the agency for details."}</p><h2>Explore the neighbourhood</h2><p>This map shows an approximate area. Request the exact address and a visit from the agency.</p><iframe className={styles.map} title="Approximate property neighbourhood" loading="lazy" referrerPolicy="no-referrer" src={`https://www.openstreetmap.org/export/embed.html?bbox=${property.map_lng-.02},${property.map_lat-.02},${property.map_lng+.02},${property.map_lat+.02}&layer=mapnik&marker=${property.map_lat},${property.map_lng}`} /></div>
  <aside id="enquire" className={`${styles.detailPanel} ${styles.enquiry}`}><p className="kicker">LET’S MAKE THE NEXT MOVE</p><h2>Arrange a visit</h2><p>Your enquiry goes to {property.agency_name}. Your contact details are shared with their authorised team.</p><Notice message={query.sent==="1"?"Enquiry sent. The agency can now contact you to discuss this property.":query.message}/><form action={submitPublicEnquiry}><input type="hidden" name="property_id" value={property.id}/><label>Your name<input name="name" minLength={2} maxLength={100} autoComplete="name" required/></label><label>Phone<input name="phone" type="tel" minLength={7} maxLength={25} autoComplete="tel" required/></label><label>Email<input name="email" type="email" maxLength={254} autoComplete="email" required/></label><label>How can the agency help?<textarea name="message" minLength={10} maxLength={2000} placeholder="Tell us your requirements and preferred time for a visit." required/></label><label className={styles.honeypot} aria-hidden="true">Leave this blank<input name="website" tabIndex={-1} autoComplete="off"/></label><SubmitButton pendingLabel="Sending enquiry…">Send enquiry →</SubmitButton></form></aside></div></main></>;
}
