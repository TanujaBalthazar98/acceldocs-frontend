import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Building2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Plan = "free" | "pro" | "enterprise";

interface PlanSelectionProps {
  onSelect: (plan: Plan) => void;
}

const plans = [
  {
    id: "free" as Plan,
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individuals getting started",
    icon: Sparkles,
    features: [
      "Up to 3 projects",
      "Basic page states",
      "Google Drive integration",
      "5 team members",
    ],
    highlighted: false,
  },
  {
    id: "pro" as Plan,
    name: "Pro",
    price: "$12",
    period: "per user/month",
    description: "For growing teams",
    icon: Users,
    features: [
      "Unlimited projects",
      "Advanced governance",
      "External publishing",
      "Priority support",
      "Custom branding",
    ],
    highlighted: true,
  },
  {
    id: "enterprise" as Plan,
    name: "Enterprise",
    price: "Custom",
    period: "contact sales",
    description: "For large organizations",
    icon: Building2,
    features: [
      "Everything in Pro",
      "SSO / SAML",
      "Advanced analytics",
      "Dedicated support",
      "Custom integrations",
    ],
    highlighted: false,
  },
];

export const PlanSelection = ({ onSelect }: PlanSelectionProps) => {
  const [selectedPlan, setSelectedPlan] = useState<Plan>("free");

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Choose your plan</h2>
        <p className="text-muted-foreground">
          Start free and upgrade as you grow. No credit card required.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isSelected = selectedPlan === plan.id;

          return (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={cn(
                "relative p-6 rounded-xl border-2 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 shadow-glow"
                  : "border-border hover:border-primary/50 bg-card",
                plan.highlighted && !isSelected && "border-primary/30"
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                  Most Popular
                </span>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-secondary"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground ml-1">/{plan.period}</span>
              </div>

              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {isSelected && (
                <div className="absolute top-4 right-4">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Button
        variant="hero"
        size="lg"
        className="w-full"
        onClick={() => onSelect(selectedPlan)}
      >
        Continue with {plans.find((p) => p.id === selectedPlan)?.name}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You can change your plan anytime in settings
      </p>
    </div>
  );
};
