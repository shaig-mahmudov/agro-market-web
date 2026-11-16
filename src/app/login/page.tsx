"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { applyAuthResponse } = useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("+994");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"Restaurant" | "Farmer">("Restaurant");
  const [devHint, setDevHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await authApi.sendOtp(phoneNumber);
      setPhoneNumber(res.phoneNumber);
      setDevHint(res.devOtpCode);
      if (res.devOtpCode) setCode(res.devOtpCode);
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send OTP.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await authApi.verifyOtp({
        phoneNumber,
        code,
        fullName: fullName || undefined,
        role,
      });
      applyAuthResponse(res);
      if (res.user.role === "Admin") router.push("/admin");
      else if (res.user.role === "Farmer") router.push("/farmer");
      else router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "OTP verification failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="rounded-2xl border border-[#DCE6DF] bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
          Passwordless Access
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#1B4332]">
          {step === "phone" ? "Sign in or Register" : "Enter 6-Digit OTP"}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Use your phone number to access restaurant procurement, farmer inventory, or admin dispatch.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Account Type (for new users)
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(["Restaurant", "Farmer"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                      role === r
                        ? "border-[#1B4332] bg-[#E9F5EE] text-[#1B4332]"
                        : "border-[#D4DFD7] bg-white text-stone-600"
                    }`}
                  >
                    {r === "Restaurant" ? "Restaurant / Cafe" : "Local Farmer"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Full Name (optional for returning users)
              </label>
              <input
                type="text"
                placeholder="e.g. Leyla Mammadova"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2.5 text-sm focus:border-[#1B4332] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Phone Number (E.164)
              </label>
              <input
                type="tel"
                required
                placeholder="+994501234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2.5 text-sm focus:border-[#1B4332] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#1B4332] py-2.5 text-sm font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-60"
            >
              {submitting ? "Sending OTP..." : "Send Verification Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
            {devHint && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <strong>Development OTP:</strong> <span className="font-mono">{devHint}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Verification Code sent to {phoneNumber}
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2.5 text-center font-mono text-lg tracking-widest focus:border-[#1B4332] focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="rounded-xl border border-[#D4DFD7] px-4 py-2.5 text-sm font-medium text-stone-700"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-[#1B4332] py-2.5 text-sm font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-60"
              >
                {submitting ? "Verifying..." : "Verify & Continue"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
