import { useState } from "react";
import { Link } from "wouter";
import { UniversalLayout } from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Plus, 
  X, 
  Rocket, 
  Cpu, 
  ChevronRight 
} from "lucide-react";

interface Portfolio {
  id: string;
  name: string;
  status: "Active" | "Holding" | "Exited";
  companyCount: number;
  aum?: string;
  description?: string;
  goals?: string[];
  companies?: Company[];
  position: { top: number; left: number };
  isSelected?: boolean;
}

interface Company {
  id: string;
  name: string;
  industry: string;
  icon: React.ReactNode;
}

const portfolioData: Portfolio[] = [
  {
    id: "1",
    name: "Stellar Ventures",
    status: "Active",
    companyCount: 8,
    aum: "$4.2M",
    description: "Deep tech and infrastructure investment thesis.",
    goals: [
      "Achieve 85% operational density across core SaaS stack by Q3.",
      "Diversify liquidity events through structured secondary market exits.",
      "Optimize capital deployment for series A extensions."
    ],
    companies: [
      { id: "c1", name: "Orbital Edge", industry: "Aerospace", icon: <Rocket className="h-5 w-5 text-[#6a37d4]" /> },
      { id: "c2", name: "Quantum Systems", industry: "Hardware", icon: <Cpu className="h-5 w-5 text-[#6a37d4]" /> }
    ],
    position: { top: 340, left: 320 },
    isSelected: true
  },
  {
    id: "2",
    name: "Alpha Genesis",
    status: "Holding",
    companyCount: 12,
    position: { top: 640, left: 320 }
  },
  {
    id: "3",
    name: "Nova Capital",
    status: "Exited",
    companyCount: 4,
    position: { top: 340, left: 680 }
  }
];

