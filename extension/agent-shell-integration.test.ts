import { describe, expect, test } from "vite-plus/test";
import { parseAgentControlChunk } from "./agent-shell-integration";

describe("parseAgentControlChunk", () => {
  test("should strip agent lifecycle markers from visible terminal output", () => {
    const parsed = parseAgentControlChunk(`hello\u001b]9001;agent-canvas-x;start;codex\u0007world`);

    expect(parsed.output).toBe("helloworld");
    expect(parsed.pending).toBe("");
    expect(parsed.events).toEqual([{ agentName: "codex", eventType: "start" }]);
  });

  test("should preserve unrelated OSC sequences", () => {
    const parsed = parseAgentControlChunk(`\u001b]0;My Title\u0007ready`);

    expect(parsed.output).toBe(`\u001b]0;My Title\u0007ready`);
    expect(parsed.events).toEqual([]);
  });

  test("should buffer incomplete lifecycle markers until the terminator arrives", () => {
    const firstChunk = parseAgentControlChunk(`busy\u001b]9001;agent-canvas-x;stop;codex`);

    expect(firstChunk.output).toBe("busy");
    expect(firstChunk.pending).toBe(`\u001b]9001;agent-canvas-x;stop;codex`);
    expect(firstChunk.events).toEqual([]);

    const secondChunk = parseAgentControlChunk(`${firstChunk.pending}\u0007done`);

    expect(secondChunk.output).toBe("done");
    expect(secondChunk.pending).toBe("");
    expect(secondChunk.events).toEqual([{ agentName: "codex", eventType: "stop" }]);
  });
});
