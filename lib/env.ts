import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => req("SUPABASE_URL"),
  supabaseSecretKey: () => req("SUPABASE_SECRET_KEY"),
  geminiApiKey: () => req("GEMINI_API_KEY"),
  geminiModel: () => process.env.GEMINI_MODEL || "gemini-3.8-flash",
  resendApiKey: () => process.env.RESEND_API_KEY || "",
  emailFrom: () => process.env.EMAIL_FROM || "Kargo Hiring <onboarding@resend.dev>",
  testRecipient: () => process.env.TEST_RECIPIENT_EMAIL?.trim() || "",
  allowRealSend: () => process.env.ALLOW_REAL_SEND === "true",
  dashboardPassword: () => req("DASHBOARD_PASSWORD"),
};
