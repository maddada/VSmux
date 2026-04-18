import { logVSmuxReproTrace } from "./vsmux-debug-log";

export function logAgentTilerFocusTrace(event: string, details?: unknown): void {
  logVSmuxReproTrace(`repro.agentTilerFocus.${event}`, details);
}
