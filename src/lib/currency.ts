// Static exchange rates (EUR base) — updated periodically
// In production, these could be fetched from an API
const RATES_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  CHF: 1.05,
  SEK: 0.088,
  NOK: 0.087,
  DKK: 0.134,
  PLN: 0.233,
  CZK: 0.040,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CZK: "Kč",
};

export const SUPPORTED_CURRENCIES = Object.keys(RATES_TO_EUR);

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Convert an amount from one currency to another using EUR as the base.
 */
export function convertCurrency(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const inEUR = amount * (RATES_TO_EUR[from] ?? 1);
  const toRate = RATES_TO_EUR[to] ?? 1;
  return inEUR / toRate;
}

/**
 * Format an amount with its currency symbol.
 */
export function formatMoney(amount: number, currency: string = "EUR"): string {
  const symbol = getCurrencySymbol(currency);
  const formatted = Math.abs(amount).toFixed(2);
  // Put symbol before for EUR/USD/GBP, after for others
  if (["EUR", "USD", "GBP"].includes(currency)) {
    return `${symbol}${formatted}`;
  }
  return `${formatted} ${symbol}`;
}
