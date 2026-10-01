export const ROLES = ["PM", "SPM"] as const;
export type Role = (typeof ROLES)[number];
export type DraftType = "invite" | "rejection";
export type DraftStatus = "draft" | "sending" | "sent" | "failed";

export const otherRole = (r: Role): Role => (r === "PM" ? "SPM" : "PM");
export const roleLabel = (r: Role) => (r === "PM" ? "Product Manager" : "Senior Product Manager");

export type Criterion = { id: string; role: Role; name: string; description: string; weight: number; sort_order: number };

export type CandidateRow = {
  id: string;
  created_at: string;
  applied_role: Role;
  original_filename: string;
  status: "processing" | "scored" | "error";
  error_message: string | null;
  cv_content: string | null;
  pii_redaction_report: Record<string, unknown> | null;
  decision_override: DraftType | null;
  held: boolean;
};

export type ScoreRow = { candidate_id: string; role: Role; criterion_id: string; score: number; reason: string; points: number };
export type BriefRow = { candidate_id: string; role: Role; brief_text: string; generated_at: string };
export type DraftRow = {
  id: string;
  candidate_id: string;
  type: DraftType;
  subject: string;
  body_template: string;
  edited_body: string | null;
  status: DraftStatus;
  error_message: string | null;
  sent_at: string | null;
  resend_message_id: string | null;
  sent_to: string | null;
  updated_at: string;
};
