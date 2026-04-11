import { Link } from "wouter";
import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { 
  Plus, 
  Bell, 
  Settings, 
  ArrowRight, 
  Sparkles, 
  ChevronDown, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Terminal, 
  Building2, 
  Landmark, 
  Calendar 
} from "lucide-react";

interface Company {
  id: string;
  name: string;
  industry: string;
  sector: string;
  stage: string;
  stageColor: string;
  borderColor: string;
  position: { top: string; left: string };
  founders: Array<{ name: string; image: string }>;
}

interface PortfolioMetric {
  label: string;
  value: string;
  progress?: number;
  color?: string;
}

const portfolioData = {
  name: "Global Ventures",
  totalValuation: "$24.8M",
  activeCompanies: 4,
  companies: [
    {
      id: "1",
      name: "Acme Labs",
      industry: "SaaS",
      sector: "AI Infra",
      stage: "Series A",
      stageColor: "bg-primary-fixed text-primary",
      borderColor: "border-primary",
      position: { top: "25%", left: "20%" },
      founders: [
        { name: "Founder 1", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=F1" },
        { name: "Founder 2", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=F2" }
      ]
    },
    {
      id: "2",
      name: "Nebula Flow",
      industry: "Fintech",
      sector: "Crypto",
      stage: "Seed",
      stageColor: "bg-secondary-fixed text-secondary",
      borderColor: "border-secondary",
      position: { top: "40%", left: "55%" },
      founders: [
        { name: "Founder 3", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=F3" }
      ]
    },
    {
      id: "3",
      name: "Vertex Core",
      industry: "HealthTech",
      sector: "IoT",
      stage: "Late Stage",
      stageColor: "bg-tertiary-fixed text-tertiary",
      borderColor: "border-tertiary",
      position: { top: "60%", left: "25%" },
      founders: [
        { name: "Founder 4", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=F4" }
      ]
    }
  ] as Company[],
  insights: {
    growth: "+12.4%",
    runway: "Avg 18m"
  },
  metrics: [
    { label: "LTV/CAC Ratio", value: "3.2x", progress: 72, color: "bg-primary" },
    { label: "Burn Rate Agg.", value: "$420k/mo", progress: 45, color: "bg-amber-500" }
  ] as PortfolioMetric[]
};

export default function PortfolioDetail() {
  return (
    <UniversalLayout title="Portfolio Detail">
      <div className="relative h-[calc(100vh-4rem)] overflow-hidden">
        {/* Top Bar */}
        <header className="sticky top-0 w-full z-50 bg-white/70 backdrop-blur-md flex justify-between items-center px-8 py-4 shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {portfolioData.name}
            </h1>
            <div className="flex gap-4 items-center">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  Total Valuation
                </span>
                <span className="text-primary font-bold">
                  {portfolioData.totalValuation}
                </span>
              </div>
              <div className="w-px h-8 bg-surface-container-high"></div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  Active Companies
                </span>
                <span className="text-primary font-bold">
                  {portfolioData.activeCompanies}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button className="bg-primary hover:bg-primary-container text-white shadow-[0_8px_32px_rgba(106,55,212,0.15)] flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Company
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100">
              <Settings className="w-5 h-5" />
            </Button>
            <Avatar className="w-8 h-8">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" alt="User" />
            </Avatar>
          </div>
        </header>

        {/* Canvas Area */}
        <section className="absolute inset-0 z-0 bg-surface-container-low flex items-center justify-center overflow-hidden" style={{
          backgroundImage: 'radial-gradient(#cbc3d7 0.5px, transparent 0.5px)',
          backgroundSize: '24px 24px'
        }}>
          {/* AI Intelligence Panel */}
          <div className="absolute top-24 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-2 bg-white/80 backdrop-blur-xl rounded-full border border-primary/20 shadow-[0_8px_32px_rgba(106,55,212,0.1)] z-10 cursor-pointer hover:bg-white transition-all">
            <Sparkles className="w-5 h-5 text-primary fill-primary" />
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  Growth
                </span>
                <span className="text-xs font-black text-emerald-600">
                  {portfolioData.insights.growth}
                </span>
              </div>
              <div className="w-px h-4 bg-slate-200"></div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  Runway
                </span>
                <span className="text-xs font-black text-amber-600">
                  {portfolioData.insights.runway}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>

          {/* Company Nodes */}
          {portfolioData.companies.map((company) => (
            <Card
              key={company.id}
              className="absolute w-72 bg-white/80 backdrop-blur-xl p-6 shadow-[0_8px_32px_rgba(106,55,212,0.06)] flex flex-col gap-4 border-l-4"
              style={{
                top: company.position.top,
                left: company.position.left
              }}
            >
              <div className={`border-l-4 ${company.borderColor} absolute top-0 left-0 h-full -ml-[1px]`}></div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {company.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {company.industry} • {company.sector}
                  </p>
                </div>
                <Badge className={`px-2 py-1 text-[10px] font-bold rounded-full ${company.stageColor}`}>
                  {company.stage}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex -space-x-2">
                  {company.founders.map((founder, idx) => (
                    <Avatar key={idx} className="w-6 h-6 border-2 border-white">
                      <AvatarImage src={founder.image} alt={founder.name} />
                    </Avatar>
                  ))}
                </div>
                <Link href={`/companies/${company.id}`}>
                  <Button variant="link" className="text-primary font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all p-0 h-auto">
                    Open <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}

          {/* Canvas Controls */}
          <div className="absolute bottom-8 right-8 flex flex-col gap-2 z-10">
            <Card className="bg-white/70 backdrop-blur-md p-2 flex flex-col gap-2 shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
              <Button variant="ghost" size="icon" className="p-2 hover:bg-primary/10 group">
                <ZoomIn className="w-5 h-5 text-primary font-bold group-hover:scale-110 transition-transform" />
              </Button>
              <Button variant="ghost" size="icon" className="p-2 hover:bg-primary/10 group">
                <ZoomOut className="w-5 h-5 text-primary font-bold group-hover:scale-110 transition-transform" />
              </Button>
            </Card>
            <Button variant="ghost" size="icon" className="bg-white/70 backdrop-blur-md p-3 shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:bg-white group">
              <Maximize className="w-5 h-5 text-primary font-bold group-hover:scale-110 transition-transform" />
            </Button>
          </div>
        </section>

        {/* Right Detail Drawer */}
        <aside className="absolute top-0 right-0 h-full w-80 bg-white/40 backdrop-blur-2xl z-20 p-8 flex flex-col gap-10 shadow-[-10px_0_40px_rgba(0,0,0,0.03)]">
          <div className="space-y-6">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                Quick Actions
              </h2>
              <div className="flex flex-col gap-3">
                <Button className="w-full flex items-center justify-between px-4 py-4 bg-primary text-white shadow-[0_8px_20px_rgba(82,16,188,0.2)] hover:shadow-[0_12px_24px_rgba(82,16,188,0.3)] transition-all active:scale-[0.98]">
                  <span>Open Command Center</span>
                  <Terminal className="w-4 h-4" />
                </Button>
                <Button variant="ghost" className="w-full flex items-center justify-between px-4 py-4 bg-white/60 hover:bg-white text-slate-700 font-bold">
                  <span>View Organization</span>
                  <Building2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" className="w-full flex items-center justify-between px-4 py-4 bg-white/60 hover:bg-white text-slate-700 font-bold">
                  <span>Capital Calls</span>
                  <Landmark className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                Portfolio Health
              </h2>
              <div className="space-y-4">
                {portfolioData.metrics.map((metric, idx) => (
                  <Card key={idx} className="bg-white/60 p-4">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-semibold text-slate-500">
                        {metric.label}
                      </span>
                      <span className="text-sm font-black text-primary">
                        {metric.value}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${metric.color} rounded-full`}
                        style={{ width: `${metric.progress}%` }}
                      ></div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <Card className="p-6 bg-primary-container/10 relative overflow-hidden group cursor-pointer">
              <div className="relative z-10">
                <h4 className="text-primary font-black text-sm mb-1">Next Review</h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Quarterly LP update scheduled for Thursday, 10:00 AM
                </p>
              </div>
              <Calendar className="absolute -bottom-2 -right-2 w-16 h-16 text-primary/10 group-hover:scale-110 transition-transform" />
            </Card>
          </div>
        </aside>
      </div>
    </UniversalLayout>
  );
}