# Fix "Cannot read properties of undefined (reading 'border')" on Live Plan

## What's happening
The Variable Spending Tracker on the Live Plan colours each category card by its status. The app only knows three statuses: "under", "within", "over". The spending-tracker service now sends back at least one category with a status the app doesn't know, such as "no_baseline" or "on_track". The app looks up colours for that unknown status, finds nothing, and the whole page crashes.

## Fix
- If the service sends a status the app doesn't recognise, work out the status from the actual and baseline amounts, the same way the app already does when no status is sent.
- Add a final safe default ("within" colours) so an unexpected value can never crash the page again.
- Only the colours and labels of the tracker cards change. The numbers, the service, and the rest of the page stay the same.

## Technical details
- `src/components/VariableSpendingTracker.tsx`, `statusFor()`: use `provided` only when it is a key of `statusStyles`; otherwise fall through to the computed status.
- At the `statusStyles[...]` lookups (lines ~106 and ~152), use `?? statusStyles.within`.
- Log unknown status values once with `console.warn` so new values from the service are visible.
