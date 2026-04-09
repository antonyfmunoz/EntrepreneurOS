import { readFile, writeFile } from "fs/promises";
import type { NavInjectionInput } from "./types.js";

// Inserts a new nav item <li> block into sidebar.tsx before the closing </ul> of the space-y-2 list.
// Uses string-based insertion — sidebar.tsx has a predictable, stable nav list structure.
// Per Research Pitfall 7: uses remixicon class strings (ri-*), not Lucide React components.
export async function injectNavItem(input: NavInjectionInput): Promise<void> {
  let content = await readFile(input.sidebarPath, "utf-8");

  // Idempotency: if a Link with this href is already wired into the sidebar,
  // skip the injection. Re-running integration must be a no-op for any nav
  // item that is already in place.
  const existingHrefRe = new RegExp(
    `<Link\\s+href=["']${input.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
  );
  if (existingHrefRe.test(content)) {
    return;
  }

  // Build nav item JSX following the exact existing sidebar.tsx pattern:
  // Link > div with cn() > i.ri-icon-class > span
  const navItemJsx = `        <li>
          <Link href="${input.href}">
            <div className={cn(
              "flex items-center space-x-2 p-2 rounded-md cursor-pointer",
              location === "${input.href}"
                ? "bg-blue-50 text-primary font-medium"
                : "hover:bg-gray-100 text-gray-700"
            )}>
              <i className="${input.iconClass}"></i>
              <span>${input.label}</span>
            </div>
          </Link>
        </li>`;

  // Find the <ul className="space-y-2"> nav list open tag
  const ulOpenPattern = /<ul className="space-y-2">/;
  const ulOpenMatch = content.match(ulOpenPattern);
  if (!ulOpenMatch || ulOpenMatch.index === undefined) {
    throw new Error('Cannot find <ul className="space-y-2"> in sidebar.tsx');
  }

  // Find the matching </ul> after the open tag
  const searchStart = ulOpenMatch.index + ulOpenMatch[0].length;
  const closingUlIndex = content.indexOf("</ul>", searchStart);
  if (closingUlIndex === -1) {
    throw new Error("Cannot find closing </ul> for nav list in sidebar.tsx");
  }

  // Insert before the closing </ul> — find line start of the closing tag
  const lineStart = content.lastIndexOf("\n", closingUlIndex);
  content =
    content.slice(0, lineStart + 1) +
    navItemJsx +
    "\n" +
    content.slice(lineStart + 1);

  await writeFile(input.sidebarPath, content, "utf-8");
}
