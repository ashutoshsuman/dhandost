export const DEFAULT_CATEGORIES = [
  "Salary",
  "Freelance",
  "Bonus",
  "Refund",
  "Food",
  "Groceries",
  "Transport",
  "Shopping",
  "Entertainment",
  "Household",
  "Family Transfer",
  "Utilities",
  "Rent",
  "EMI",
  "SIP",
  "Investment",
  "Insurance",
  "Health",
  "Money Transfer",
  "Transfer",
  "Other",
];

/** Default/custom names are canonical; a stored value is always preserved exactly. */
export function categoryOptions(customNames: readonly string[] = [], storedValue?: string | null) {
  const seen = new Map<string, string>();
  for (const name of [...DEFAULT_CATEGORIES, ...customNames]) {
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  const options = [...seen.values()];
  if (storedValue && !options.includes(storedValue)) options.push(storedValue);
  return options.sort((a, b) => a.localeCompare(b));
}

export function hasCategoryChange(current: string | null, selected: string) {
  return selected !== "" && selected !== current;
}
