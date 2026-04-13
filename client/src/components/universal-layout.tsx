import * as React from "react"
import { Header } from "@/components/header"
import { LeftRail } from "@/components/left-rail"
import { RightRail } from "@/components/right-rail"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface UniversalLayoutProps {
  children: React.ReactNode
  rightRail?: React.ReactNode
  showRightRail?: boolean
  className?: string
}

export function UniversalLayout({
  children,
  rightRail,
  showRightRail = false,
  className = "",
}: UniversalLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [mobileMenuOpen])

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f5f6f7] flex flex-col">
      <Header />

      <div className="flex-1 flex overflow-hidden relative">
        <div className="hidden lg:block">
          <LeftRail />
        </div>

        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 lg:hidden animate-in slide-in-from-left duration-300">
              <div className="h-full bg-[#eff1f2] shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
                <div className="flex items-center justify-between px-6 h-16 border-b border-[#abadae]/20">
                  <span className="font-semibold text-[#2c2f30] text-base">Menu</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(false)}
                    className="h-8 w-8"
                  >
                    <X className="h-5 w-5 text-[#595c5d]" />
                  </Button>
                </div>
                <LeftRail />
              </div>
            </div>
          </>
        )}

        <main className={`flex-1 overflow-y-auto ${className}`}>
          <div className="lg:hidden fixed top-20 left-4 z-30">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="h-10 w-10 rounded-[12px] bg-white/70 backdrop-blur-[16px] shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:bg-white/90"
            >
              <Menu className="h-5 w-5 text-[#2c2f30]" />
            </Button>
          </div>

          <div className="h-full w-full">
            {children}
          </div>
        </main>

        {showRightRail && rightRail && (
          <div className="hidden xl:block">
            <RightRail>
              {rightRail}
            </RightRail>
          </div>
        )}
      </div>
    </div>
  )
}

export default UniversalLayout