"use client";

import { useEffect, useState } from "react";

export function PincodeAddressFields({ enabledPincode, enabledAddress, initialPincode = "", initialAddress = "", initialCity = "" }: {
  enabledPincode: boolean; enabledAddress: boolean; initialPincode?: string; initialAddress?: string; initialCity?: string;
}) {
  const [pincode, setPincode] = useState(initialPincode);
  const [address, setAddress] = useState(initialAddress);
  const [city, setCity] = useState(initialCity);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!enabledPincode || pincode.length !== 6) return;
    let active = true;
    setMessage("Looking up PIN code…");
    fetch(`/api/pincode/${pincode}`).then(async (response) => {
      const data = await response.json() as { city?: string; state?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "PIN code lookup failed.");
      if (!active) return;
      setCity(data.city || "");
      setAddress([data.city, data.state, pincode].filter(Boolean).join(", "));
      setMessage(`${data.city}, ${data.state}`);
    }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "PIN code lookup failed."); });
    return () => { active = false; };
  }, [pincode, enabledPincode]);
  return <>
    {enabledPincode && <><label>PIN code<input name="pincode" inputMode="numeric" maxLength={6} value={pincode} required onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))}/></label><p className="muted" role="status">{message}</p></>}
    {enabledAddress && <label>Address<input name="applicant_address" value={address} maxLength={500} required onChange={(event) => setAddress(event.target.value)}/></label>}
    <label>City / district<input name="city" value={city} maxLength={100} required onChange={(event) => setCity(event.target.value)}/></label>
  </>;
}
