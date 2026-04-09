import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { Bot, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Signup() {
  return (
    <Layout title="Signup">
      <div className="min-h-screen flex flex-col items-center justify-center selection:bg-primary-fixed selection:text-primary overflow-x-hidden bg-background">
        <main className="flex-grow flex items-center justify-center w-full px-6 py-12">
          <div className="w-full max-w-[480px] flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] flex items-center justify-center shadow-[0_8px_32px_rgba(106,55,212,0.08)] transform transition-transform duration-300 group-hover:scale-105">
                <Bot className="text-white w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-primary">Lucid</h2>
            </div>

            <div className="bg-white/70 backdrop-blur-[16px] shadow-[0_8px_32px_rgba(106,55,212,0.08)] rounded-xl p-8 w-full">
              <header className="mb-8 text-center">
                <h1 className="text-3xl font-semibold tracking-tight text-on-surface mb-2">Join the Architecture</h1>
                <p className="text-on-surface-variant leading-relaxed text-sm">Experience the clarity of vision with our automated insights engine.</p>
              </header>

              <form className="space-y-6">
                <Alert className="hidden flex items-center gap-3 p-4 bg-error-container/30 rounded-lg text-on-error-container text-sm border-none">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Mail already exists. Please try another or sign in.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="block text-[0.75rem] font-semibold tracking-wider text-on-surface-variant uppercase ml-1">
                      Full Name
                    </Label>
                    <Input
                      type="text"
                      placeholder="John Architect"
                      className="w-full px-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline-variant"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="block text-[0.75rem] font-semibold tracking-wider text-on-surface-variant uppercase ml-1">
                      Mail Address
                    </Label>
                    <Input
                      type="email"
                      placeholder="hello@lucid.design"
                      className="w-full px-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline-variant"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="block text-[0.75rem] font-semibold tracking-wider text-on-surface-variant uppercase ml-1">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="w-full px-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline-variant"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 px-1">
                    <div className="flex gap-1.5 h-1">
                      <div className="flex-1 bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] rounded-full"></div>
                      <div className="flex-1 bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] rounded-full"></div>
                      <div className="flex-1 bg-surface-container-high rounded-full"></div>
                      <div className="flex-1 bg-surface-container-high rounded-full"></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[0.75rem] text-on-surface-variant">Security: Medium</span>
                      <span className="text-[0.75rem] text-primary font-medium cursor-pointer hover:underline">Tips</span>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full py-4 px-6 bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] text-white font-semibold rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  Create Account
                </Button>

                <div className="pt-4 text-center">
                  <p className="text-on-surface-variant text-sm">
                    Already have an account?
                    <Link href="/signin">
                      <a className="text-primary font-semibold hover:text-primary-container transition-colors ml-1">Sign In</a>
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </main>

        <footer className="flex flex-col md:flex-row justify-center items-center gap-6 w-full py-8 mt-auto bg-transparent font-inter leading-relaxed text-sm">
          <div className="text-slate-400 dark:text-slate-500">
            © 2024 Lucid Architecture. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a className="text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-300 transition-all opacity-80 hover:opacity-100" href="#">Terms</a>
            <a className="text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-300 transition-all opacity-80 hover:opacity-100" href="#">Privacy</a>
            <a className="text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-300 transition-all opacity-80 hover:opacity-100" href="#">Support</a>
          </div>
        </footer>

        <div className="fixed -z-10 top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary-container/5 blur-[120px]"></div>
        <div className="fixed -z-10 bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-container/5 blur-[120px]"></div>
      </div>
    </Layout>
  );
}