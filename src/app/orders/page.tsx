"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, ApiError, ordersApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CheckoutGroup, Order, PaymentMethod, PaymentStatus } from "@/lib/types";

export default function OrdersPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<CheckoutGroup[]>([]);
  const [farmerOrders, setFarmerOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repeatingId, setRepeatingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [invoiceGroup, setInvoiceGroup] = useState<CheckoutGroup | null>(null);

  const [reconcilingOrderId, setReconcilingOrderId] = useState<string | null>(null);
  const [reconcileDrafts, setReconcileDrafts] = useState<
    Record<string, { actualKg: string; rejectedKg: string; proofUrl: string }[]>
  >({});
  const [savingReconcile, setSavingReconcile] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (user.role === "Farmer") {
        const res = await ordersApi.listOrders();
        setFarmerOrders(res.items);
      } else {
        const res = await ordersApi.listCheckoutGroups();
        setGroups(res.items);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const req =
      user.role === "Farmer"
        ? ordersApi.listOrders().then((res) => {
            if (active) setFarmerOrders(res.items);
          })
        : ordersApi.listCheckoutGroups().then((res) => {
            if (active) setGroups(res.items);
          });

    req
      .catch((err) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : "Failed to load orders.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#DCE6DF] bg-white p-6 text-center">
        <p className="font-semibold">Sign in to view your orders.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-xl bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in with OTP
        </Link>
      </div>
    );
  }

  async function handleRepeat(checkoutGroupId: string) {
    setRepeatingId(checkoutGroupId);
    setError(null);
    try {
      await ordersApi.repeatOrder(checkoutGroupId);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not repeat order.");
    } finally {
      setRepeatingId(null);
    }
  }

  async function handleRespond(orderId: string, accept: boolean) {
    setRespondingId(orderId);
    setError(null);
    try {
      await ordersApi.respond(orderId, accept);
      await reload();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : accept
            ? "Could not confirm order."
            : "Could not reject order."
      );
    } finally {
      setRespondingId(null);
    }
  }

  async function handleConfirmReceipt(orderId: string, approve: boolean) {
    setConfirmingId(orderId);
    setError(null);
    try {
      const note = disputeNotes[orderId]?.trim() || undefined;
      await ordersApi.confirmReceipt(orderId, approve, note);
      await reload();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : approve
            ? "Could not approve delivery weight."
            : "Could not dispute delivery."
      );
    } finally {
      setConfirmingId(null);
    }
  }

  function openFarmerReconcile(order: Order) {
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

  async function handleUploadFarmerProofPhoto(orderId: string, idx: number, file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const uploaded = await ordersApi.uploadProofPhoto(orderId, file);
      setReconcileDrafts((prev) => ({
        ...prev,
        [orderId]: (prev[orderId] ?? []).map((r, i) =>
          i === idx ? { ...r, proofUrl: uploaded.url } : r
        ),
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload scale proof photo.");
    }
  }

  async function handleSubmitFarmerReconcile(order: Order) {
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

  async function handleSetPaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
    paymentMethod?: PaymentMethod
  ) {
    setPayingOrderId(orderId);
    setError(null);
    try {
      await adminApi.markOrderPaid(orderId, paymentStatus, paymentMethod);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update payment status.");
    } finally {
      setPayingOrderId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332]">
            {user.role === "Farmer" ? "Incoming Farm Orders" : "Consolidated Orders"}
          </h1>
          <p className="text-sm text-stone-500">
            {user.role === "Farmer"
              ? "Orders split from morning restaurant checkouts."
              : "Multi-farmer checkouts grouped into one next-morning delivery with 1-click repeat ordering."}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-xl border border-[#D4DFD7] bg-white px-4 py-2 text-sm font-semibold text-[#1B4332]"
        >
          Browse Produce
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#E2E8E4] bg-white p-8 text-center text-sm text-stone-500">
          Loading orders...
        </div>
      ) : user.role === "Farmer" ? (
        farmerOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#C7D3CC] bg-white p-8 text-center text-sm text-stone-500">
            No incoming orders yet.
          </div>
        ) : (
          <div className="space-y-4">
            {farmerOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-[#E2E8E4] bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#1F2933]">
                      Buyer: {order.restaurantName ?? "Restaurant"}
                    </p>
                    <p className="text-xs text-stone-500">
                      Order #{order.id.slice(0, 8)} • Expires{" "}
                      {new Date(order.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#E9F5EE] px-3 py-1 text-xs font-semibold text-[#1B4332]">
                    {order.status}
                  </span>
                </div>
                <div className="mt-3 divide-y divide-[#F0F3F1] text-sm">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between py-1.5">
                      <span>
                        {item.productTitleSnapshot} ({item.estimatedWeightKg} kg × $
                        {item.unitPriceApplied.toFixed(2)})
                      </span>
                      <span className="font-semibold">
                        ${(item.estimatedWeightKg * item.unitPriceApplied).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                {order.disputeNote && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                    <strong>Buyer Dispute Note:</strong> {order.disputeNote}
                  </div>
                )}
                {order.status === "Pending" && (
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[#F0F3F1] pt-3">
                    <button
                      type="button"
                      disabled={respondingId === order.id}
                      onClick={() => void handleRespond(order.id, false)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {respondingId === order.id ? "Updating..." : "Reject & Restore Stock"}
                    </button>
                    <button
                      type="button"
                      disabled={respondingId === order.id}
                      onClick={() => void handleRespond(order.id, true)}
                      className="rounded-xl bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                    >
                      {respondingId === order.id ? "Updating..." : "Accept Order"}
                    </button>
                  </div>
                )}
                {order.fulfillmentType === "FarmerDelivery" && order.status === "Confirmed" && (
                  <div className="mt-4 border-t border-[#F0F3F1] pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-600">
                        Self-Delivery (FarmerDelivery) — record scale weights on handover:
                      </span>
                      <button
                        type="button"
                        onClick={() => openFarmerReconcile(order)}
                        className="rounded-lg border border-[#1B4332] px-3 py-1.5 text-xs font-semibold text-[#1B4332] hover:bg-[#E9F5EE]"
                      >
                        {reconcilingOrderId === order.id ? "Close Form" : "Reconcile Weights"}
                      </button>
                    </div>
                    {reconcilingOrderId === order.id && reconcileDrafts[order.id] && (
                      <div className="mt-3 space-y-2 rounded-xl border border-[#DCE6DF] bg-[#FAF9F6] p-3 text-xs">
                        {order.items.map((item, idx) => (
                          <div
                            key={item.id}
                            className="grid gap-2 rounded-lg border border-[#E2E8E4] bg-white p-2.5 sm:grid-cols-4"
                          >
                            <div>
                              <p className="font-semibold text-[#1F2933]">
                                {item.productTitleSnapshot}
                              </p>
                              <p className="text-stone-500">Est: {item.estimatedWeightKg} kg</p>
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Actual kg"
                              value={reconcileDrafts[order.id][idx]?.actualKg ?? ""}
                              onChange={(e) =>
                                setReconcileDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: prev[order.id].map((r, i) =>
                                    i === idx ? { ...r, actualKg: e.target.value } : r
                                  ),
                                }))
                              }
                              className="rounded-lg border border-[#D4DFD7] px-2 py-1"
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Rejected kg"
                              value={reconcileDrafts[order.id][idx]?.rejectedKg ?? ""}
                              onChange={(e) =>
                                setReconcileDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: prev[order.id].map((r, i) =>
                                    i === idx ? { ...r, rejectedKg: e.target.value } : r
                                  ),
                                }))
                              }
                              className="rounded-lg border border-[#D4DFD7] px-2 py-1"
                            />
                            <div className="space-y-1">
                              <input
                                type="file"
                                accept="image/webp,image/jpeg,image/png,.png,.jpg,.jpeg,.webp"
                                onChange={(e) =>
                                  void handleUploadFarmerProofPhoto(
                                    order.id,
                                    idx,
                                    e.target.files?.[0] ?? null
                                  )
                                }
                                className="w-full rounded-lg border border-[#D4DFD7] px-2 py-1 text-[11px]"
                              />
                              <input
                                type="url"
                                placeholder="Proof photo URL (optional)"
                                value={reconcileDrafts[order.id][idx]?.proofUrl ?? ""}
                                onChange={(e) =>
                                  setReconcileDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: prev[order.id].map((r, i) =>
                                      i === idx ? { ...r, proofUrl: e.target.value } : r
                                    ),
                                  }))
                                }
                                className="w-full rounded-lg border border-[#D4DFD7] px-2 py-1"
                              />
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={savingReconcile}
                            onClick={() => void handleSubmitFarmerReconcile(order)}
                            className="rounded-lg bg-[#1B4332] px-3.5 py-1.5 font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                          >
                            {savingReconcile ? "Saving..." : "Submit Reconciled Weights"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C7D3CC] bg-white p-8 text-center text-sm text-stone-500">
          You have not placed any consolidated orders yet.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const grandTotal = group.orders
              .filter((o) => o.status !== "Cancelled")
              .reduce((acc, o) => acc + o.finalTotalAmount, 0)
              .toFixed(2);

            return (
              <section
                key={group.id}
                className="rounded-2xl border border-[#DCE6DF] bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F3F1] pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
                      Scheduled Morning Delivery: {group.scheduledDeliveryDate}
                    </p>
                    <h2 className="text-lg font-bold text-[#1B4332]">
                      Checkout #{group.id.slice(0, 8)} — ${grandTotal}
                    </h2>
                    <p className="text-xs text-stone-500">
                      Deliver to: {group.deliveryAddress} • Delivery Fee: $
                      {group.totalDeliveryFee.toFixed(2)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInvoiceGroup(group)}
                      className="rounded-xl border border-[#1B4332] bg-white px-3.5 py-2 text-xs font-semibold text-[#1B4332] hover:bg-[#E9F5EE]"
                    >
                      Consolidated Invoice
                    </button>
                    <button
                      type="button"
                      disabled={repeatingId === group.id}
                      onClick={() => void handleRepeat(group.id)}
                      className="rounded-xl bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-60"
                    >
                      {repeatingId === group.id ? "Repeating..." : "1-Click Repeat Order"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {group.orders.map((order) => {
                    const needsApproval =
                      order.status === "DeliveredPendingApproval" || order.status === "Disputed";
                    const canBuyerConfirm =
                      needsApproval && (user.role === "Restaurant" || user.role === "Admin");
                    const isAdmin = user.role === "Admin";

                    return (
                      <div
                        key={order.id}
                        className="rounded-xl border border-[#E2E8E4] bg-[#FAF9F6] p-3.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-[#1F2933]">
                            {order.farmerName ?? "Farm"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 font-semibold ${
                                order.paymentStatus === "Paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : order.paymentStatus === "Disputed"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-stone-200 text-stone-700"
                              }`}
                            >
                              {order.paymentMethod} • {order.paymentStatus}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 font-semibold ${
                                order.status === "DeliveredPendingApproval" ||
                                order.status === "Disputed"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-[#D8F3DC] text-[#1B4332]"
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 space-y-1">
                          {order.items.map((item) => {
                            const hasActual = item.actualDeliveredWeightKg !== null;
                            const chargeableKg = hasActual
                              ? Math.max(
                                  0,
                                  (item.actualDeliveredWeightKg ?? 0) -
                                    (item.rejectedWeightKg ?? 0)
                                )
                              : item.estimatedWeightKg;

                            return (
                              <div key={item.id} className="space-y-0.5 text-stone-700">
                                <div className="flex justify-between">
                                  <span>
                                    {item.productTitleSnapshot} (
                                    {hasActual
                                      ? `Actual ${item.actualDeliveredWeightKg} kg`
                                      : `Est ${item.estimatedWeightKg} kg`}
                                    {(item.rejectedWeightKg ?? 0) > 0
                                      ? `, Rej ${item.rejectedWeightKg} kg`
                                      : ""}{" "}
                                    @ ${item.unitPriceApplied.toFixed(2)}/kg)
                                  </span>
                                  <span className="font-semibold">
                                    ${(chargeableKg * item.unitPriceApplied).toFixed(2)}
                                  </span>
                                </div>
                                {item.proofPhotoUrl && (
                                  <a
                                    href={item.proofPhotoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-medium text-[#2D6A4F] underline"
                                  >
                                    View delivery/scale proof
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-2 flex justify-between border-t border-[#E2E8E4] pt-2 font-semibold text-[#1B4332]">
                          <span>
                            Final Total (incl. ${order.platformFeeAmount.toFixed(2)} fee + $
                            {order.deliveryFeeAmount.toFixed(2)} deliv.)
                          </span>
                          <span>${order.finalTotalAmount.toFixed(2)}</span>
                        </div>

                        {order.disputeNote && (
                          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-800">
                            <strong>Dispute Note:</strong> {order.disputeNote}
                          </div>
                        )}

                        {canBuyerConfirm && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                            <p className="font-semibold text-amber-900">
                              {order.status === "Disputed"
                                ? "Order disputed — approve updated weight once resolved."
                                : "Weight variance (> ±10%) or rejected produce requires buyer sign-off."}
                            </p>
                            {order.status === "DeliveredPendingApproval" && (
                              <input
                                type="text"
                                placeholder="Reason for dispute (optional if approving, e.g. 3kg bruised)"
                                value={disputeNotes[order.id] ?? ""}
                                onChange={(e) =>
                                  setDisputeNotes((prev) => ({
                                    ...prev,
                                    [order.id]: e.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs focus:border-[#1B4332] focus:outline-none"
                              />
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={confirmingId === order.id}
                                onClick={() => void handleConfirmReceipt(order.id, true)}
                                className="rounded-lg bg-[#1B4332] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                              >
                                {confirmingId === order.id ? "Saving..." : "Approve Final Weight"}
                              </button>
                              {order.status === "DeliveredPendingApproval" && (
                                <button
                                  type="button"
                                  disabled={confirmingId === order.id}
                                  onClick={() => void handleConfirmReceipt(order.id, false)}
                                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Dispute Delivery
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {isAdmin && order.status !== "Cancelled" && (
                          <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 border-t border-[#E2E8E4] pt-2">
                            {order.paymentStatus !== "Paid" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={payingOrderId === order.id}
                                  onClick={() =>
                                    void handleSetPaymentStatus(order.id, "Paid", "CashOnDelivery")
                                  }
                                  className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                                >
                                  Mark Paid (COD)
                                </button>
                                <button
                                  type="button"
                                  disabled={payingOrderId === order.id}
                                  onClick={() =>
                                    void handleSetPaymentStatus(order.id, "Paid", "BankTransfer")
                                  }
                                  className="rounded-lg border border-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  Bank Transfer Paid
                                </button>
                                <button
                                  type="button"
                                  disabled={payingOrderId === order.id}
                                  onClick={() =>
                                    void handleSetPaymentStatus(order.id, "Paid", "WeeklyInvoice")
                                  }
                                  className="rounded-lg border border-stone-300 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                                >
                                  Weekly Invoice Paid
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={payingOrderId === order.id}
                                onClick={() => void handleSetPaymentStatus(order.id, "Unpaid")}
                                className="rounded-lg border border-stone-300 px-2.5 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                              >
                                Revert to Unpaid
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Consolidated B2B Invoice Modal */}
      {invoiceGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#DCE6DF] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-[#E2E8E4] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
                  AgroMarket B2B Consolidated Statement
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#1B4332]">
                  Invoice #{invoiceGroup.id.slice(0, 8).toUpperCase()}
                </h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  Scheduled Delivery: {invoiceGroup.scheduledDeliveryDate} • Issued{" "}
                  {new Date(invoiceGroup.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg bg-[#1B4332] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceGroup(null)}
                  className="rounded-lg border border-[#D4DFD7] px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl bg-[#F7FAF8] p-4 text-xs sm:grid-cols-2">
              <div>
                <p className="font-semibold text-[#1B4332]">Bill To (Restaurant Buyer)</p>
                <p className="mt-1 font-bold text-[#1F2933]">
                  {invoiceGroup.restaurantName ??
                    invoiceGroup.orders[0]?.restaurantName ??
                    "Restaurant Buyer"}
                </p>
                {(invoiceGroup.restaurantTaxId ?? invoiceGroup.orders[0]?.restaurantTaxId) && (
                  <p className="text-stone-600">
                    Tax ID (VOEN):{" "}
                    {invoiceGroup.restaurantTaxId ?? invoiceGroup.orders[0]?.restaurantTaxId}
                  </p>
                )}
                <p className="text-stone-600">Address: {invoiceGroup.deliveryAddress}</p>
              </div>
              <div className="sm:text-right">
                <p className="font-semibold text-[#1B4332]">Settlement Summary</p>
                <p className="mt-1 text-stone-600">
                  Method: <strong>{invoiceGroup.orders[0]?.paymentMethod ?? "COD"}</strong>
                </p>
                <p className="text-stone-600">
                  Active Farm Sub-Orders:{" "}
                  <strong>
                    {invoiceGroup.orders.filter((o) => o.status !== "Cancelled").length}
                  </strong>
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {invoiceGroup.orders
                .filter((o) => o.status !== "Cancelled")
                .map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-[#E2E8E4] p-3.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between border-b border-[#F0F3F1] pb-2">
                      <div>
                        <span className="font-bold text-[#1F2933]">
                          Supplier: {order.farmerName ?? "Verified Farm"}
                        </span>
                        {order.farmerTaxId && (
                          <span className="ml-2 text-stone-500">
                            (VOEN: {order.farmerTaxId})
                          </span>
                        )}
                      </div>
                      <span className="text-stone-500">
                        Order #{order.id.slice(0, 8)} • {order.status} ({order.paymentStatus})
                      </span>
                    </div>

                    <table className="mt-2 w-full text-left">
                      <thead className="text-[11px] uppercase text-stone-500">
                        <tr>
                          <th className="py-1">Item</th>
                          <th className="py-1 text-right">Est / Chargeable kg</th>
                          <th className="py-1 text-right">Unit Price</th>
                          <th className="py-1 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F3F1]">
                        {order.items.map((item) => {
                          const hasActual = item.actualDeliveredWeightKg !== null;
                          const chargeableKg = hasActual
                            ? Math.max(
                                0,
                                (item.actualDeliveredWeightKg ?? 0) -
                                  (item.rejectedWeightKg ?? 0)
                              )
                            : item.estimatedWeightKg;
                          return (
                            <tr key={item.id}>
                              <td className="py-1.5 font-medium text-[#1F2933]">
                                {item.productTitleSnapshot}
                              </td>
                              <td className="py-1.5 text-right text-stone-600">
                                {item.estimatedWeightKg} kg →{" "}
                                <strong>{chargeableKg.toFixed(2)} kg</strong>
                              </td>
                              <td className="py-1.5 text-right text-stone-600">
                                ${item.unitPriceApplied.toFixed(2)}/kg
                              </td>
                              <td className="py-1.5 text-right font-semibold">
                                ${(chargeableKg * item.unitPriceApplied).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="mt-2 flex flex-wrap justify-between border-t border-[#F0F3F1] pt-2 text-[11px] text-stone-600">
                      <span>
                        Platform Fee: ${order.platformFeeAmount.toFixed(2)} • Split Delivery Fee: $
                        {order.deliveryFeeAmount.toFixed(2)}
                      </span>
                      <span className="font-bold text-[#1B4332]">
                        Sub-Order Total: ${order.finalTotalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[#DCE6DF] pt-4 text-base font-bold text-[#1B4332]">
              <span>Consolidated Grand Total</span>
              <span>
                $
                {invoiceGroup.orders
                  .filter((o) => o.status !== "Cancelled")
                  .reduce((sum, o) => sum + o.finalTotalAmount, 0)
                  .toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
