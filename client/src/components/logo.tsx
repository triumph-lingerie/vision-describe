import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg 
        className={cn(sizeClasses[size], "text-primary")} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Eye icon for Vision */}
        <path 
          d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          fill="none"
        />
        <circle 
          cx="12" 
          cy="12" 
          r="3" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          fill="currentColor" 
          fillOpacity="0.2"
        />
        {/* Document lines for Describe */}
        <path 
          d="M16 16h4M16 18h4M16 20h2" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round"
        />
      </svg>
      <span className={cn(
        "font-semibold tracking-tight",
        size === "sm" && "text-base",
        size === "md" && "text-lg", 
        size === "lg" && "text-2xl"
      )}>
        Vision Describe
      </span>
    </div>
  );
}