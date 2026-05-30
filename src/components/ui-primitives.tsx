import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 ${className}`}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => (
    <select
      ref={ref}
      className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40 ${className}`}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "destructive" }
>(({ className = "", variant = "primary", ...props }, ref) => {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    ghost: "hover:bg-secondary",
    outline: "border border-border hover:bg-secondary",
    destructive: "text-destructive hover:bg-destructive/10",
  }[variant];
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${styles} ${className}`}
      {...props}
    />
  );
});
Button.displayName = "Button";

export function Label({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className="text-xs font-medium text-muted-foreground mb-1.5 block" {...props}>
      {children}
    </label>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
