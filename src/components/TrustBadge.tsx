import { Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function TrustBadge() {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success cursor-default">
            <Lock className="h-3 w-3" />
            Private &amp; Secure
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-center">
          Your financial data is encrypted and never sold.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default TrustBadge;
