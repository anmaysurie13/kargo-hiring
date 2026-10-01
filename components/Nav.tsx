"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/candidates", label: "Candidates" },
  { href: "/analytics", label: "Analytics" },
  { href: "/rubric", label: "Rubric" },
  { href: "/upload", label: "Upload CVs" },
];

export function Nav({ signOut }: { signOut: boolean }) {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href) || (l.href === "/candidates" && path.startsWith("/candidate/"));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative whitespace-nowrap rounded-md px-3 py-1.5 transition-colors ${active ? "font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            {l.label}
            {active && <span className="absolute -bottom-[13px] left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-amber-400" />}
          </Link>
        );
      })}
      {signOut && (
      <button
        onClick={async () => {
          await fetch("/api/logout", { method: "POST" });
          location.assign(new URL("/login", location.href));
        }}
        className="whitespace-nowrap rounded-md px-3 py-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        Sign out
      </button>
      )}
    </nav>
  );
}
