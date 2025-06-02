
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProductTitleProps {
  title: string;
  variant?: "default" | "premium" | "live" | "minimal" | "gradient";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProductTitle({ 
  title, 
  variant = "default", 
  size = "md", 
  className 
}: ProductTitleProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "premium":
        return "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black font-semibold shadow-lg border-0";
      case "live":
        return "bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 text-white font-semibold shadow-lg border-0";
      case "gradient":
        return "bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-600 text-white font-semibold shadow-lg border-0";
      case "minimal":
        return "bg-muted/50 text-foreground font-medium border border-border/50";
      default:
        return "bg-primary/10 text-primary font-medium border border-primary/20";
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return "text-xs px-2 py-1 rounded-md";
      case "lg":
        return "text-base px-4 py-2 rounded-lg";
      default:
        return "text-sm px-3 py-1.5 rounded-lg";
    }
  };

  // Determine variant based on product name if not specified
  const autoVariant = variant === "default" ? 
    (title.toLowerCase().includes("premium") ? "premium" : 
     title.toLowerCase().includes("live") ? "live" : "default") : variant;

  return (
    <Badge 
      className={cn(
        "inline-flex items-center gap-1.5 transition-all duration-200 hover:shadow-md",
        getVariantStyles(),
        getSizeStyles(),
        className
      )}
      variant="outline"
    >
      {autoVariant === "premium" && <span className="text-amber-900">✨</span>}
      {autoVariant === "live" && <span className="text-green-900">💎</span>}
      <span className="whitespace-nowrap">{title}</span>
    </Badge>
  );
}
