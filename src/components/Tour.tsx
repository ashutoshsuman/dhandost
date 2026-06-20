import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ACTIONS,
  EVENTS,
  Joyride,
  STATUS,
  type EventData,
  type Step,
} from "react-joyride";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

type StepDef = {
  tab?: string;
  target: string;
  placement?: Step["placement"];
  content: string;
};

const STEPS: StepDef[] = [
  {
    target: "body",
    placement: "center",
    content:
      "Welcome to DhanDost — your personal finance friend. This quick tour shows you where everything lives. You can skip anytime and replay it later from your profile menu.",
  },
  {
    tab: "/transactions",
    target: '[data-tour="add-transaction"]',
    content:
      "Start here. Add transactions manually or upload a bank statement CSV. If any transaction is a surprise — an unplanned expense or extra income — click 'Help me with a plan' on that row, and DhanDost will map three ways to absorb it without derailing your goals.",
  },
  {
    tab: "/",
    target: '[data-tour="live-plan-overview"]',
    content:
      "Once your data's in, this is your month at a glance. If a category runs over budget, you'll see the same plan-help option appear here too.",
  },
  {
    tab: "/review",
    target: '[data-tour="nav-review"]',
    content:
      "Anything DhanDost isn't fully sure about — like a possible self-transfer — lands here for you to confirm.",
  },
  {
    tab: "/fixed",
    target: '[data-tour="nav-fixed-expenses"]',
    content: "Recurring costs — rent, EMIs, subscriptions — go here.",
  },
  {
    tab: "/goals",
    target: '[data-tour="nav-goals"]',
    content: "Set your savings goals here. These directly feed your plan's math.",
  },
  {
    tab: "/debts",
    target: '[data-tour="nav-debts"]',
    content: "Track loans and credit cards here.",
  },
  {
    tab: "/chat",
    target: '[data-tour="nav-chat"]',
    content:
      "Ask anything, anytime — from here, or the chat bubble in the corner of every screen.",
  },
  {
    target: '[data-tour="dropdown-data"]',
    placement: "left",
    content: "Manage or delete your uploaded data anytime from here.",
  },
  {
    target: '[data-tour="dropdown-profile"]',
    placement: "left",
    content:
      "Update your name here — and you can replay this tour anytime from this same menu.",
  },
];

type TourCtx = {
  start: () => void;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
};

const TourContext = createContext<TourCtx>({
  start: () => {},
  dropdownOpen: false,
  setDropdownOpen: () => {},
});

export const useTour = () => useContext(TourContext);

const waitFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const autoStartChecked = useRef(false);

  const start = useCallback(() => {
    setStepIndex(0);
    setDropdownOpen(false);
    setRun(true);
  }, []);

  const markComplete = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("profiles")
      .update({ has_completed_tour: true })
      .eq("user_id", data.user.id);
  }, []);

  useEffect(() => {
    if (autoStartChecked.current) return;
    autoStartChecked.current = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("has_completed_tour, full_name")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (data && data.full_name && !data.has_completed_tour) {
        // small delay so layout mounts
        setTimeout(() => start(), 600);
      }
    })();
  }, [start]);

  const goToStep = useCallback(
    async (nextIndex: number) => {
      const next = STEPS[nextIndex];
      if (!next) return;
      if (next.tab && window.location.pathname !== next.tab) {
        await navigate({ to: next.tab });
      }
      const needsDropdown = nextIndex === 8 || nextIndex === 9;
      setDropdownOpen(needsDropdown);
      await waitFrame();
      // a second frame helps after route transitions/dropdown portal mount
      await waitFrame();
      setStepIndex(nextIndex);
    },
    [navigate],
  );

  const handleEvent = (data: EventData) => {
    const { status, type, index, action } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      setStepIndex(0);
      setDropdownOpen(false);
      void markComplete();
      return;
    }

    if (action === ACTIONS.SKIP || action === ACTIONS.CLOSE) {
      setRun(false);
      setStepIndex(0);
      setDropdownOpen(false);
      void markComplete();
      return;
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      if (nextIndex < 0) return;
      if (nextIndex >= STEPS.length) {
        setRun(false);
        setStepIndex(0);
        setDropdownOpen(false);
        void markComplete();
        return;
      }
      void goToStep(nextIndex);
    }
  };

  const joyrideSteps: Step[] = STEPS.map((s) => ({
    target: s.target,
    content: s.content,
    placement: s.placement ?? "auto",
    skipBeacon: true,
  }));

  return (
    <TourContext.Provider value={{ start, dropdownOpen, setDropdownOpen }}>
      {children}
      <Joyride
        steps={joyrideSteps}
        run={run}
        stepIndex={stepIndex}
        continuous
        scrollToFirstStep
        onEvent={handleEvent}
        options={{
          primaryColor: "oklch(0.58 0.12 162)",
          textColor: "oklch(0.18 0.03 240)",
          backgroundColor: "#ffffff",
          arrowColor: "#ffffff",
          overlayColor: "rgba(15, 23, 42, 0.55)",
          zIndex: 10000,
          showProgress: true,
          buttons: ["back", "skip", "primary"],
          overlayClickAction: false,
        }}
        locale={{
          back: "Back",
          close: "Close",
          last: "Done",
          next: "Next",
          skip: "Skip tour",
        }}
        styles={{
          tooltip: {
            borderRadius: 14,
            padding: 18,
            fontFamily: "inherit",
            fontSize: 14,
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.25)",
          },
          tooltipContent: {
            padding: "8px 0 4px",
            lineHeight: 1.5,
          },
          buttonPrimary: {
            backgroundColor: "oklch(0.58 0.12 162)",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
          },
          buttonBack: {
            color: "oklch(0.45 0.02 240)",
            fontSize: 13,
            marginRight: 8,
          },
          buttonSkip: {
            color: "oklch(0.45 0.02 240)",
            fontSize: 13,
          },
          beaconInner: { backgroundColor: "oklch(0.58 0.12 162)" },
          beaconOuter: {
            borderColor: "oklch(0.58 0.12 162)",
            backgroundColor: "oklch(0.58 0.12 162 / 0.25)",
          },
        }}
      />
    </TourContext.Provider>
  );
}

