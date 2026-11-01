"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

import styles from "./workspace.module.css";

const View = createContext("overview");
const sections = new Set(["overview", "agencies", "agency-details", "inventory", "leads", "team"]);
function currentView() {
  const hash = window.location.hash.slice(1);
  return sections.has(hash) ? hash : "overview";
}
function subscribe(change: () => void) {
  window.addEventListener("hashchange", change);
  return () => window.removeEventListener("hashchange", change);
}

export function WorkspaceShell({ children, allowedViews }: { children: ReactNode; allowedViews: string[] }) {
  const hash = useSyncExternalStore(subscribe, currentView, () => "overview");
  const view = allowedViews.includes(hash) ? hash : "overview";
  useEffect(() => {
    if (window.location.hash) document.getElementById(view)?.focus({ preventScroll: true });
  }, [view]);
  return <View.Provider value={view}><div className={`dashboard-shell workspace-redesign ${styles.shell}`}>{children}</div></View.Provider>;
}

export function WorkspaceSection({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  const view = useContext(View);
  return <section id={id} hidden={view !== id} tabIndex={-1} className={`workspace-view ${className}`} aria-label={id.replaceAll("-", " ")}>{children}</section>;
}

export function WorkspaceNavLink({ href, children }: { href: string; children: ReactNode }) {
  const view = useContext(View);
  const active = href === `#${view}`;
  return <a href={href} aria-current={active ? "page" : undefined}>{children}</a>;
}
