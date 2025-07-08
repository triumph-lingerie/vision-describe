import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn(sizeClasses[size], "bg-foreground rounded flex items-center justify-center")}>
        <span className={cn(
          "text-background font-bold",
          size === "sm" && "text-xs",
          size === "md" && "text-sm", 
          size === "lg" && "text-base"
        )}>
          VD
        </span>
      </div>
      <span className={cn(
        "font-semibold tracking-tight text-foreground",
        size === "sm" && "text-base",
        size === "md" && "text-lg", 
        size === "lg" && "text-2xl"
      )}>
        Vision Describe
      </span>
    </div>
  );
}