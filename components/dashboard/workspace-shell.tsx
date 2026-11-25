"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

import styles from "./workspace.module.css";

type ViewState = { view: string; setView: (view: string) => void };
const View = createContext<ViewState>({ view: "overview", setView: () => {} });
const sections = new Set(["overview", "agencies", "agency-details", "inventory", "leads", "home-loans", "loans", "tools", "services", "team"]);
function readView(fallback = "overview") {
  const hash = window.location.hash.slice(1);
  return sections.has(hash) ? hash : fallback;
}

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export function WorkspaceShell({ children, allowedViews, theme = "agency", defaultView = "overview" }: { children: ReactNode; allowedViews: string[]; theme?: "platform" | "agency"; defaultView?: string }) {
  const hashView = useSyncExternalStore(subscribeToHash, () => readView(defaultView), () => defaultView);
  const view = allowedViews.includes(hashView) ? hashView : defaultView;
  const setView = (nextView: string) => {
    if (window.location.hash.slice(1) !== nextView) window.location.hash = nextView;
  };
  useEffect(() => {
    if (window.location.hash) document.getElementById(view)?.focus({ preventScroll: true });
  }, [view]);
  return <View.Provider value={{ view, setView }}><div className={`dashboard-shell workspace-redesign ${styles.shell} ${theme === "platform" ? styles.platform : styles.agency}`}>{children}</div></View.Provider>;
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
