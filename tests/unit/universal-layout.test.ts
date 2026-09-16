import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(
  new URL(
    "../../client/src/components/layout/universal-layout.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("universal workspace layout", () => {
  it("keeps an expanded decision HUD from covering a deep workspace section", () => {
    expect(layout).toContain('const workspaceRef = useRef<HTMLElement>(null)');
    expect(layout).toContain('onExpandedChange: handleFloatingPanelExpandedChange');
    expect(layout).toContain('workspace.scrollTop > 4');
    expect(layout).toContain('reserveExpandedHudClearance ? "h-32 sm:h-36" : "h-3"');
  });

  it("places the left-rail control in navigation above Home instead of on the rail edge", () => {
    expect(layout).toContain('<RailToggle side="left" collapsed={left.collapsed} onClick={left.toggle} variant="navigation" />');
    expect(layout).toContain('{leadingAction && <li>{leadingAction}</li>}');
    expect(layout).not.toContain('<RailToggle side="left" collapsed={left.collapsed} onClick={left.toggle} />');
  });
});
