"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AdminUserItem, UserRole } from "@/lib/types";

export default function AdminVerifyPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [filterVerified, setFilterVerified] = useState<"" | "false" | "true">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!user || user.role !== "Admin") return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listUsers({
        isVerified: filterVerified === "" ? "" : filterVerified === "true",
        search: search || undefined,
      });
      setUsers(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [user, filterVerified, search]);

  useEffect(() => {
    if (!user || user.role !== "Admin") return;
    let active = true;
    adminApi
      .listUsers({
        isVerified: filterVerified === "" ? "" : filterVerified === "true",
        search: search || undefined,
      })
      .then((res) => {
        if (!active) return;
        setUsers(res.items);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : "Failed to load users.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, filterVerified, search]);

  if (!user || user.role !== "Admin") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#DCE6DF] bg-white p-6 text-center">
        <p className="font-semibold">Admin verification console requires Admin role.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-xl bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  async function handleVerifyToggle(item: AdminUserItem, nextVerified: boolean, role?: UserRole) {
    try {
      await adminApi.verifyUser(item.id, nextVerified, role);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification update failed.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332]">Pilot Onboarding & Verification</h1>
          <p className="text-sm text-stone-500">
            Approve pilot farmers, restaurants, and drivers before marketplace activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search phone, name, business..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-[#D4DFD7] bg-white px-3 py-2 text-sm"
          />
          <select
            value={filterVerified}
            onChange={(e) => setFilterVerified(e.target.value as "" | "false" | "true")}
            className="rounded-xl border border-[#D4DFD7] bg-white px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="false">Pending Verification</option>
            <option value="true">Verified</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#E2E8E4] bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E2E8E4] bg-[#F7FAF8] text-xs uppercase text-stone-600">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F3F1]">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  No users matched.
                </td>
              </tr>
            ) : (
              users.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1F2933]">{item.fullName}</p>
                    <p className="text-xs text-stone-500">{item.phoneNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-600">
                    {item.businessName ? (
                      <>
                        <p className="font-semibold text-[#1F2933]">{item.businessName}</p>
                        <p>{item.region}</p>
                      </>
                    ) : (
                      <span className="text-stone-400">No profile yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-semibold">
                      {item.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.isVerified
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.isVerified ? "Verified" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleVerifyToggle(item, !item.isVerified)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          item.isVerified
                            ? "border border-stone-300 text-stone-700 hover:bg-stone-100"
                            : "bg-[#1B4332] text-white hover:bg-[#2D6A4F]"
                        }`}
                      >
                        {item.isVerified ? "Revoke" : "Approve"}
                      </button>
                      {item.role !== "Driver" && item.role !== "Admin" && (
                        <button
                          type="button"
                          onClick={() => void handleVerifyToggle(item, true, "Driver")}
                          className="rounded-lg border border-[#D4DFD7] px-2.5 py-1.5 text-xs font-medium text-[#1B4332] hover:bg-[#E9F5EE]"
                        >
                          Make Driver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
