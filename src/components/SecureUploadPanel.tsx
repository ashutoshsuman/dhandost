import { Lock } from "lucide-react";

export function SecureUploadPanel() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/15">
        <Lock className="h-4 w-4 text-success" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">Secure Upload</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          Your statement is processed securely and used only to generate personal
          financial insights.
        </p>
      </div>
    </div>
  );
}

export default SecureUploadPanel;