export default function PortfolioList() {
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(
    portfolioData.find(p => p.isSelected) || null
  );
  const [isDetailOpen, setIsDetailOpen] = useState(true);

  const getStatusColor = (status: Portfolio["status"]) => {
    switch (status) {
      case "Active":
        return "bg-[#e9ddff] text-[#6a37d4]";
      case "Holding":
        return "bg-[#e7e8e9] text-slate-500";
      case "Exited":
        return "bg-[#e7e8e9] text-slate-500";
    }
  };

  return (
    <UniversalLayout title="Portfolios">
      <div className="absolute inset-0 bg-[radial-gradient(circle,_#cbc3d7_1px,_transparent_1px)] bg-[length:24px_24px]">
        {/* Operational Header */}
        <div className="absolute top-10 left-12 z-10">
          <h1 className="text-[3.5rem] font-semibold leading-[1.1] tracking-tight text-[#2c2f30]">
            Ecosystem Architecture
          </h1>
          <p className="text-base text-[#595c5d] max-w-xl mt-4">
            Structural visualization of global venture assets and strategic capitalization pathways.
          </p>
        </div>

        {/* Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <line
            x1="450"
            y1="400"
            x2="800"
            y2="400"
            stroke="#6a37d4"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.3"
          />
          <line
            x1="800"
            y1="400"
            x2="800"
            y2="700"
            stroke="#6a37d4"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.3"
          />
          <line
            x1="450"
            y1="400"
            x2="450"
            y2="700"
            stroke="#6a37d4"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.3"
          />
        </svg>

        {/* Portfolio Nodes */}
        {portfolioData.map((portfolio) => (
          <Card
            key={portfolio.id}
            className={`absolute w-64 p-6 bg-white/70 backdrop-blur-[16px] rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] cursor-pointer transition-all hover:shadow-[0_12px_40px_rgba(106,55,212,0.12)] ${
              portfolio.isSelected ? "ring-2 ring-[#5210bc]" : ""
            }`}
            style={{ top: `${portfolio.position.top}px`, left: `${portfolio.position.left}px` }}
            onClick={() => {
              setSelectedPortfolio(portfolio);
              setIsDetailOpen(true);
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-base font-semibold text-[#2c2f30]">{portfolio.name}</h3>
              <Badge className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${getStatusColor(portfolio.status)}`}>
                {portfolio.status}
              </Badge>
            </div>
            <div className="space-y-1 mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Entities</p>
              <p className="text-xl font-semibold text-[#6a37d4]">{portfolio.companyCount} Companies</p>
            </div>
            <Button
              className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest ${
                portfolio.isSelected
                  ? "bg-[#ab8ffe] text-[#3f1e8b] hover:bg-[#ab8ffe]/90"
                  : "border border-[#cbc3d7]/20 bg-transparent text-[#6a37d4] hover:bg-white"
              }`}
            >
              View Context
            </Button>
          </Card>
        ))}

        {/* Skeleton Node */}
        <div
          className="absolute w-64 p-6 bg-white/40 backdrop-blur-[16px] rounded-xl border border-white/20"
          style={{ top: "640px", left: "680px" }}
        >
          <div className="h-4 w-2/3 bg-slate-200/50 rounded mb-4 animate-pulse"></div>
          <div className="h-10 w-1/2 bg-slate-200/50 rounded mb-6 animate-pulse"></div>
          <div className="h-10 w-full bg-slate-100/50 rounded-xl animate-pulse"></div>
        </div>

        {/* Canvas Controls */}
        <div className="absolute top-8 right-8 flex items-center gap-2 bg-white/70 backdrop-blur-md p-2 rounded-2xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] z-10">
          <Button variant="ghost" size="icon" className="p-3 text-slate-500 hover:bg-slate-100 rounded-xl">
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="p-3 text-slate-500 hover:bg-slate-100 rounded-xl">
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="p-3 text-slate-500 hover:bg-slate-100 rounded-xl">
            <Maximize className="h-5 w-5" />
          </Button>
          <div className="w-[1px] h-8 bg-slate-200 mx-1"></div>
          <Button className="bg-[#6a37d4] text-white px-6 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm hover:bg-[#5a2dc0]">
            <Plus className="h-4 w-4" />
            Create Portfolio
          </Button>
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent side="right" className="w-[450px] p-0 flex flex-col">
          <div className="p-8 flex-1 overflow-y-auto">
            <div className="flex justify-between items-center mb-12">
              <Button
                variant="ghost"
                size="icon"
                className="p-2 hover:bg-slate-100 rounded-lg"
                onClick={() => setIsDetailOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
              <Badge className="text-[10px] font-bold uppercase tracking-widest text-[#6a37d4] bg-[#e9ddff] px-3 py-1 rounded-full">
                Portfolio Detail
              </Badge>
            </div>

            {selectedPortfolio && (
              <>
                <h2 className="text-[2.5rem] font-semibold leading-tight text-[#2c2f30] mb-2">
                  {selectedPortfolio.name}
                </h2>
                <p className="text-slate-500 font-medium mb-8">
                  {selectedPortfolio.description || "Investment portfolio overview."}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-12">
                  <Card className="bg-[#f3f4f5] p-6 rounded-xl border-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      Companies
                    </p>
                    <p className="text-2xl font-semibold text-[#6a37d4]">
                      {selectedPortfolio.companyCount.toString().padStart(2, "0")}
                    </p>
                  </Card>
                  <Card className="bg-[#f3f4f5] p-6 rounded-xl border-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      Total AUM
                    </p>
                    <p className="text-2xl font-semibold text-[#6a37d4]">
                      {selectedPortfolio.aum || "—"}
                    </p>
                  </Card>
                </div>

                {selectedPortfolio.goals && (
                  <section className="mb-12">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#2c2f30] mb-6">
                      Strategic Goals
                    </h4>
                    <ul className="space-y-4">
                      {selectedPortfolio.goals.map((goal, idx) => (
                        <li key={idx} className="flex gap-4 items-start">
                          <div className="mt-1 w-2 h-2 rounded-full bg-[#6a37d4] flex-shrink-0"></div>
                          <p className="text-sm text-[#595c5d] leading-relaxed">{goal}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {selectedPortfolio.companies && (
                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#2c2f30] mb-6">
                      Portfolio Assets
                    </h4>
                    <div className="space-y-3">
                      {selectedPortfolio.companies.map((company) => (
                        <Link key={company.id} href={`/companies/${company.id}`}>
                          <div className="flex items-center justify-between p-4 bg-[#f8f9fa] rounded-xl hover:bg-[#e7e8e9] transition-colors cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                {company.icon}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#2c2f30]">{company.name}</p>
                                <p className="text-[10px] uppercase text-slate-400 font-bold">
                                  {company.industry}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-300" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

          <div className="mt-auto p-8 bg-[#f3f4f5] flex gap-4">
            <Button className="flex-1 py-4 bg-[#5210bc] text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg hover:bg-[#5a2dc0]">
              Analyze Growth
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="p-4 border border-[#cbc3d7] text-[#6a37d4] rounded-xl hover:bg-white"
            >
              <ChevronRight className="h-5 w-5 rotate-90" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </UniversalLayout>
  );
}