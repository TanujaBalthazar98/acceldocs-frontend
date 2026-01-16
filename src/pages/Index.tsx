import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate("/dashboard", { replace: true });
      } else {
        const redirectSuffix = `${location.search || ""}${location.hash || ""}`;
        navigate(`/auth${redirectSuffix}`, { replace: true });
      }
    }
  }, [user, loading, navigate, location.search, location.hash]);

  // Show nothing while redirecting
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
};

export default Index;
