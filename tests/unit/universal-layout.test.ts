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
    expect(layout).toContain('const [expandedHudClearance, setExpandedHudClearance] = useState(0)');
    expect(layout).toContain('new ResizeObserver(updateClearance)');
    expect(layout).toContain('height - collapsedHeight + 12');
    expect(layout).toContain('height: `${Math.max(12, expandedHudClearance)}px`');
  });

  it("places the left-rail control in navigation above Home instead of on the rail edge", () => {
    expect(layout).toContain('<RailToggle side="left" collapsed={left.collapsed} onClick={left.toggle} variant="navigation" />');
    expect(layout).toContain('{leadingAction && <li className="mb-2 border-b border-border/60 pb-2">{leadingAction}</li>}');
    expect(layout).not.toContain('<RailToggle side="left" collapsed={left.collapsed} onClick={left.toggle} />');
  });
});
