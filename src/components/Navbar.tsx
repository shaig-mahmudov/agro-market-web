"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";

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
  const { items, totalKg } = useCart();

  const navLinkClass = (href: string) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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

        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <Link
              href="/#cart"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#D8F3DC] px-3 py-1.5 text-xs font-semibold text-[#1B4332]"
            >
              <span>Cart:</span>
              <span>{items.length} items</span>
              <span className="text-[#2D6A4F]">({totalKg} kg)</span>
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
