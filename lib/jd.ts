import type { Role } from "./types";

// Job descriptions: BACKGROUND ONLY, for writing interview briefs and emails.
// Candidates are NEVER scored against these. Scoring uses rubric_criteria only.
//
// TODO: replace these placeholders with the full text of the PM and SPM JDs.
export const JOB_DESCRIPTIONS: Record<Role, string> = {
  PM: `Product Manager, Kargo (Series A logistics SaaS, Mumbai).
Owns a product area end to end: discovery with shippers, carriers and ops teams, writing specs, shipping in short cycles
with engineering, and measuring adoption. Works directly with the founder. Small team, few established processes.`,
  SPM: `Senior Product Manager, Kargo (Series A logistics SaaS, Mumbai).
Owns a major platform area (integrations, data layer, carrier/customer connectivity) without a senior PM above them.
Sets product practice for a growing team, ties platform work to revenue, and works cross-functionally with sales,
ops and engineering. Reports to the founder.`,
};
