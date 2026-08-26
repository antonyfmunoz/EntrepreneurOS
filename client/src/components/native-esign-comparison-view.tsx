import { FileDiff, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type DiffOperation = { type: "equal" | "insert" | "delete"; lines: string[] };

export type NativeEsignComparison = {
  comparisonType: "operator_declared" | "generated_text";
  comparisonSha256: string;
  revisionSummary: string;
  declaredChanges: string[];
  sourceSha256: string;
  targetSha256: string;
  sourceTextSha256: string;
  targetTextSha256: string;
  diffStats?: { equalLines?: number; insertedLines?: number; deletedLines?: number; operationCount?: number };
  structuredDiff?: { schemaVersion?: string; granularity?: string; exact?: boolean; algorithm?: string; operations?: DiffOperation[] };
};

function Hash({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return <p className="min-w-0"><span className="text-muted-foreground">{label}</span> <code className="break-all">{value}</code></p>;
}

export function NativeEsignComparisonView({ comparison }: { comparison: NativeEsignComparison }) {
  const exact = comparison.comparisonType === "generated_text" && comparison.structuredDiff?.exact === true;
  const operations = Array.isArray(comparison.structuredDiff?.operations) ? comparison.structuredDiff.operations : [];
  const stats = comparison.diffStats;

  return <section className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4" aria-label="Replacement agreement comparison">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><FileDiff className="h-4 w-4 text-primary"/><h3 className="font-semibold">Replacement agreement comparison</h3></div>
        <p className="mt-1 text-sm text-muted-foreground">{comparison.revisionSummary}</p>
      </div>
      <Badge variant={exact ? "default" : "outline"}>{exact ? "Exact generated-text diff" : "Operator-declared changes"}</Badge>
    </div>

    {stats && exact ? <div className="grid grid-cols-3 gap-2 text-center text-xs">
      <div className="rounded-lg border bg-background p-2"><strong className="block text-base text-destructive">{stats.deletedLines || 0}</strong>deleted</div>
      <div className="rounded-lg border bg-background p-2"><strong className="block text-base text-emerald-700 dark:text-emerald-400">{stats.insertedLines || 0}</strong>inserted</div>
      <div className="rounded-lg border bg-background p-2"><strong className="block text-base">{stats.equalLines || 0}</strong>unchanged</div>
    </div> : null}

    {exact ? <details className="rounded-lg border bg-background" open>
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Review exact line changes</summary>
      <div className="max-h-80 overflow-auto border-t p-2 font-mono text-xs" data-testid="native-esign-exact-comparison">
        {operations.length ? operations.flatMap((operation, operationIndex) => operation.lines.map((line, lineIndex) => {
          const prefix = operation.type === "insert" ? "+" : operation.type === "delete" ? "−" : " ";
          const tone = operation.type === "insert" ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200" : operation.type === "delete" ? "bg-destructive/10 text-destructive" : "text-muted-foreground";
          return <div key={`${operationIndex}-${lineIndex}`} className={`whitespace-pre-wrap break-words px-2 py-0.5 ${tone}`}><span aria-hidden="true" className="mr-2 select-none">{prefix}</span>{line || " "}</div>;
        })) : <p className="p-2 text-muted-foreground">No changed lines were recorded between these generated versions.</p>}
      </div>
    </details> : <Alert>
      <ShieldAlert className="h-4 w-4"/>
      <AlertTitle>Uploaded PDF comparison boundary</AlertTitle>
      <AlertDescription>EOS sealed the operator's declared change list and both PDF hashes. It cannot claim an exact semantic redline for an arbitrary uploaded PDF.</AlertDescription>
    </Alert>}

    {!exact && comparison.declaredChanges.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{comparison.declaredChanges.map((change, index) => <li key={`${index}-${change}`}>{change}</li>)}</ul> : null}

    <details className="rounded-lg border bg-background p-3 text-xs">
      <summary className="cursor-pointer font-medium">Immutable comparison receipt</summary>
      <div className="mt-3 space-y-2">
        <Hash label="Comparison" value={comparison.comparisonSha256}/>
        <Hash label="Prior PDF" value={comparison.sourceSha256}/>
        <Hash label="Replacement PDF" value={comparison.targetSha256}/>
        <Hash label="Prior text" value={comparison.sourceTextSha256}/>
        <Hash label="Replacement text" value={comparison.targetTextSha256}/>
      </div>
    </details>
    <p className="text-xs text-muted-foreground">This comparison is evidence of the recorded text change, not legal advice, legal interpretation, or approval of the agreement.</p>
  </section>;
}
