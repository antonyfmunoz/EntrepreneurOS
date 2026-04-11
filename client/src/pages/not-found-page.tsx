import { Link } from "wouter";
import { Home, Search, FileQuestion } from "lucide-react";
import UniversalLayout from "@/components/layout/universal-layout";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <UniversalLayout title="404 - Page Not Found">
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center w-full px-6 py-12">
        <div 
          className="max-w-2xl w-full p-12 rounded-xl flex flex-col items-center text-center"
          style={{
            background: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 8px 32px rgba(106, 55, 212, 0.08)"
          }}
        >
          {/* Icon Illustration */}
          <div className="relative mb-10">
            {/* Ethereal Glow Background */}
            <div 
              className="absolute inset-0 rounded-full blur-3xl"
              style={{
                background: "#e9ddff",
                opacity: 0.2
              }}
            />
            
            {/* Main Icon Cluster */}
            <div className="relative flex items-center justify-center">
              <FileQuestion 
                className="absolute translate-x-1 translate-y-1" 
                size={120}
                style={{ color: "rgba(106, 55, 212, 0.2)" }}
                strokeWidth={1.5}
              />
              <FileQuestion 
                className="relative z-10" 
                size={120}
                style={{ color: "#6a37d4" }}
                strokeWidth={1.5}
              />
              
              {/* Decorative Search Icon */}
              <Search
                className="absolute -top-4 -right-4"
                size={48}
                style={{ color: "rgba(174, 141, 255, 0.4)" }}
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* Typography Content */}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-[#2c2f30]">
            404: Path not found.
          </h1>
          
          <p className="text-lg leading-relaxed text-[#595c5d] max-w-md mb-10">
            The resource you're looking for has been moved, deleted, or never existed in this architecture. Let's get you back to operating.
          </p>

          {/* Back to Home Button */}
          <Link href="/">
            <Button 
              size="lg"
              className="group px-8 py-6 rounded-xl text-white flex items-center gap-3 transition-all duration-300 active:scale-[0.98] text-base font-semibold"
              style={{
                background: "#6a37d4",
                boxShadow: "0 0 0 rgba(106, 55, 212, 0.08)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(106, 55, 212, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 0 0 rgba(106, 55, 212, 0.08)";
              }}
            >
              <Home size={20} />
              <span>Return to Home</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Decorative Background Elements */}
      <div 
        className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] -z-10 pointer-events-none"
        style={{ background: "rgba(233, 221, 255, 0.3)" }}
      />
      <div 
        className="fixed bottom-[-5%] right-[-5%] w-[30%] h-[30%] rounded-full blur-[100px] -z-10 pointer-events-none"
        style={{ background: "rgba(233, 221, 255, 0.2)" }}
      />
    </UniversalLayout>
  );
}