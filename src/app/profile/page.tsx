"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, authApi, profileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ProfileResponse, TelegramDeepLinkResponse } from "@/lib/types";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [region, setRegion] = useState("");
  const [address, setAddress] = useState("");
  const [preferredDeliveryWindow, setPreferredDeliveryWindow] = useState("06:00-09:00");
  const [taxId, setTaxId] = useState("");

  const [telegramLink, setTelegramLink] = useState<TelegramDeepLinkResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void profileApi.getMine().then((data) => {
      setProfile(data);
      setFullName(data.fullName);
      if (data.businessProfile) {
        setBusinessName(data.businessProfile.businessName);
        setRegion(data.businessProfile.region);
        setAddress(data.businessProfile.address);
        setPreferredDeliveryWindow(data.businessProfile.preferredDeliveryWindow ?? "06:00-09:00");
        setTaxId(data.businessProfile.taxId ?? "");
      }
    });
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#DCE6DF] bg-white p-6 text-center">
        <p className="font-semibold">Please sign in to manage your business profile.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-xl bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in with OTP
        </Link>
      </div>
    );
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await profileApi.upsertMine({
        fullName,
        businessName,
        region,
        address,
        preferredDeliveryWindow: preferredDeliveryWindow || undefined,
        taxId: taxId || undefined,
      });
      setProfile(updated);
      await refreshUser();
      setMessage("Business profile saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateTelegramLink() {
    setError(null);
    try {
      const link = await authApi.telegramDeepLink();
      setTelegramLink(link);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create Telegram deep-link.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-[#DCE6DF] bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[#1B4332]">Business Profile</h1>
            <p className="text-sm text-stone-500">
              {user.phoneNumber} • Role: <strong>{user.role}</strong>
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              user.isVerified
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {user.isVerified ? "Verified Account" : "Pending Admin Verification"}
          </span>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-stone-700">Contact Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700">
              Farm / Restaurant Name *
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Baku Bistro or Quba Orchards"
              className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700">Region *</label>
            <input
              type="text"
              required
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Baku, Quba, Lankaran"
              className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700">
              Preferred Delivery Window
            </label>
            <input
              type="text"
              value={preferredDeliveryWindow}
              onChange={(e) => setPreferredDeliveryWindow(e.target.value)}
              placeholder="06:00-09:00"
              className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-stone-700">Full Address *</label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700">Tax ID (VOEN)</label>
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#1B4332] py-2.5 text-sm font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>

      {/* Telegram Notification Linking */}
      <div className="rounded-2xl border border-[#DCE6DF] bg-white p-6 shadow-xs">
        <h2 className="text-lg font-bold text-[#1B4332]">Telegram Order Alerts</h2>
        <p className="mt-1 text-sm text-stone-600">
          {profile?.telegramChatId
            ? `Linked to Telegram chat ID ${profile.telegramChatId}.`
            : "Link your Telegram account to receive instant morning order alerts and inline [Accept] / [Reject] buttons."}
        </p>

        <button
          type="button"
          onClick={handleGenerateTelegramLink}
          className="mt-4 rounded-xl border border-[#1B4332] px-4 py-2 text-sm font-semibold text-[#1B4332] hover:bg-[#E9F5EE]"
        >
          Generate Telegram Deep-Link
        </button>

        {telegramLink && (
          <div className="mt-4 rounded-xl bg-[#F7FAF8] p-4 text-xs">
            <p className="font-semibold text-[#1B4332]">Deep-Link URL (valid 15 min):</p>
            <a
              href={telegramLink.deepLinkUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all font-mono text-emerald-700 underline"
            >
              {telegramLink.deepLinkUrl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
