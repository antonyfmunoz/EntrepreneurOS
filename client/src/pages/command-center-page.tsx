import { Link } from "wouter";
import { UniversalLayout } from "@/components/layout/universal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Home, 
  CheckSquare, 
  Workflow, 
  Building2, 
  Settings, 
  Plus, 
  CheckCircle2, 
  FileText, 
  ChevronRight,
  Send,
  BarChart3
} from "lucide-react";

interface CommandCenterProps {
  params: {
    companyId: string;
  };
}

interface KPICard {
  label: string;
  value: string;
  suffix?: string;
}

interface Alert {
  type: "success" | "warning" | "info";
  title: string;
  description: string;
  icon: typeof CheckCircle2;
}

interface UpcomingAudit {
  title: string;
  dueDate: string;
}

const kpiData: KPICard[] = [
  { label: "Total Revenue", value: "$0", suffix: ".00" },
  { label: "Active Users", value: "0" },
  { label: "Monthly Growth", value: "0%" },
  { label: "Burn Rate", value: "$0", suffix: "/mo" },
];

const systemAlerts: Alert[] = [
  {
    type: "success",
    title: "All systems operational.",
    description: "No critical bottlenecks detected in the current stack.",
    icon: CheckCircle2,
  },
];

const upcomingAudits: UpcomingAudit[] = [
  {
    title: "Regulatory Compliance",
    dueDate: "In 14 days",
  },
];

const suggestedInquiries: string[] = [
  "How do I integrate my banking?",
  "Show me founder-led sales workflow",
  "Create a 30-day growth plan",
];

