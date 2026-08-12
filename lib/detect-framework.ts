export interface FrameworkDetection {
  framework: "react-vite-tailwind-shadcn" | "unknown";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  detected: {
    react: boolean;
    vite: boolean;
    tailwind: boolean;
    shadcn: boolean;
  };
  missing: string[];
}

export function detectFramework(
  packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
  hasComponentsJson = false,
): FrameworkDetection {
  const dependencies = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
  const detected = {
    react: Boolean(dependencies.react),
    vite: Boolean(dependencies.vite),
    tailwind: Boolean(dependencies.tailwindcss),
    shadcn: hasComponentsJson || Object.keys(dependencies).some((name) => name.startsWith("@radix-ui/")),
  };
  const missing = Object.entries(detected).filter(([, value]) => !value).map(([name]) => name === "tailwind" ? "tailwindcss" : name);
  const complete = missing.length === 0;
  const count = Object.values(detected).filter(Boolean).length;
  return {
    framework: complete ? "react-vite-tailwind-shadcn" : "unknown",
    confidence: complete ? "HIGH" : count >= 2 ? "MEDIUM" : "LOW",
    detected,
    missing,
  };
}
