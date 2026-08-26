import { describe, expect, it, vi } from "vitest";
import { transcribeCandidateAudio } from "../../server/artifacts/candidate-transcription";
import { candidateFileSha256 } from "../../server/artifacts/candidate-files";

const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01]);
const metadata = {
  fileName: "response.webm",
  mimeType: "audio/webm",
  sizeBytes: bytes.length,
  sha256: candidateFileSha256(bytes),
};

describe("candidate voice transcription boundary", () => {
  it("does not call a provider unless transcription is explicitly enabled and configured", async () => {
    const execute = vi.fn(async () => "should not run");
    expect(
      await transcribeCandidateAudio(
        bytes,
        metadata,
        {} as NodeJS.ProcessEnv,
        execute,
      ),
    ).toEqual({
      state: "unavailable",
      transcript: "",
      provider: null,
      model: null,
      completedAt: null,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns a bounded transcript without exposing the API key", async () => {
    const execute = vi.fn(
      async ({ apiKey }: { apiKey: string }) =>
        `  Candidate response ${apiKey === "secret" ? "accepted" : "rejected"}.  `,
    );
    const result = await transcribeCandidateAudio(
      bytes,
      metadata,
      {
        EOS_CANDIDATE_STT_ENABLED: "true",
        OPENAI_API_KEY: "secret",
        EOS_CANDIDATE_STT_MODEL: "gpt-4o-mini-transcribe",
      } as NodeJS.ProcessEnv,
      execute,
    );
    expect(result).toMatchObject({
      state: "completed",
      transcript: "Candidate response accepted.",
      provider: "openai",
      model: "gpt-4o-mini-transcribe",
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("fails closed for non-audio content and provider errors", async () => {
    const env = {
      EOS_CANDIDATE_STT_ENABLED: "true",
      OPENAI_API_KEY: "secret",
      EOS_CANDIDATE_STT_MODEL: "transcribe-model",
    } as NodeJS.ProcessEnv;
    expect(
      (
        await transcribeCandidateAudio(
          bytes,
          { ...metadata, mimeType: "text/plain" },
          env,
        )
      ).state,
    ).toBe("failed");
    expect(
      (
        await transcribeCandidateAudio(bytes, metadata, env, async () => {
          throw new Error("provider detail");
        })
      ).state,
    ).toBe("failed");
  });
});