export default function CommandCenter({ params }: CommandCenterProps) {
  const companyName = "Starlight Ventures";

  const leftRailItems = [
    { icon: Home, label: "Home", href: `/company/${params.companyId}`, active: true },
    { icon: CheckSquare, label: "Tasks", href: `/company/${params.companyId}/tasks`, active: false },
    { icon: Workflow, label: "Workflows", href: `/company/${params.companyId}/workflows`, active: false },
    { icon: Building2, label: "Org", href: `/company/${params.companyId}/org`, active: false },
    { icon: Settings, label: "Settings", href: `/company/${params.companyId}/settings`, active: false },
  ];

  const floatingPanelContent = (
    <div className="glass px-6 py-2 rounded-full shadow-[0_8px_32px_rgba(106,55,212,0.08)] flex items-center gap-8">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
        <span className="text-xs font-bold uppercase tracking-widest text-[#595c5d]">KPI: Nominal</span>
      </div>
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-medium text-[#595c5d]">Alerts: 0</span>
      </div>
      <div className="h-4 w-px bg-[#abadae] opacity-20"></div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-400">Next:</span>
        <span className="text-xs font-semibold text-[#6a37d4]">Review quarterly goals</span>
      </div>
    </div>
  );

  const rightRailContent = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-400 flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h3 className="text-sm font-bold">OS-1 Assistant</h3>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">Status: Online</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-50">
          <p className="text-xs text-slate-600 leading-relaxed italic">
            "Good morning, Founder. I've initialized the {companyName} workspace. All metrics are currently at baseline. How shall we begin building today?"
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Suggested Inquiries</h4>
          {suggestedInquiries.map((inquiry, index) => (
            <button
              key={index}
              className="text-left p-3 rounded-xl bg-white border border-slate-50 hover:bg-slate-100 transition-colors text-[11px] text-slate-600"
            >
              {inquiry}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 mt-auto">
        <div className="relative">
          <Input
            className="w-full bg-white border-none rounded-xl py-3 pl-4 pr-12 text-xs shadow-sm focus:ring-2 focus:ring-[#6a37d4]/20"
            placeholder="Ask OS-1..."
            type="text"
          />
          <Button
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#6a37d4] hover:bg-[#5a2dc0]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <UniversalLayout
      title="Command Center"
      leftRailItems={leftRailItems}
      floatingPanel={floatingPanelContent}
      rightRailContent={rightRailContent}
      companyName={companyName}
    >
      <div className="p-12">
        <div className="mb-16">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6a37d4] mb-4 block">
            Operationally Wise
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#2c2f30] mb-2">
            Good Morning, Founder.
          </h1>
          <p className="text-[#595c5d] text-lg">
            Command Center <span className="text-slate-300 mx-2">/</span> {companyName}
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {kpiData.map((kpi, index) => (
            <Card
              key={index}
              className="bg-[#eceeef] p-8 rounded-[24px] shadow-[0_8px_32px_rgba(106,55,212,0.08)] flex flex-col justify-between min-h-[160px] transition-transform hover:scale-[1.02] border-none"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {kpi.label}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">{kpi.value}</span>
                {kpi.suffix && (
                  <span className="text-sm font-medium text-slate-400">{kpi.suffix}</span>
                )}
              </div>
            </Card>
          ))}
        </section>

        <div className="grid grid-cols-12 gap-12">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-12">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#2c2f30]">Active Workflows</h2>
                <Button
                  variant="ghost"
                  className="text-xs font-bold text-[#6a37d4] flex items-center gap-1 hover:opacity-70 h-auto p-0"
                >
                  <Plus className="w-4 h-4" /> CREATE NEW
                </Button>
              </div>
              <div className="bg-[#f2f4f5] border-dashed border-2 border-[#abadae]/30 rounded-[24px] p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#ae8dff] flex items-center justify-center mb-4">
                  <Workflow className="w-8 h-8 text-[#6a37d4]" />
                </div>
                <p className="text-[#2c2f30] font-medium">No active workflows.</p>
                <p className="text-[#595c5d] text-sm mb-6">
                  Create your first workflow to begin automating your operations.
                </p>
                <Button className="px-6 py-2.5 bg-[#6a37d4] hover:bg-[#5a2dc0] text-white rounded-xl text-sm font-semibold shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
                  Start Building
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#2c2f30]">Recent Tasks</h2>
                <Button
                  variant="ghost"
                  className="text-xs font-bold text-[#6a37d4] flex items-center gap-1 hover:opacity-70 h-auto p-0"
                >
                  <Plus className="w-4 h-4" /> ADD TASK
                </Button>
              </div>
              <div className="bg-[#f2f4f5] border-dashed border-2 border-[#abadae]/30 rounded-[24px] p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#ae8dff] flex items-center justify-center mb-4">
                  <CheckSquare className="w-8 h-8 text-[#6a37d4]" />
                </div>
                <p className="text-[#2c2f30] font-medium">No tasks yet.</p>
                <p className="text-[#595c5d] text-sm">
                  Add your first task to organize your founder roadmap.
                </p>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <Card className="bg-white p-8 rounded-[24px] shadow-[0_8px_32px_rgba(106,55,212,0.08)] border-none">
              <div className="flex items-center gap-2 mb-8">
                <BarChart3 className="w-5 h-5 text-[#6a37d4]" />
                <h2 className="text-lg font-bold text-[#2c2f30]">System Alerts</h2>
              </div>
              <div className="flex flex-col gap-4">
                {systemAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50/50"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900">{alert.title}</h4>
                      <p className="text-xs text-emerald-700/80 mt-1">{alert.description}</p>
                    </div>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                    Upcoming Audits
                  </h4>
                  {upcomingAudits.map((audit, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#eceeef] flex items-center justify-center">
                        <FileText className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold">{audit.title}</p>
                        <p className="text-[10px] text-slate-400">{audit.dueDate}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <footer className="mt-24 w-full py-4 flex justify-center items-center gap-8 px-8 text-[10px] uppercase tracking-widest text-slate-400">
          <span>© 2024 EntrepreneurOS. All systems operational.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[#6a37d4] transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#6a37d4] transition-colors">
              Terms
            </Link>
            <Link href="/support" className="hover:text-[#6a37d4] transition-colors">
              Support
            </Link>
          </div>
        </footer>
      </div>
    </UniversalLayout>
  );
}