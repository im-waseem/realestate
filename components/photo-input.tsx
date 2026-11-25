"use client";

import { useState } from "react";

export function PhotoInput({
  initial,
  agencyId,
  value: controlledValue,
  onChange,
  onUploading,
}: {
  initial: string;
  agencyId?: string;
  value?: string;
  onChange?: (value: string) => void;
  onUploading?: (uploading: boolean) => void;
}) {
  const [internalValue, setInternalValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const value = controlledValue ?? internalValue;

  function updateValue(nextValue: string) {
    setInternalValue(nextValue);
    onChange?.(nextValue);
  }

  async function uploadFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    const form = input.closest("form");
    const selectedAgencyId = agencyId
      || form?.querySelector<HTMLSelectElement>('select[name="agency_id"]')?.value
      || form?.querySelector<HTMLInputElement>('input[name="agency_id"]')?.value;
    const current = value.split("\n").filter(Boolean);
    if (current.length + files.length > 12) {
      setMessage("Choose up to 12 photos in total.");
      input.value = "";
      return;
    }

    setBusy(true);
    onUploading?.(true);
    setMessage("");
    const urls: string[] = [];
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Each photo must be under 5 MB.");
        const data = new FormData();
        data.set("file", file);
        if (selectedAgencyId) data.set("agency_id", selectedAgencyId);
        const response = await fetch("/api/uploads", { method: "POST", body: data });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        urls.push(result.url);
      }
      updateValue([...current, ...urls].join("\n"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
      if (urls.length) updateValue([...current, ...urls].join("\n"));
    } finally {
      setBusy(false);
      onUploading?.(false);
      input.value = "";
    }
  }

  return (
    <div className="stack">
      <label>
        Upload property photos
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={uploadFiles} />
        <small>JPEG, PNG, or WebP. Up to 5 MB each, 12 images total.</small>
      </label>
      {busy && <p role="status">Uploading photos… Wait for uploads to finish before saving.</p>}
      {message && <p role="alert">{message}</p>}
      <label>
        Photo URLs
        <textarea name="images" value={value} onChange={(event) => updateValue(event.target.value)} required maxLength={6000} />
        <small>Uploaded photos appear here. You can also paste HTTPS image URLs, one per line.</small>
      </label>
      <input type="hidden" name="uploading" value={busy ? "yes" : "no"} />
    </div>
  );
}
