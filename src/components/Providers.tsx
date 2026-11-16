"use client";

import React from "react";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { Navbar } from "./Navbar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <div className="flex min-h-screen flex-col bg-[#FAF9F6] text-[#1F2933]">
          <Navbar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
      </CartProvider>
    </AuthProvider>
  );
}
