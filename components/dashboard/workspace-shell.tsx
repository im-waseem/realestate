"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import styles from "./workspace.module.css";

type ViewState = { view: string; setView: (view: string) => void };
const View = createContext<ViewState>({ view: "overview", setView: () => {} });
const sections = new Set(["overview", "agencies", "agency-details", "inventory", "leads", "services", "team"]);
function readView() {
  const hash = window.location.hash.slice(1);
  return sections.has(hash) ? hash : "overview";
}

export function WorkspaceShell({ children, allowedViews, theme = "agency" }: { children: ReactNode; allowedViews: string[]; theme?: "platform" | "agency" }) {
  const [hashView, setHashView] = useState("overview");
  const view = allowedViews.includes(hashView) ? hashView : "overview";
  useEffect(() => {
    const syncHash = () => setHashView(readView());
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  useEffect(() => {
    if (window.location.hash) document.getElementById(view)?.focus({ preventScroll: true });
  }, [view]);
  return <View.Provider value={{ view, setView: setHashView }}><div className={`dashboard-shell workspace-redesign ${styles.shell} ${theme === "platform" ? styles.platform : styles.agency}`}>{children}</div></View.Provider>;
}

export function WorkspaceSection({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  const { view } = useContext(View);
  return <section id={id} hidden={view !== id} tabIndex={-1} className={`workspace-view ${className}`} aria-label={id.replaceAll("-", " ")}>{children}</section>;
}

export function WorkspaceNavLink({ href, children }: { href: string; children: ReactNode }) {
  const { view, setView } = useContext(View);
  const active = href === `#${view}`;
  return <a href={href} aria-current={active ? "page" : undefined} onClick={() => setView(href.slice(1))}>{children}</a>;
}
