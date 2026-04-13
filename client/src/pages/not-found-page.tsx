import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function NotFoundPage() {
  const [, setLocation] = useLocation();
  const attemptedRoute = window.location.pathname;

  useEffect(() => {
    // Track page_viewed event
    if (typeof window !== "undefined" && (window as any).analytics) {
      (window as any).analytics.track("page_viewed", {
        attemptedRoute,
      });
    }
  }, [attemptedRoute]);

  const handleBackToHome = () => {
    // Track back_to_home_clicked event
    if (typeof window !== "undefined" && (window as any).analytics) {
      (window as any).analytics.track("back_to_home_clicked");
    }
    setLocation("/");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: "#ffffff",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="w-full max-w-md flex flex-col items-center text-center space-y-8">
        {/* Illustration */}
        <div
          className="w-32 h-32 flex items-center justify-center backdrop-blur-2xl"
          style={{
            background: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: "0 8px 32px rgba(106, 55, 212, 0.08)",
            borderRadius: "12px",
          }}
        >
          <AlertCircle
            className="w-16 h-16"
            style={{ color: "#6a37d4" }}
            strokeWidth={1.5}
          />
        </div>

        {/* Error Message */}
        <div className="space-y-4">
          <h1
            className="text-4xl font-semibold"
            style={{
              color: "#2c2f30",
              letterSpacing: "-0.02em",
            }}
          >
            Page not found
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{
              color: "#595c5d",
              lineHeight: "1.6",
            }}
          >
            The page you're looking for doesn't exist. It may have been moved or
            deleted.
          </p>
        </div>

        {/* Back to Home Button */}
        <Button
          onClick={handleBackToHome}
          className="w-full sm:w-auto gap-2 text-base font-medium"
          style={{
            backgroundColor: "#6a37d4",
            color: "#ffffff",
            borderRadius: "12px",
            padding: "12px 32px",
            height: "auto",
          }}
        >
          <Home className="w-5 h-5" strokeWidth={2} />
          Back to home
        </Button>
      </div>
    </div>
  );
}