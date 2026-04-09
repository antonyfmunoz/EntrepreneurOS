import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Bot as SmartToy, ArrowRight as ArrowForward, ArrowLeft as KeyboardBackspace, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function ForgotPassword() {
  return (
    <Layout title="ForgotPassword">
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-surface-container-lowest">
        {/* Background Architectural Elements (Visual Planes) */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-[120px]"></div>
          <div className="absolute top-[20%] right-[15%] w-px h-[60%] bg-outline-variant/10 hidden md:block"></div>
          <div className="absolute left-[10%] bottom-[20%] w-[80%] h-px bg-outline-variant/10 hidden md:block"></div>
        </div>

        {/* Main Content Canvas */}
        <main className="relative z-10 w-full max-w-md px-6">
          {/* The Lucid Card */}
          <Card className="glass-panel p-8 rounded-xl ambient-shadow flex flex-col items-center bg-white/70 backdrop-blur-xl border-0">
            {/* Branding / Iconography */}
            <div className="mb-8 w-16 h-16 flex items-center justify-center rounded-xl bg-surface-container-low text-primary">
              <SmartToy className="w-9 h-9" />
            </div>

            {/* Typography Cluster */}
            <header className="text-center mb-8">
              <h1 className="text-[2rem] font-semibold text-on-surface tracking-tight leading-tight mb-3">
                Recover Your Access
              </h1>
              <p className="text-on-surface-variant leading-relaxed text-sm">
                Enter your architectural credentials to receive a reset link.
              </p>
            </header>

            {/* Form Interface */}
            <form className="w-full space-y-6">
              <div className="space-y-2">
                <Label 
                  htmlFor="email" 
                  className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant ml-1"
                >
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@architecture.com"
                  required
                  className="w-full h-14 px-4 rounded-xl bg-surface-container-highest border-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all duration-300"
                />
              </div>

              {/* Success Placeholder (Tonal Layering, No Lines) */}
              <div className="hidden bg-surface-container-low p-4 rounded-xl flex items-start gap-3">
                <CheckCircle className="text-primary text-xl flex-shrink-0" />
                <p className="text-xs text-on-surface-variant leading-normal">
                  If an account exists for this email, you will receive a recovery link shortly. Please check your inbox and spam folder.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-14 bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] text-white font-semibold rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
              >
                Send Reset Link
                <ArrowForward className="w-5 h-5" />
              </Button>
            </form>

            {/* Secondary Navigation */}
            <footer className="mt-8">
              <Link 
                href="/login" 
                className="flex items-center gap-2 text-sm font-medium text-secondary hover:text-primary transition-colors duration-200"
              >
                <KeyboardBackspace className="w-5 h-5" />
                Back to Login
              </Link>
            </footer>
          </Card>

          {/* Decorative Surface Plane */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-full">
              <span className="w-2 h-2 rounded-full bg-primary/40"></span>
              <span className="text-[10px] font-bold text-outline-variant uppercase tracking-[0.2em]">
                Lucid Architecture v4.0
              </span>
            </div>
          </div>
        </main>

        {/* Visual Anchor Background Image (Editorial Style) */}
        <div className="fixed bottom-0 right-0 p-12 opacity-20 pointer-events-none select-none hidden lg:block">
          <img
            alt="Minimalist architectural detail of white geometric concrete structures with clean shadows and ethereal lighting"
            className="w-96 h-96 object-cover rounded-[32px] grayscale contrast-125"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1wD-6eEbEr01AzPN3U1dhvS6HaatxPJScKRDJPnLyAFGpC2uNzjCsCKirLDHKuydC_QZ7a4zvxSIpsvZPLj6A1PC_wgmHp2YYAQZCWN3OYnpX__FcpAndzl4RRV4sG9hxdVwkBoKkVQttxAJ4kibxXI_pCXvTXfJy3JL3zB6Y3_cKyhXu0rHkSogns4LUprUSnqFVA_sGRiYclyQjB2XUDVND1_KfFOYKaQAM8-7yiMve8XLgQluf3cXJJYnoAeIQUx4RTTm4ZCE"
          />
        </div>
      </div>
    </Layout>
  );
}