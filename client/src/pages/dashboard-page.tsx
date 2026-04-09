import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import { Bot, Bell, Settings, FileBox, Users, Upload, CheckSquare, History, HelpCircle, LogOut, CloudUpload, Languages, Eye, FileText, Info, Sparkles, X, Plus } from "lucide-react";

interface ValidationItem {
  id: string;
  label: string;
  progress: number;
  color: string;
}

const validationItems: ValidationItem[] = [
  { id: "1", label: "Logic Consistency", progress: 0, color: "bg-slate-300" },
  { id: "2", label: "Asset Requirements", progress: 0, color: "bg-slate-300" },
  { id: "3", label: "Accessibility Coverage", progress: 0, color: "bg-slate-300" }
];

interface NavItem {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

const sideNavItems: NavItem[] = [
  { icon: <Bot className="w-5 h-5" />, label: "Editor", active: true },
  { icon: <Users className="w-5 h-5" />, label: "Collaborate" },
  { icon: <Upload className="w-5 h-5" />, label: "Files" },
  { icon: <CheckSquare className="w-5 h-5" />, label: "Validation" },
  { icon: <History className="w-5 h-5" />, label: "History" }
];

export default function LayoutDashboard() {
  return (
    <Layout title="LayoutDashboard">
      <div className="flex h-screen">
        {/* TopNavBar */}
        <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-lg flex justify-between items-center px-8 h-16 shadow-[0_20px_50px_rgba(82,16,188,0.05)]">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-[#5210bc] fill-current" />
              <span className="text-xl font-bold text-[#5210bc] tracking-tight">SpecInput</span>
            </div>
            <div className="hidden md:flex gap-6">
              <Link href="/dashboard">
                <a className="text-slate-500 font-medium hover:text-[#6a37d4] transition-colors duration-200">
                  LayoutDashboard
                </a>
              </Link>
              <Link href="/projects">
                <a className="text-[#5210bc] font-semibold border-b-2 border-[#5210bc] transition-colors duration-200">
                  Projects
                </a>
              </Link>
              <Link href="/templates">
                <a className="text-slate-500 font-medium hover:text-[#6a37d4] transition-colors duration-200">
                  Templates
                </a>
              </Link>
              <Link href="/archive">
                <a className="text-slate-500 font-medium hover:text-[#6a37d4] transition-colors duration-200">
                  Archive
                </a>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-[#6a37d4]">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-[#6a37d4]">
              <Settings className="w-5 h-5" />
            </Button>
            <Avatar className="w-8 h-8">
              <AvatarImage src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5qZkldo-vyxmxMD8Hu8P4-5ifOLmaQbIRzBl8pklQhk14VY-05a6WEZ7L-C_xA0zvbwXlpJsGbBLeeLisEavtZqc7uFWNpudJ_IrcsuYtcWj_72GbJ07RdRUSU3hBHapl7fpp2rGxTUC3EC0D_ia9k190loJFDRebuKR4x43x9nU_-u5HuL0QCkfJmuDCrS9IpGjdsO-fr0j4wXvp3j4-TyoSsNgu7bH6hGtRhQRNtk9wZkmDXMqBtvoRLJ14Zm89hkHrjKAZ-xo" alt="User profile" />
              <AvatarFallback>PM</AvatarFallback>
            </Avatar>
          </div>
        </nav>

        <div className="flex w-full pt-16">
          {/* SideNavBar */}
          <aside className="h-[calc(100vh-4rem)] w-64 bg-slate-50/50 backdrop-blur-md flex flex-col py-6 px-4 gap-4 hidden lg:flex">
            <div className="mb-6 px-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-[#6a37d4] flex items-center justify-center text-white">
                  <FileBox className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-inter uppercase tracking-widest text-[10px] text-slate-400">Project Alpha</p>
                  <p className="text-xs font-semibold text-[#191c1d]">Specification Phase</p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              {sideNavItems.map((item, index) => (
                <button
                  key={index}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                    item.active
                      ? "bg-white/80 text-[#5210bc] shadow-sm"
                      : "text-slate-600 hover:bg-slate-200/30"
                  }`}
                >
                  {item.icon}
                  <span className="font-inter uppercase tracking-widest text-[10px]">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 px-2">
              <Button className="w-full bg-gradient-to-r from-[#5210bc] to-[#6a37d4] text-white py-2 rounded-full font-semibold text-xs tracking-wide shadow-lg shadow-[#5210bc]/20">
                <Plus className="w-4 h-4 mr-2" />
                New Spec
              </Button>
            </div>

            <div className="mt-auto space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-200/30 rounded-lg transition-all duration-300">
                <HelpCircle className="w-5 h-5" />
                <span className="font-inter uppercase tracking-widest text-[10px]">Support</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-200/30 rounded-lg transition-all duration-300">
                <LogOut className="w-5 h-5" />
                <span className="font-inter uppercase tracking-widest text-[10px]">Sign Out</span>
              </button>
            </div>
          </aside>

          {/* Main Content Area: Split-Screen Layout */}
          <main className="flex-1 flex overflow-hidden">
            {/* Left Side: SpecEditor Section */}
            <section className="flex-1 flex flex-col bg-[#f8f9fa] p-8 overflow-hidden">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight text-[#191c1d] mb-2">SpecEditor</h1>
                  <p className="text-[#494454] text-sm font-medium">Draft the architectural blueprint for your next module.</p>
                </div>
                <div className="flex gap-4">
                  <Button className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#e7e8e9] text-[#191c1d] font-semibold text-sm hover:bg-[#e1e3e4]">
                    <CloudUpload className="w-[18px] h-[18px]" />
                    Upload
                  </Button>
                  <Button className="flex items-center gap-2 px-6 py-2 rounded-full bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] text-white font-bold text-sm shadow-xl shadow-[#5210bc]/10 hover:opacity-90 active:scale-95 transition-all">
                    <Languages className="w-[18px] h-[18px]" />
                    Parse Spec
                  </Button>
                </div>
              </div>

              <div className="flex-1 relative flex flex-col group">
                <div className="flex-1 bg-white rounded-3xl p-6 shadow-sm border-0 focus-within:shadow-[0_0_40px_rgba(82,16,188,0.08)] transition-all duration-500 overflow-hidden flex flex-col">
                  <Textarea
                    className="flex-1 bg-transparent border-none focus-visible:ring-0 text-[#191c1d] leading-relaxed resize-none text-lg font-light placeholder:text-[#7b7486]/60"
                    placeholder='Paste your spec here or click "Start guided spec creation" to build collaboratively'
                  />
                </div>

                {/* CollaborativeAssistant Mini-Panel (Floating) */}
                <div className="absolute bottom-6 right-6 backdrop-blur-md bg-white/40 p-4 rounded-2xl shadow-xl flex items-center gap-4 group-focus-within:translate-y-0 translate-y-2 opacity-0 group-focus-within:opacity-100 transition-all duration-500">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      <Avatar className="w-6 h-6 border-2 border-white">
                        <AvatarImage src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIjtULskoYHHqh-afzd06lnlsqsNZllDM1XEvCzMg5nQmym7REEZXgMk5Uilaqtjx-JlA6xUHyUkNw1ok0mfjAj8vfC7eFcRtq5bpDk5ucj34E-R7kWtbLD7yP3w9o_mrMl-vvDN4wvpxfN5WayfFsh4KXYu8yb4KWm_CyxncQLABHF7kj2Kkgmy1l_-vBmdwzNOPRaGeuZscnfpHvgld6apQ4XMUhQ7wY-d6PszeiIKC2Ay52BtkJ8xIn3E2A1S8nNMKMzYqQFns" alt="Avatar" />
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                      <div className="w-6 h-6 rounded-full border-2 border-white bg-[#6a37d4] flex items-center justify-center">
                        <Bot className="w-3 h-3 text-white fill-current" />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#5210bc]">SpecAI Assistant</span>
                  </div>
                  <Button className="bg-[#5210bc] px-3 py-1.5 rounded-full text-white text-[10px] font-bold tracking-wider uppercase shadow-md shadow-[#5210bc]/20 hover:scale-105 active:scale-95 transition-transform">
                    Start Guided Creation
                  </Button>
                </div>
              </div>
            </section>

            {/* Right Side: Live SpecPreview & Validation */}
            <section className="w-[450px] bg-[#f2f4f5] flex flex-col overflow-hidden">
              <div className="h-full p-8 flex flex-col gap-6">
                {/* SpecPreview (Empty State Visualization) */}
                <div className="flex-1 bg-white rounded-3xl p-6 shadow-sm flex flex-col relative overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400">Live Preview</span>
                    <Eye className="w-5 h-5 text-[#7b7486]" />
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-[#f2f4f5] flex items-center justify-center mb-4">
                      <FileText className="w-8 h-8 text-[#7b7486]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#191c1d] mb-2">No Content Yet</h3>
                    <p className="text-sm text-[#494454] max-w-[200px]">Start typing on the left to see your document take shape as functional units.</p>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#5210bc]/5 rounded-full blur-3xl"></div>
                </div>

                {/* ValidationFeedback */}
                <div className="h-64 bg-[#e1e3e4] rounded-3xl p-6 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500">Validation &amp; Health</span>
                    <div className="flex-1 h-[1px] bg-[#7b7486]/20"></div>
                  </div>
                  <div className="space-y-4">
                    {validationItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 bg-white/50 p-3 rounded-2xl">
                        <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-400">{item.label}</p>
                          <Progress value={item.progress} className="h-1 mt-1 bg-slate-200" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between text-[10px] font-medium text-slate-400">
                    <span>Last updated: Just now</span>
                    <span className="flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Auto-save active
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>

        {/* Floating AI Prompt (Ambient) */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 backdrop-blur-md bg-[#5210bc]/10 px-6 py-3 rounded-full border border-[#5210bc]/5 flex items-center gap-3 shadow-2xl">
          <Sparkles className="w-4 h-4 text-[#5210bc] fill-current" />
          <p className="text-[#5210bc] font-semibold text-xs tracking-wide uppercase">AI is ready to help refine your logic. Just highlight a block.</p>
          <Button variant="ghost" size="icon" className="text-[#5210bc]/40 hover:text-[#5210bc] h-auto w-auto p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Layout>
  );
}