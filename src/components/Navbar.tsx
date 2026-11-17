"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { CURRENCIES, CurrencyCode, useCurrency } from "@/lib/currency";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
const BASE_PATH =
  rawBasePath && rawBasePath !== "/"
    ? `${rawBasePath.startsWith("/") ? "" : "/"}${rawBasePath.replace(/\/+$/, "")}`
    : "";

export function Navbar() {
  const pathname = usePathname();
  const normalizedPathname =
    pathname && pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
  const { user, logout } = useAuth();
  const { items, totalKg, subtotal } = useCart();
  const { currency, setCurrency, formatPrice } = useCurrency();

  const navLinkClass = (href: string) =>
    `whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      normalizedPathname === href
        ? "bg-[#1B4332] text-white"
        : "text-[#1F2933] hover:bg-[#E9F5EE]"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E8E4] bg-[#FAF9F6]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={`${BASE_PATH}/icon.svg`} alt="AgroMarket" width={32} height={32} className="rounded-lg" />
            <div>
              <span className="text-lg font-bold tracking-tight text-[#1B4332]">
                AgroMarket
              </span>
              <span className="ml-2 hidden rounded-full bg-[#D8F3DC] px-2 py-0.5 text-[11px] font-semibold text-[#1B4332] sm:inline-block">
                B2B Milk-Run
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/" className={navLinkClass("/")}>
              Produce Catalog
            </Link>
            {user && (
              <Link href="/orders" className={navLinkClass("/orders")}>
                Orders
              </Link>
            )}
            {(user?.role === "Farmer" || user?.role === "Admin") && (
              <Link href="/farmer" className={navLinkClass("/farmer")}>
                Farmer Hub
              </Link>
            )}
            {(user?.role === "Admin" || user?.role === "Driver") && (
              <Link href="/logistics" className={navLinkClass("/logistics")}>
                Milk-Run Dispatch
              </Link>
            )}
            {user?.role === "Admin" && (
              <Link href="/admin" className={navLinkClass("/admin")}>
                Admin Verify
              </Link>
            )}
            {user && (
              <Link href="/profile" className={navLinkClass("/profile")}>
                Business Profile
              </Link>
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {/* Currency Switcher */}
          <label className="inline-flex shrink-0 items-center rounded-xl border border-[#D4DFD7] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1B4332] shadow-2xs">
            <span className="sr-only">Currency</span>
            <select
              aria-label="Select currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="cursor-pointer bg-transparent pr-1 font-semibold text-[#1B4332] focus:outline-none"
            >
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {items.length > 0 && (
            <Link
              href="/#cart"
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-[#B7E4C7] bg-[#E9F5EE] px-3 py-1.5 text-xs font-semibold text-[#1B4332] shadow-2xs transition-colors hover:bg-[#D8F3DC]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0 text-[#2D6A4F]"
                aria-hidden="true"
              >
                <path d="M1 1.75A.75.75 0 0 1 1.75 1h1.628a1.75 1.75 0 0 1 1.734 1.51L5.18 3a65.25 65.25 0 0 1 13.36 1.412.75.75 0 0 1 .58.875 48.645 48.645 0 0 1-1.618 6.2.75.75 0 0 1-.712.513H6a2.503 2.503 0 0 0-2.292 1.5H17.25a.75.75 0 0 1 0 1.5H2.76a.75.75 0 0 1-.748-.807 4.002 4.002 0 0 1 2.716-3.486L3.626 2.716a.25.25 0 0 0-.248-.216H1.75A.75.75 0 0 1 1 1.75ZM6 17.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM15.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
              </svg>
              <span className="rounded-md bg-[#1B4332] px-1.5 py-0.5 text-[11px] font-bold text-white">
                {items.length}
              </span>
              <span className="text-[#1B4332]">{totalKg} kg</span>
              <span className="hidden text-[#2D6A4F] sm:inline">
                • {formatPrice(subtotal)}
              </span>
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="hidden items-center gap-2 rounded-lg border border-[#D4DFD7] bg-white px-3 py-1.5 text-xs font-medium text-[#1F2933] sm:inline-flex"
              >
                <span className="font-semibold">{user.fullName}</span>
                <span className="rounded bg-[#F1F5F2] px-1.5 py-0.5 text-[11px] text-[#2D6A4F]">
                  {user.role}
                </span>
                {!user.isVerified && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                    Pending
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-lg border border-[#D4DFD7] bg-white px-3 py-1.5 text-xs font-medium text-[#1F2933] hover:bg-stone-100"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2D6A4F]"
            >
              Sign in (OTP)
            </Link>
          )}
        </div>
      </div>

      {/* Mobile PWA quick nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-[#E2E8E4] px-4 py-2 md:hidden">
        <Link href="/" className={navLinkClass("/")}>
          Catalog
        </Link>
        {user && (
          <Link href="/orders" className={navLinkClass("/orders")}>
            Orders
          </Link>
        )}
        {(user?.role === "Farmer" || user?.role === "Admin") && (
          <Link href="/farmer" className={navLinkClass("/farmer")}>
            Farmer Hub
          </Link>
        )}
        {(user?.role === "Admin" || user?.role === "Driver") && (
          <Link href="/logistics" className={navLinkClass("/logistics")}>
            Logistics
          </Link>
        )}
        {user?.role === "Admin" && (
          <Link href="/admin" className={navLinkClass("/admin")}>
            Admin
          </Link>
        )}
        {user && (
          <Link href="/profile" className={navLinkClass("/profile")}>
            Profile
          </Link>
        )}
      </nav>
    </header>
  );
}
