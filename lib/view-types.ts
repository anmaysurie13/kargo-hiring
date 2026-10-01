import type { DraftStatus, DraftType, Role } from "./types";

// Serializable shapes passed from server pages to client components. No email/phone ever.
export type Breakdown = { criterionId: string; name: string; weight: number; score: number; points: number; reason: string };

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
