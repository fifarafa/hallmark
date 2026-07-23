// Sandbox/agent configuration for the sandcastle provider.
//
// Podman is the default: it is rootless and daemonless, which suits a runner
// that grants an agent write access inside the container. Docker is selectable
// because it is the same sandcastle API and one env var apart.
import { podman } from "@ai-hero/sandcastle/sandboxes/podman";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import type { SandboxProvider } from "@ai-hero/sandcastle";
import { HallmarkError } from "../../util.ts";

export const DEFAULT_IMAGE = "hallmark-agent:local";
export const DEFAULT_MODEL = "claude-opus-4-8";

export function imageName(): string {
  return process.env.HALLMARK_IMAGE?.trim() || DEFAULT_IMAGE;
}

export function agentModel(): string {
  return process.env.HALLMARK_MODEL?.trim() || DEFAULT_MODEL;
}

export function sandboxProvider(): SandboxProvider {
  const raw = process.env.HALLMARK_SANDBOX?.trim().toLowerCase() || "podman";
  const options = { imageName: imageName() };

  if (raw === "podman") return podman(options);
  if (raw === "docker") return docker(options);
  throw new HallmarkError(
    `Unknown HALLMARK_SANDBOX='${raw}'. Expected 'podman' or 'docker'.`,
  );
}
