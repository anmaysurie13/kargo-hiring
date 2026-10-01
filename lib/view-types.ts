import type { DraftStatus, DraftType, Role } from "./types";

// Serializable shapes passed from server pages to client components. No email/phone ever.
export type Breakdown = { criterionId: string; name: string; weight: number; score: number; points: number; reason: string };

/** INTERVIEW = recommended invite (above the line or Arjun's override); REVIEW = below the line but strong for the other role; PASS = rest. */
export type Tier = "INTERVIEW" | "REVIEW" | "PASS";

export type CardData = {
  id: string;
  rank: number;
  firstName: string;
  fullName: string | null; // display + {{FIRST_NAME}} substitution only
  filename: string;
  appliedRole: Role;
  total: number;
  otherTotal: number | null;
  crossRole: Role | null;
  recommendedRole: Role;
  reroute: boolean;
  tier: Tier;
  aboveLine: boolean;
  desiredType: DraftType;
  override: DraftType | null;
  held: boolean;
  breakdown: Breakdown[];
  brief: string | null;
  draft: {
    type: DraftType;
    subject: string;
    template: string;
    edited: boolean;
    status: DraftStatus;
    sent_at: string | null;
    sent_to: string | null;
    error_message: string | null;
  } | null;
};

export type EmailEnv = { configured: boolean; testRecipient: string | null; blocked: boolean };
