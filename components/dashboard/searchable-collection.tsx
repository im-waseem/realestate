"use client";

import { useId, useState, type ReactNode } from "react";

export function SearchableCollection({ label, items, tableHeader, placeholder = "Search by name, email or status…" }: { label: string; tableHeader?: ReactNode; placeholder?: string; items: { id: string; search: string; content: ReactNode }[] }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const filtered = items.filter(item => item.search.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <>
    <div className="workspace-search"><label htmlFor={id}>{label}</label><input id={id} type="search" placeholder={placeholder} value={query} onChange={event => setQuery(event.target.value)} /><span role="status">{filtered.length} of {items.length}</span></div>
    {tableHeader ? <div className="table-wrap"><table><thead>{tableHeader}</thead><tbody>{filtered.map(item => item.content)}</tbody></table></div> : filtered.map(item => <div key={item.id}>{item.content}</div>)}
    {filtered.length === 0 && <p className="empty">{query ? "No matches. Try another name or clear your search." : "Nothing here yet. New records will appear here."}</p>}
  </>;
}
