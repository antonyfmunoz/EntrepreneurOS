import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type LayoutProps = {
  children: ReactNode;
  title: string;
};

export function Layout({ children, title }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  
  // Auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [isMobile]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar with transition */}
      <div 
        className={cn(
          "fixed md:static inset-y-0 left-0 z-20 transform transition-transform duration-300 ease-in-out bg-white",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:-translate-x-64",
          "md:translate-x-0 md:w-64 md:flex"
        )}
      >
        <Sidebar />
      </div>
      
      {/* Overlay for mobile */}
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title}>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="mr-2"
          >
            <i className={cn(
              "transition-transform duration-300",
              isSidebarOpen ? "ri-menu-fold-line" : "ri-menu-unfold-line"
            )}></i>
          </Button>
        </Header>
        
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}