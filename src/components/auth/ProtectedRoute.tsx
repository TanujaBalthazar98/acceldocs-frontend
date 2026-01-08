import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ALLOWED_DOMAIN = "acceldata.io";

const isAcceldataEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === ALLOWED_DOMAIN;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateUser = async () => {
      if (loading) return;
      
      if (user && user.email && !isAcceldataEmail(user.email)) {
        // Sign out unauthorized users
        toast({
          title: "Access Denied",
          description: `Only @${ALLOWED_DOMAIN} email addresses are allowed to access Acceldocs.`,
          variant: "destructive",
        });
        await signOut();
      }
      setIsValidating(false);
    };

    validateUser();
  }, [user, loading, signOut, toast]);

  if (loading || isValidating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Double-check domain in case validation hasn't kicked user out yet
  if (user.email && !isAcceldataEmail(user.email)) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
