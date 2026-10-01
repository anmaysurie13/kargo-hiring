"use client";

import { useState } from "react";
import { btn } from "./ui";

export function ExportButton() {
  const [contact, setContact] = useState(false);
  return (
    <span className="inline-flex items-center gap-3">
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} />
        include contact details
      </label>
      <a className={btn.secondary} href={`/api/export${contact ? "?include_contact=1" : ""}`}>Export CSV</a>
    </span>
  );
}
