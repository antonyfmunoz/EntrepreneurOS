// AUTO-GENERATED — removed after build completes
import { useState, useEffect } from "react";

interface BuildStatus {
  phase: "shared-components" | "pages";
  total: number;
  completed: string[];
  current: string | null;
  failed: string[];
}

export function BuildStatusOverlay() {
  const [status, setStatus] = useState<BuildStatus | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/build-status.json?" + Date.now());
        if (res.ok) {
          setStatus(await res.json());
        } else {
          setStatus(null);
        }
      } catch {
        setStatus(null);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  const pct = status.total > 0
    ? Math.round((status.completed.length / status.total) * 100)
    : 0;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      width: 320,
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(16px)",
      borderRadius: 12,
      padding: 20,
      boxShadow: "0 8px 32px rgba(106,55,212,0.12)",
      fontFamily: "system-ui, sans-serif",
      fontSize: 13,
      color: "#2c2f30",
      zIndex: 99999,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        Building {status.phase === "shared-components" ? "shared components" : "pages"}...
      </div>
      <div style={{
        height: 6,
        borderRadius: 3,
        background: "#eff1f2",
        marginBottom: 8,
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: pct + "%",
          background: "#6a37d4",
          borderRadius: 3,
          transition: "width 0.3s ease",
        }} />
      </div>
      <div style={{ color: "#595c5d" }}>
        {status.current ? `Generating: ${status.current}` : `${status.completed.length}/${status.total} complete`}
      </div>
      {status.failed.length > 0 && (
        <div style={{ color: "#dc2626", marginTop: 4 }}>
          Failed: {status.failed.join(", ")}
        </div>
      )}
    </div>
  );
}
