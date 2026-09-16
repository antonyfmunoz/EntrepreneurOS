export type ParsedTeamRosterRow = {
  name: string;
  email: string;
  sourceTitle: string;
  reportsTo: string;
};

const headerAliases: Record<keyof ParsedTeamRosterRow, string[]> = {
  name: ["name", "full name", "employee", "employee name", "person"],
  email: ["email", "work email", "email address", "company email"],
  sourceTitle: ["title", "current title", "job title", "role", "position"],
  reportsTo: ["reports to", "manager", "manager name", "supervisor", "supervisor name"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (quoted) throw new Error("One of the roster rows has an unclosed quoted value.");
  values.push(current.trim());
  return values;
}

function indexForHeader(headers: string[], field: keyof ParsedTeamRosterRow) {
  return headers.findIndex((header) => headerAliases[field].includes(normalizeHeader(header)));
}

/**
 * Parses a user-pasted, comma-separated team export. It deliberately only
 * extracts identity and reporting context; callers decide whether and how to
 * map people into EOS seats. No access or invitation action is implied.
 */
export function parseTeamRosterCsv(text: string): ParsedTeamRosterRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Paste a header row and at least one team member.");

  const headers = parseCsvLine(lines[0]);
  const nameIndex = indexForHeader(headers, "name");
  const emailIndex = indexForHeader(headers, "email");
  const titleIndex = indexForHeader(headers, "sourceTitle");
  const managerIndex = indexForHeader(headers, "reportsTo");
  if (nameIndex < 0 && emailIndex < 0)
    throw new Error("The roster needs a Name or Work email column.");

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const valueAt = (column: number) => (column >= 0 ? (cells[column] || "").trim() : "");
    const row = {
      name: valueAt(nameIndex),
      email: valueAt(emailIndex),
      sourceTitle: valueAt(titleIndex),
      reportsTo: valueAt(managerIndex),
    };
    if (!row.name && !row.email)
      throw new Error(`Roster row ${index + 2} needs a name or work email.`);
    return row;
  });
}

export function normalizedRosterRole(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
