"use client";

import React, { createContext, useContext, useState } from "react";

export type CurrencyCode = "AZN" | "USD" | "EUR" | "TRY" | "RUB";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  label: string;
  rateFromUsd: number;
  symbolPosition: "prefix" | "suffix";
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  AZN: {
    code: "AZN",
    symbol: "₼",
    label: "AZN ₼",
    rateFromUsd: 1.7,
    symbolPosition: "suffix",
  },
  USD: {
    code: "USD",
    symbol: "$",
    label: "USD $",
    rateFromUsd: 1.0,
    symbolPosition: "prefix",
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    label: "EUR €",
    rateFromUsd: 0.92,
    symbolPosition: "prefix",
  },
  TRY: {
    code: "TRY",
    symbol: "₺",
    label: "TRY ₺",
    rateFromUsd: 34.5,
    symbolPosition: "prefix",
  },
  RUB: {
    code: "RUB",
    symbol: "₽",
    label: "RUB ₽",
    rateFromUsd: 98.0,
    symbolPosition: "suffix",
  },
};

const STORAGE_KEY = "agromarket_currency";

interface CurrencyContextValue {
  currency: CurrencyCode;
  config: CurrencyConfig;
  setCurrency: (code: CurrencyCode) => void;
  formatPrice: (usdAmount: number) => string;
  toDisplayAmount: (usdAmount: number) => number;
  fromDisplayAmount: (displayAmount: number) => number;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    if (typeof window === "undefined") return "AZN";
    const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
    return saved && saved in CURRENCIES ? saved : "AZN";
  });

  const setCurrency = (code: CurrencyCode) => {
    setCurrencyState(code);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, code);
    }
  };

  const config = CURRENCIES[currency];

  const toDisplayAmount = (usdAmount: number) =>
    Number((usdAmount * config.rateFromUsd).toFixed(2));

  const fromDisplayAmount = (displayAmount: number) =>
    Number((displayAmount / config.rateFromUsd).toFixed(2));

  const formatPrice = (usdAmount: number) => {
    const converted = (usdAmount * config.rateFromUsd).toFixed(2);
    return config.symbolPosition === "prefix"
      ? `${config.symbol}${converted}`
      : `${converted} ${config.symbol}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        config,
        setCurrency,
        formatPrice,
        toDisplayAmount,
        fromDisplayAmount,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}
