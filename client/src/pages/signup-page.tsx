import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Bot, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function SignupPage() {
  const passwordStrength: number = 2;
  const showError: boolean = false;

  return (
    <Layout title="Signup">
      <div className="min-h-screen flex flex-col items-center justify-center bg-background selection:bg-primary-fixed selection:text-primary overflow-x-hidden">
        <main className="flex-grow flex items-center justify-center w-full px-6 py-12">
          <div className="w-full max-w-[480px] flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] flex items-center justify-center shadow-[0_8px_32px_rgba(106,55,212,0.08)] transform transition-transform duration-300 group-hover:scale-105">
                <Bot className="text-white" size={32} fill="white" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-primary">Lucid</h2>
            </div>

            <div className="bg-white/70 backdrop-blur-2xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] rounded-xl p-8 w-full">
              <header className="mb-8 text-center">
                <h1 className="text-3xl font-semibold tracking-tight text-on-surface mb-2">Join the Architecture</h1>
                <p className="text-on-surface-variant leading-relaxed text-sm">Experience the clarity of vision with our automated insights engine.</p>
              </header>

              <form className="space-y-6">
                {showError && (
                  <Alert className="flex items-center gap-3 p-4 bg-error-container/30 border-none rounded-lg">
                    <AlertCircle className="h-4 w-4 text-on-error-container" />
                    <p className="text-on-error-container text-sm">Email already exists. Please try another or sign in.</p>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="block text-[0.75rem] font-semibold tracking-wider text-on-surface-variant uppercase ml-1">
                      Full Name
                    </Label>
                    <Input
                      type="text"
                      placeholder="John Architect"
                      className="w-full px-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline-variant h-auto"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="block text-[0.75rem] font-semibold tracking-wider text-on-surface-variant uppercase ml-1">
                      Email Address
                    </Label>
                    <Input
                      type="email"
                      placeholder="hello@lucid.design"
                      className="w-full px-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline-variant h-auto"
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
                        className="w-full px-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline-variant h-auto"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 px-1">
                    <div className="flex gap-1.5 h-1">
                      {[0, 1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className={`flex-1 rounded-full ${
                            index < passwordStrength
                              ? "bg-gradient-to-br from-[#6a37d4] to-[#ae8dff]"
                              : "bg-surface-container-high"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[0.75rem] text-on-surface-variant">Security: Medium</span>
                      <span className="text-[0.75rem] text-primary font-medium cursor-pointer hover:underline">Tips</span>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full py-4 px-6 bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] text-white font-semibold rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 h-auto"
                >
                  Create Account
                </Button>

                <div className="pt-4 text-center">
                  <p className="text-on-surface-variant text-sm">
                    Already have an account?
                    <Link href="#" className="text-primary font-semibold hover:text-primary-container transition-colors ml-1">
                      Sign In
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </main>

        <footer className="flex flex-col md:flex-row justify-center items-center gap-6 w-full py-8 mt-auto bg-transparent leading-relaxed text-sm">
          <div className="text-slate-400 dark:text-slate-500">
            © 2024 Lucid Architecture. All rights reserved.
          </div>
          <div className="flex gap-6">
            <Link href="#" className="text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-300 transition-all opacity-80 hover:opacity-100">
              Terms
            </Link>
            <Link href="#" className="text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-300 transition-all opacity-80 hover:opacity-100">
              Privacy
            </Link>
            <Link href="#" className="text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-300 transition-all opacity-80 hover:opacity-100">
              Support
            </Link>
          </div>
        </footer>

        <div className="fixed -z-10 top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary-container/5 blur-[120px]" />
        <div className="fixed -z-10 bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-container/5 blur-[120px]" />
      </div>
    </Layout>
  );
}