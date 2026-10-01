"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/candidates", label: "Candidates" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/analytics", label: "Analytics" },
  { href: "/rubric", label: "Rubric" },
  { href: "/upload", label: "Upload CVs" },
];

export function Nav() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav className="-mb-px flex h-14 items-stretch gap-1 overflow-x-auto text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href) || (l.href === "/candidates" && path.startsWith("/candidate/"));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative flex items-center whitespace-nowrap px-2.5 ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-900"}`}
          >
            {l.label}
            {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-gradient-to-r from-indigo-500 to-amber-400" />}
          </Link>
        );
      })}
      <button
        onClick={async () => {
          await fetch("/api/logout", { method: "POST" });
          location.assign(new URL("/login", location.href));
        }}
        className="ml-2 whitespace-nowrap px-2 text-slate-400 hover:text-slate-700"
      >
        Sign out
      </button>
    </nav>
  );
}
