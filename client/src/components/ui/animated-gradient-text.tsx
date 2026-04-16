import { type ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

export interface AnimatedGradientTextProps extends ComponentPropsWithoutRef<"span"> {
  speed?: number
  colorFrom?: string
  colorTo?: string
}

export function AnimatedGradientText({
  children,
  className,
  speed = 1,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  ...props
}: AnimatedGradientTextProps) {
  return (
    <span
      style={
        {
          "--bg-size": `${speed * 300}%`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          backgroundSize: "var(--bg-size) 100%",
          backgroundImage: `linear-gradient(to right, ${colorFrom}, ${colorTo}, ${colorFrom})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: `animated-gradient ${3 / speed}s linear infinite`,
        } as React.CSSProperties
      }
      className={cn("inline", className)}
      {...props}
    >
      {children}
    </span>
  )
}
