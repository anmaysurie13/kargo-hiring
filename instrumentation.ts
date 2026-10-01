// Validates the rubric on server start and fails LOUDLY if weights do not sum to 100 per role.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SUPABASE_URL) return;
  const { rubricHealth } = await import("./lib/rubric");
  const h = await rubricHealth();
  if (!h.ok) console.error(`\n\x1b[41m RUBRIC INVALID \x1b[0m ${h.errors.join(" ")}\nScoring is disabled until this is fixed.\n`);
  else console.log(`Rubric OK: ${h.criteria.length} criteria, weights sum to 100 per role.`);
}
