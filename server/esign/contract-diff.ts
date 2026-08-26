import { createHash } from "node:crypto";

export type NativeContractDiffOperation = {
  type: "equal" | "insert" | "delete";
  lines: string[];
};

export type NativeContractTextDiff = {
  schemaVersion: "eos-native-esign-text-diff.v1";
  granularity: "line";
  exact: true;
  algorithm: "lcs" | "bounded-prefix-suffix";
  sourceTextSha256: string;
  targetTextSha256: string;
  stats: {
    equalLines: number;
    insertedLines: number;
    deletedLines: number;
    operationCount: number;
  };
  operations: NativeContractDiffOperation[];
};

const MAX_LCS_CELLS = 2_000_000;

function normalizeContractText(input: { title: string; body: string }): string {
  return `${input.title.trim()}\n\n${input.body.replace(/\r\n?/g, "\n").trim()}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function append(operations: NativeContractDiffOperation[], type: NativeContractDiffOperation["type"], line: string): void {
  const previous = operations.at(-1);
  if (previous?.type === type) previous.lines.push(line);
  else operations.push({ type, lines: [line] });
}

function lcsOperations(source: string[], target: string[]): NativeContractDiffOperation[] {
  const width = target.length + 1;
  const table = new Uint32Array((source.length + 1) * width);
  for (let sourceIndex = source.length - 1; sourceIndex >= 0; sourceIndex -= 1) {
    for (let targetIndex = target.length - 1; targetIndex >= 0; targetIndex -= 1) {
      const offset = sourceIndex * width + targetIndex;
      table[offset] = source[sourceIndex] === target[targetIndex]
        ? table[(sourceIndex + 1) * width + targetIndex + 1] + 1
        : Math.max(table[(sourceIndex + 1) * width + targetIndex], table[sourceIndex * width + targetIndex + 1]);
    }
  }
  const operations: NativeContractDiffOperation[] = [];
  let sourceIndex = 0;
  let targetIndex = 0;
  while (sourceIndex < source.length && targetIndex < target.length) {
    if (source[sourceIndex] === target[targetIndex]) {
      append(operations, "equal", source[sourceIndex]);
      sourceIndex += 1;
      targetIndex += 1;
    } else if (table[(sourceIndex + 1) * width + targetIndex] >= table[sourceIndex * width + targetIndex + 1]) {
      append(operations, "delete", source[sourceIndex]);
      sourceIndex += 1;
    } else {
      append(operations, "insert", target[targetIndex]);
      targetIndex += 1;
    }
  }
  while (sourceIndex < source.length) append(operations, "delete", source[sourceIndex++]);
  while (targetIndex < target.length) append(operations, "insert", target[targetIndex++]);
  return operations;
}

function boundedOperations(source: string[], target: string[]): NativeContractDiffOperation[] {
  let prefix = 0;
  while (prefix < source.length && prefix < target.length && source[prefix] === target[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < source.length - prefix && suffix < target.length - prefix && source[source.length - suffix - 1] === target[target.length - suffix - 1]) suffix += 1;
  const operations: NativeContractDiffOperation[] = [];
  for (const line of source.slice(0, prefix)) append(operations, "equal", line);
  for (const line of source.slice(prefix, source.length - suffix)) append(operations, "delete", line);
  for (const line of target.slice(prefix, target.length - suffix)) append(operations, "insert", line);
  for (const line of source.slice(source.length - suffix)) append(operations, "equal", line);
  return operations;
}

export function compareNativeContractText(sourceInput: { title: string; body: string }, targetInput: { title: string; body: string }): NativeContractTextDiff {
  const sourceText = normalizeContractText(sourceInput);
  const targetText = normalizeContractText(targetInput);
  const source = sourceText.split("\n");
  const target = targetText.split("\n");
  const useLcs = source.length * target.length <= MAX_LCS_CELLS;
  const operations = useLcs ? lcsOperations(source, target) : boundedOperations(source, target);
  const count = (type: NativeContractDiffOperation["type"]) => operations.filter((operation) => operation.type === type).reduce((total, operation) => total + operation.lines.length, 0);
  return {
    schemaVersion: "eos-native-esign-text-diff.v1",
    granularity: "line",
    exact: true,
    algorithm: useLcs ? "lcs" : "bounded-prefix-suffix",
    sourceTextSha256: sha256(sourceText),
    targetTextSha256: sha256(targetText),
    stats: { equalLines: count("equal"), insertedLines: count("insert"), deletedLines: count("delete"), operationCount: operations.length },
    operations,
  };
}
