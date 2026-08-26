import OpenAI, { toFile } from "openai";
import type { CandidateFileMetadata } from "./candidate-files";

export type CandidateTranscriptionResult = {
  state: "completed" | "unavailable" | "failed";
  transcript: string;
  provider: string | null;
  model: string | null;
  completedAt: Date | null;
};

type TranscriptionExecutor = (input: {
  buffer: Buffer;
  metadata: CandidateFileMetadata;
  apiKey: string;
  model: string;
}) => Promise<string>;

function transcriptionConfiguration(
  env: NodeJS.ProcessEnv,
): { apiKey: string; model: string } | null {
  if (env.EOS_CANDIDATE_STT_ENABLED !== "true") return null;
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.EOS_CANDIDATE_STT_MODEL?.trim();
  if (!apiKey || !model || !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,99}$/.test(model))
    return null;
  return { apiKey, model };
}

export function candidateTranscriptionConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(transcriptionConfiguration(env));
}

async function openAiTranscription({
  buffer,
  metadata,
  apiKey,
  model,
}: {
  buffer: Buffer;
  metadata: CandidateFileMetadata;
  apiKey: string;
  model: string;
}): Promise<string> {
  const client = new OpenAI({ apiKey, timeout: 45_000, maxRetries: 1 });
  const file = await toFile(buffer, metadata.fileName, {
    type: metadata.mimeType,
  });
  const response = await client.audio.transcriptions.create({
    file,
    model,
    response_format: "json",
  });
  return response.text;
}

export async function transcribeCandidateAudio(
  buffer: Buffer,
  metadata: CandidateFileMetadata,
  env: NodeJS.ProcessEnv = process.env,
  execute: TranscriptionExecutor = openAiTranscription,
): Promise<CandidateTranscriptionResult> {
  if (!["audio/webm", "audio/mp4"].includes(metadata.mimeType))
    return {
      state: "failed",
      transcript: "",
      provider: null,
      model: null,
      completedAt: new Date(),
    };
  const configuration = transcriptionConfiguration(env);
  if (!configuration)
    return {
      state: "unavailable",
      transcript: "",
      provider: null,
      model: null,
      completedAt: null,
    };
  try {
    const transcript = (await execute({ buffer, metadata, ...configuration }))
      .trim()
      .replace(/\u0000/g, "")
      .slice(0, 20_000);
    if (!transcript)
      return {
        state: "failed",
        transcript: "",
        provider: "openai",
        model: configuration.model,
        completedAt: new Date(),
      };
    return {
      state: "completed",
      transcript,
      provider: "openai",
      model: configuration.model,
      completedAt: new Date(),
    };
  } catch {
    return {
      state: "failed",
      transcript: "",
      provider: "openai",
      model: configuration.model,
      completedAt: new Date(),
    };
  }
}
