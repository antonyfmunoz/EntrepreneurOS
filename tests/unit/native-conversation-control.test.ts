import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const messageHub = readFileSync(new URL("../../client/src/components/native-message-hub.tsx", import.meta.url), "utf8");

describe("native conversation controls", () => {
  it("lets an authorized operator configure conversation identity without rewriting participants", () => {
    expect(messageHub).toContain("Configure selected conversation");
    expect(messageHub).toContain("Save native conversation");
    expect(messageHub).toContain("message-conversation-configure");
    expect(messageHub).toContain("expectedVersion: selectedConversation.version");
    expect(messageHub).toContain('data: { ...selectedConversation.data, operatingMode: "native_eos" }');
  });
});
