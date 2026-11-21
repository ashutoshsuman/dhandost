import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui-primitives";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatGoalDate, getTomorrow, parseDateOnly, toLocalDateKey } from "@/lib/goal-utils";
import { supabase } from "@/lib/supabase";
import { TIMEOUT_FAST, withTimeout } from "@/lib/withTimeout";

type GoalTargetDateEditorProps = {
  goalId: string;
  targetDate: string;
  lapsed: boolean;
  onSaved?: () => void;
};

export function TargetDatePassedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive whitespace-nowrap">
      Target date passed
    </span>
  );
}

export default function GoalTargetDateEditor({
  goalId,
  targetDate,
  lapsed,
  onSaved,
}: GoalTargetDateEditorProps) {
  const queryClient = useQueryClient();
  const tomorrow = getTomorrow();
  const [editing, setEditing] = useState(lapsed);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const current = parseDateOnly(targetDate);
    return current && current.getTime() >= tomorrow.getTime() ? current : undefined;
  });

  const updateDate = useMutation({
    mutationFn: async (date: Date) => {
      const nextDate = toLocalDateKey(date);
      if (nextDate < toLocalDateKey(getTomorrow())) {
        throw new Error("Choose tomorrow or a later date.");
      }
      const { error } = await withTimeout(
        supabase.from("goals").update({ target_date: nextDate }).eq("id", goalId),
        TIMEOUT_FAST,
        "update goal target date",
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["goals"] }),
        queryClient.invalidateQueries({ queryKey: ["compute-plan"] }),
      ]);
      setEditing(false);
      setPickerOpen(false);
      toast("Target date updated.");
      onSaved?.();
    },
  });

  if (!lapsed && !editing) {
    return (
      <div className="mt-3">
        <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
          Edit target date
        </Button>
      </div>
    );
  }

  return (
    <div className={lapsed ? "space-y-3" : "mt-4 space-y-3 border-t border-border pt-4"}>
      {lapsed && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your target date of {formatGoalDate(targetDate)} has passed. Set a new date to get an
          updated monthly plan.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="justify-start font-normal">
              <CalendarIcon className="h-4 w-4" />
              {selectedDate ? formatGoalDate(toLocalDateKey(selectedDate)) : "Choose a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setPickerOpen(false);
              }}
              disabled={{ before: tomorrow }}
              defaultMonth={selectedDate ?? tomorrow}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          disabled={!selectedDate || updateDate.isPending}
          onClick={() => {
            if (selectedDate) updateDate.mutate(selectedDate);
          }}
        >
          {updateDate.isPending ? "Saving…" : lapsed ? "Set new date" : "Save date"}
        </Button>
        {!lapsed && (
          <Button
            type="button"
            variant="ghost"
            disabled={updateDate.isPending}
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        )}
      </div>
      {updateDate.isError && (
        <p className="text-xs text-destructive" role="alert">
          Couldn't update the date. Please try again.
        </p>
      )}
    </div>
  );
}
