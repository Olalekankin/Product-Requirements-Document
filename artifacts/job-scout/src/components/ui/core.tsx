import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "ghost-danger";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
          {
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm border border-primary-border": variant === "default",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-secondary-border": variant === "secondary",
            "border border-border bg-card text-card-foreground hover:bg-accent/10 hover:text-accent": variant === "outline",
            "hover:bg-accent/10 hover:text-accent": variant === "ghost",
            "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm border border-destructive-border": variant === "destructive",
            "text-destructive hover:bg-destructive/10": variant === "ghost-danger",
            "h-9 px-4 py-2": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-10 rounded-md px-8 text-md": size === "lg",
            "h-9 w-9": size === "icon",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export const Badge = ({ 
  children, 
  variant = "default",
  className
}: { 
  children: React.ReactNode; 
  variant?: "default" | "outline" | "secondary" | "success" | "warning" | "destructive" | "info";
  className?: string;
}) => {
  return (
    <div className={cn(
      "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold transition-colors font-mono uppercase tracking-wider",
      {
        "bg-primary border-primary-border text-primary-foreground": variant === "default",
        "border-border text-foreground": variant === "outline",
        "bg-secondary border-secondary-border text-secondary-foreground": variant === "secondary",
        "bg-green-100 border-green-200 text-green-800": variant === "success",
        "bg-amber-100 border-amber-200 text-amber-800": variant === "warning",
        "bg-destructive/10 border-destructive/20 text-destructive": variant === "destructive",
        "bg-blue-100 border-blue-200 text-blue-800": variant === "info",
      },
      className
    )}>
      {children}
    </div>
  );
};

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-lg border border-card-border bg-card text-card-foreground shadow-sm", className)}>
    {children}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
