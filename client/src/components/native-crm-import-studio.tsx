import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileUp, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Contact = { name: string; email: string; phone: string; company: string; title: string; relationshipType: string };
type Json = Record<string, any>;

function commandKey(prefix: string) { return `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`; }
function key(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown"; }
function header(value: string) { return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "); }
function csvLine(line: string) {
  const cells: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; }
    else if (character === "," && !quoted) { cells.push(current.trim()); current = ""; }
    else current += character;
  }
  if (quoted) throw new Error("A CSV row has an unclosed quoted value.");
  cells.push(current.trim()); return cells;
}
function parseContacts(text: string, defaultRelationshipType: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Paste a header row and at least one contact.");
  const headers = csvLine(lines[0]).map(header);
  const at = (aliases: string[]) => headers.findIndex((item) => aliases.includes(item));
  const name = at(["name", "full name", "contact", "contact name", "person"]);
  const email = at(["email", "email address", "work email"]);
  const phone = at(["phone", "phone number", "mobile", "mobile phone"]);
  const company = at(["company", "account", "organization", "business"]);
  const title = at(["title", "job title", "role", "position"]);
  const relationshipType = at(["relationship type", "type", "contact type"]);
  if (name < 0 && email < 0) throw new Error("The CSV needs a Name or Email column.");
  const rows = lines.slice(1).map((line, index) => {
    const values = csvLine(line); const value = (column: number) => column >= 0 ? (values[column] || "").trim() : "";
    const row = { name: value(name), email: value(email).toLowerCase(), phone: value(phone), company: value(company), title: value(title), relationshipType: value(relationshipType).toLowerCase() || defaultRelationshipType };
    if (!row.name && !row.email) throw new Error(`Contact row ${index + 2} needs a name or email.`);
    return row;
  });
  if (rows.length > 200) throw new Error("Import up to 200 contacts at a time so every draft and receipt stays reviewable.");
  return rows;
}

export function NativeCrmImportStudio({ root, canExecute }: { root: string; canExecute: boolean }) {
  const [csvText, setCsvText] = useState("");
  const [relationshipType, setRelationshipType] = useState("prospect");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => {
    try { return csvText.trim() ? parseContacts(csvText, relationshipType) : [] as Contact[]; }
    catch (cause) { return cause instanceof Error ? cause : new Error("The CSV could not be read."); }
  }, [csvText, relationshipType]);
  const contacts = Array.isArray(preview) ? preview : [];
  const importMutation = useMutation({
    mutationFn: async () => {
      const objects: Json[] = []; const links: Json[] = [];
      for (const [index, contact] of Array.from(contacts.entries())) {
        const stable = contact.email ? `email:${key(contact.email)}` : `row:${index + 1}:${key(contact.name)}`;
        const personKey = `legacy-contact:${stable}`;
        const relationshipKey = `legacy-relationship:${stable}:${key(contact.relationshipType)}`;
        objects.push({ instrumentKey: "crm", objectType: "person", objectKey: personKey, title: contact.name || contact.email, summary: contact.email || contact.company || "Imported historical contact.", classification: "confidential", visibility: "team", data: { displayName: contact.name || contact.email, email: contact.email, phone: contact.phone, companyName: contact.company, jobTitle: contact.title, operatingMode: "native_eos" }, sourceReference: { authority: "legacy_company_csv", importKind: "contact", sourceRow: index + 2 } });
        objects.push({ instrumentKey: "crm", objectType: "relationship", objectKey: relationshipKey, title: `${contact.relationshipType} · ${contact.name || contact.email}`, summary: "Imported historical relationship context.", classification: "confidential", visibility: "team", data: { personObjectKey: personKey, relationshipType: contact.relationshipType, importedContactKey: stable, operatingMode: "native_eos" }, sourceReference: { authority: "legacy_company_csv", importKind: "relationship", sourceRow: index + 2 } });
        links.push({ source: { instrumentKey: "crm", objectKey: personKey }, target: { instrumentKey: "crm", objectKey: relationshipKey }, relationshipType: "has_relationship", metadata: { imported: true } });
      }
      return (await apiRequest("POST", `${root}/instrument-imports`, { bundle: { schemaVersion: "eos.instrument-bundle.v1", exportedAt: new Date().toISOString(), objects, links }, conflictStrategy: "skip_existing", idempotencyKey: commandKey("crm-csv-import") })).json();
    },
    onSuccess: async (result: Json) => { setNotice(`${result.imported || 0} CRM drafts created; ${result.skipped || 0} matching source records were preserved.`); setError(""); await queryClient.invalidateQueries({ queryKey: [root] }); },
    onError: (cause: Error) => setError(cause.message),
  });
  const loadFile = async (file?: File) => { if (!file) return; try { setCsvText(await file.text()); setError(""); } catch { setError("EOS could not read this CSV file."); } finally { if (input.current) input.current.value = ""; } };
  return <Card id="native-crm-import" data-testid="native-crm-import-studio">
    <CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" />Historical CRM migration</CardTitle><CardDescription>Bring an existing company’s contacts into native EOS without connecting a CRM. EOS creates reviewable drafts and never overwrites a matching prior source record.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {error && <Alert variant="destructive"><AlertTitle>Migration not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {notice && <Alert><AlertTitle>Migration recorded</AlertTitle><AlertDescription>{notice}</AlertDescription></Alert>}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]"><div><Label htmlFor="crm-import-file">CSV file</Label><div className="mt-1 flex gap-2"><input ref={input} id="crm-import-file" type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void loadFile(event.target.files?.[0])}/><Button type="button" variant="outline" onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />Choose CSV</Button><span className="self-center text-xs text-muted-foreground">or paste below</span></div></div><div><Label htmlFor="crm-import-default-type">Default relationship</Label><select id="crm-import-default-type" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}>{["prospect", "customer", "partner", "vendor", "candidate"].map((value) => <option key={value}>{value}</option>)}</select></div></div>
      <Textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} className="min-h-36 font-mono text-xs" placeholder={'Name,Email,Phone,Company,Title\nAda Lovelace,ada@example.com,555-0100,Analytical Engines,Founder'} aria-label="CRM contact CSV" />
      {preview instanceof Error ? <p className="text-sm text-destructive">{preview.message}</p> : <div className="rounded-xl border bg-muted/20 p-3"><p className="font-medium">{contacts.length} contact{contacts.length === 1 ? "" : "s"} ready for reviewable draft import</p><p className="mt-1 text-xs text-muted-foreground">Recognized headers: Name, Email, Phone, Company, Title, and Relationship Type. Each contact produces a native person and relationship draft linked together. Existing records from the same CSV identity are skipped; EOS does not claim provider reconciliation.</p>{contacts.slice(0, 4).map((contact, index) => <p key={`${contact.email}-${index}`} className="mt-2 text-xs">{contact.name || contact.email} · {contact.email || "No email"} · {contact.relationshipType}</p>)}</div>}
      <Button disabled={!canExecute || !contacts.length || preview instanceof Error || importMutation.isPending} onClick={() => importMutation.mutate()}>{importMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Import as native CRM drafts</Button>
    </CardContent>
  </Card>;
}
