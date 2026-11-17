"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ApiError,
  logisticsApi,
  ordersApi,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import type {
  DeliveryRun,
  DeliveryRunOrderSummary,
  DeliveryRunStatus,
  Order,
} from "@/lib/types";

const NEXT_RUN_STATUS: Record<DeliveryRunStatus, DeliveryRunStatus | null> = {
  Planned: "PickingUp",
  PickingUp: "InTransit",
  InTransit: "Completed",
  Completed: null,
};

const NEXT_STATUS_LABEL: Record<DeliveryRunStatus, string> = {
  Planned: "Start Farm Pickups (PickingUp)",
  PickingUp: "Depart for Buyers (InTransit)",
  InTransit: "Complete Milk-Run",
  Completed: "Completed",
};

export default function LogisticsPage() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("+99450");
  const [vehicleNote, setVehicleNote] = useState("");
  const [runDate, setRunDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingRunId, setUpdatingRunId] = useState<string | null>(null);
  const [reconcilingOrderId, setReconcilingOrderId] = useState<string | null>(null);
  const [reconcileDrafts, setReconcileDrafts] = useState<
    Record<string, { actualKg: string; rejectedKg: string; proofUrl: string }[]>
  >({});
  const [savingReconcile, setSavingReconcile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAccess = user?.role === "Admin" || user?.role === "Driver";

  const reload = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    try {
      const [runsRes, ordersRes] = await Promise.all([
        logisticsApi.listRuns({ pageSize: 25 }),
        ordersApi.listOrders({ status: "Confirmed", unassignedOnly: true, pageSize: 50 }),
      ]);
      setRuns(runsRes.items);
      setUnassignedOrders(ordersRes.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load logistics data.");
    } finally {
      setLoading(false);
    }
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    let active = true;
    Promise.all([
      logisticsApi.listRuns({ pageSize: 25 }),
      ordersApi.listOrders({ status: "Confirmed", unassignedOnly: true, pageSize: 50 }),
    ])
      .then(([runsRes, ordersRes]) => {
        if (!active) return;
        setRuns(runsRes.items);
        setUnassignedOrders(ordersRes.items);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : "Failed to load logistics data.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canAccess]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#DCE6DF] bg-white p-6 text-center">
        <p className="font-semibold">Sign in to access Milk-Run Dispatch.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-xl bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in with OTP
        </Link>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
        Milk-Run Logistics is restricted to Admin dispatchers and Drivers.
      </div>
    );
  }

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  }

  async function handleCreateRun(e: React.FormEvent) {
    e.preventDefault();
    if (selectedOrderIds.length === 0) {
      setError("Select at least one Confirmed order to create a delivery run.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await logisticsApi.createRun({
        driverName,
        driverPhone,
        vehicleNote: vehicleNote || undefined,
        runDate: runDate || undefined,
        orderIds: selectedOrderIds,
      });
      setDriverName("");
      setVehicleNote("");
      setSelectedOrderIds([]);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create delivery run.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdvanceStatus(run: DeliveryRun) {
    const nextStatus = NEXT_RUN_STATUS[run.status];
    if (!nextStatus) return;

    setUpdatingRunId(run.id);
    setError(null);
    try {
      await logisticsApi.updateRunStatus(run.id, nextStatus);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update run status.");
    } finally {
      setUpdatingRunId(null);
    }
  }

  function openReconcilePanel(order: DeliveryRunOrderSummary) {
    if (reconcilingOrderId === order.id) {
      setReconcilingOrderId(null);
      return;
    }
    setReconcileDrafts((prev) => ({
      ...prev,
      [order.id]: order.items.map((item) => ({
        actualKg: String(item.actualDeliveredWeightKg ?? item.estimatedWeightKg),
        rejectedKg: String(item.rejectedWeightKg ?? 0),
        proofUrl: item.proofPhotoUrl ?? "",
      })),
    }));
    setReconcilingOrderId(order.id);
  }

  function updateDraftField(
    orderId: string,
    index: number,
    field: "actualKg" | "rejectedKg" | "proofUrl",
    value: string
  ) {
    setReconcileDrafts((prev) => {
      const current = prev[orderId] ?? [];
      const next = current.map((row, i) => (i === index ? { ...row, [field]: value } : row));
      return { ...prev, [orderId]: next };
    });
  }

  async function handleSubmitReconcile(order: DeliveryRunOrderSummary) {
    const drafts = reconcileDrafts[order.id];
    if (!drafts || drafts.length !== order.items.length) return;

    setSavingReconcile(true);
    setError(null);
    try {
      await ordersApi.reconcile(
        order.id,
        order.items.map((item, idx) => ({
          orderItemId: item.id,
          actualDeliveredWeightKg: Number(drafts[idx].actualKg || 0),
          rejectedWeightKg: Number(drafts[idx].rejectedKg || 0),
          proofPhotoUrl: drafts[idx].proofUrl.trim() || undefined,
        }))
      );
      setReconcilingOrderId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reconcile delivery weights.");
    } finally {
      setSavingReconcile(false);
    }
  }

  async function handleUploadProofPhoto(orderId: string, idx: number, file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const uploaded = await ordersApi.uploadProofPhoto(orderId, file);
      updateDraftField(orderId, idx, "proofUrl", uploaded.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload scale proof photo.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332]">Morning Milk-Run Dispatch</h1>
          <p className="text-sm text-stone-500">
            Batch farmer-confirmed orders into refrigerated morning runs and update pickup/transit status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-xl border border-[#D4DFD7] bg-white px-4 py-2 text-sm font-semibold text-[#1B4332]"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {user.role === "Admin" && (
        <section className="rounded-2xl border border-[#DCE6DF] bg-white p-5 shadow-xs">
          <h2 className="text-lg font-bold text-[#1B4332]">
            1. Batch Confirmed Orders Into a Delivery Run
          </h2>

          {loading ? (
            <p className="mt-3 text-sm text-stone-500">Loading confirmed orders...</p>
          ) : unassignedOrders.length === 0 ? (
            <p className="mt-3 rounded-xl bg-[#F4F7F5] p-4 text-sm text-stone-600">
              No unassigned Confirmed orders waiting for dispatch right now.
            </p>
          ) : (
            <form onSubmit={(e) => void handleCreateRun(e)} className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {unassignedOrders.map((order) => {
                  const checked = selectedOrderIds.includes(order.id);
                  return (
                    <label
                      key={order.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${
                        checked
                          ? "border-[#1B4332] bg-[#E9F5EE]/50"
                          : "border-[#E2E8E4] bg-[#FAF9F6]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="mt-1 h-4 w-4 accent-[#1B4332]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#1F2933]">
                          {order.farmerName ?? "Farmer"} → {order.restaurantName ?? "Restaurant"}
                        </p>
                        <p className="text-xs text-stone-500">
                          Order #{order.id.slice(0, 8)} •{" "}
                          {order.items.reduce((s, i) => s + i.estimatedWeightKg, 0)} kg •{" "}
                          {formatPrice(order.finalTotalAmount)} ({order.fulfillmentType})
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <input
                  type="text"
                  required
                  placeholder="Driver Full Name"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  placeholder="Driver Phone (+99450...)"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={runDate}
                  onChange={(e) => setRunDate(e.target.value)}
                  className="rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Vehicle / Route Note"
                  value={vehicleNote}
                  onChange={(e) => setVehicleNote(e.target.value)}
                  className="rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500">
                  Selected: {selectedOrderIds.length} confirmed order(s)
                </span>
                <button
                  type="submit"
                  disabled={submitting || selectedOrderIds.length === 0}
                  className="rounded-xl bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                >
                  {submitting ? "Dispatching..." : "Create Morning Milk-Run"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#1B4332]">2. Active & Scheduled Delivery Runs</h2>
        {loading ? (
          <div className="rounded-2xl border border-[#E2E8E4] bg-white p-6 text-center text-sm text-stone-500">
            Loading delivery runs...
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#C7D3CC] bg-white p-6 text-center text-sm text-stone-500">
            No delivery runs scheduled yet.
          </div>
        ) : (
          runs.map((run) => {
            const nextStatus = NEXT_RUN_STATUS[run.status];
            return (
              <div
                key={run.id}
                className="rounded-2xl border border-[#DCE6DF] bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F3F1] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1B4332]">
                        Run {run.runDate} • {run.driverName}
                      </span>
                      <span className="rounded-full bg-[#E9F5EE] px-2.5 py-0.5 text-xs font-semibold text-[#1B4332]">
                        {run.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500">
                      Phone: {run.driverPhone}
                      {run.vehicleNote ? ` • ${run.vehicleNote}` : ""}
                    </p>
                  </div>
                  {nextStatus && (
                    <button
                      type="button"
                      disabled={updatingRunId === run.id}
                      onClick={() => void handleAdvanceStatus(run)}
                      className="rounded-xl bg-[#2D6A4F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1B4332] disabled:opacity-50"
                    >
                      {updatingRunId === run.id ? "Updating..." : NEXT_STATUS_LABEL[run.status]}
                    </button>
                  )}
                </div>

                <div className="mt-3 divide-y divide-[#F0F3F1] text-sm">
                  {run.orders.map((order) => {
                    const canReconcile =
                      order.status === "Confirmed" ||
                      order.status === "PickedUp" ||
                      order.status === "InTransit";
                    const isOpen = reconcilingOrderId === order.id;
                    const drafts = reconcileDrafts[order.id] ?? [];

                    return (
                      <div key={order.id} className="py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[#1F2933]">
                              Pickup: {order.farmerName ?? "Farmer"}
                              {order.farmerAddress ? ` (${order.farmerAddress})` : ""} → Dropoff:{" "}
                              {order.restaurantName ?? "Restaurant"}
                              {order.deliveryAddress ? ` (${order.deliveryAddress})` : ""}
                            </p>
                            <p className="text-xs text-stone-500">
                              Order #{order.id.slice(0, 8)} • Est {order.totalEstimatedWeightKg} kg
                              {" "}• Final {formatPrice(order.finalTotalAmount)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
                              {order.status}
                            </span>
                            {canReconcile && (
                              <button
                                type="button"
                                onClick={() => openReconcilePanel(order)}
                                className="rounded-lg border border-[#1B4332] px-2.5 py-1 text-xs font-semibold text-[#1B4332] hover:bg-[#E9F5EE]"
                              >
                                {isOpen ? "Close Scale Form" : "Reconcile Weights"}
                              </button>
                            )}
                          </div>
                        </div>

                        {isOpen && drafts.length === order.items.length && (
                          <div className="mt-3 space-y-3 rounded-xl border border-[#DCE6DF] bg-[#FAF9F6] p-3 text-xs">
                            <p className="font-semibold text-[#1B4332]">
                              Doorstep Scale & Quality Entry (±10% variance triggers buyer sign-off)
                            </p>
                            {order.items.map((item, idx) => {
                              const est = item.estimatedWeightKg;
                              const actual = Number(drafts[idx].actualKg || 0);
                              const rejected = Number(drafts[idx].rejectedKg || 0);
                              const variancePct =
                                est > 0 ? Math.abs((actual - est) / est) * 100 : 0;
                              const flagged = variancePct > 10 || rejected > 0;

                              return (
                                <div
                                  key={item.id}
                                  className="grid gap-2 rounded-lg border border-[#E2E8E4] bg-white p-2.5 sm:grid-cols-4"
                                >
                                  <div>
                                    <p className="font-semibold text-[#1F2933]">
                                      {item.productTitleSnapshot}
                                    </p>
                                    <p className="text-stone-500">
                                      Est: {est} kg @ {formatPrice(item.unitPriceApplied)}/kg
                                    </p>
                                    {flagged && (
                                      <p className="mt-0.5 font-semibold text-amber-700">
                                        {variancePct.toFixed(1)}% var / {rejected}kg rej → Buyer approval required
                                      </p>
                                    )}
                                  </div>
                                  <label className="block">
                                    <span className="text-stone-600">Actual Weight (kg)</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={drafts[idx].actualKg}
                                      onChange={(e) =>
                                        updateDraftField(order.id, idx, "actualKg", e.target.value)
                                      }
                                      className="mt-1 w-full rounded-lg border border-[#D4DFD7] px-2 py-1 text-xs"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-stone-600">Rejected (kg)</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={drafts[idx].rejectedKg}
                                      onChange={(e) =>
                                        updateDraftField(order.id, idx, "rejectedKg", e.target.value)
                                      }
                                      className="mt-1 w-full rounded-lg border border-[#D4DFD7] px-2 py-1 text-xs"
                                    />
                                  </label>
                                  <label className="block">
                                    <span className="text-stone-600">Scale Photo (Upload / URL)</span>
                                    <input
                                      type="file"
                                      accept="image/webp,image/jpeg,image/png"
                                      onChange={(e) =>
                                        void handleUploadProofPhoto(
                                          order.id,
                                          idx,
                                          e.target.files?.[0] ?? null
                                        )
                                      }
                                      className="mt-1 w-full rounded-lg border border-[#D4DFD7] px-2 py-1 text-[11px]"
                                    />
                                    <input
                                      type="url"
                                      placeholder="or paste https://..."
                                      value={drafts[idx].proofUrl}
                                      onChange={(e) =>
                                        updateDraftField(order.id, idx, "proofUrl", e.target.value)
                                      }
                                      className="mt-1 w-full rounded-lg border border-[#D4DFD7] px-2 py-1 text-xs"
                                    />
                                  </label>
                                </div>
                              );
                            })}
                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={savingReconcile}
                                onClick={() => void handleSubmitReconcile(order)}
                                className="rounded-xl bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                              >
                                {savingReconcile ? "Saving..." : "Submit Reconciled Delivery"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
