// Setup check for the sandcastle provider: runs one real `spec` agent against a
// throwaway run id and prints the SkillResult.
//
// Useful because it exercises the whole path — worktree, container, Claude Code
// auth, copy-out — without touching canonical state or the one-active-run WIP
// limit. A credentials problem shows up here as a clean `success: false`.
//
//   npx tsx scripts/probe-agent.mts
import { runAgenticSkill } from "../src/skills/sandcastle/index.ts";

const runId = process.argv[2] ?? "PROBE-1";

const result = await runAgenticSkill("spec", {
  runId,
  title: "Probe the sandcastle provider setup",
});

console.log("\n--- SkillResult ---");
console.log("success: ", result.success);
console.log("summary: ", result.summary);
console.log("evidence:", result.evidencePaths);
console.log("metadata:", JSON.stringify(result.metadata, null, 2));

if (!result.success) {
  console.log(
    "\nThe agent did not complete. If this says 'Not logged in', put a token in" +
      "\n.sandcastle/.env (see .sandcastle/.env.example).",
  );
  process.exit(1);
}
console.log(`\nSetup looks good. Artifacts landed under artifacts/${runId}/.`);
