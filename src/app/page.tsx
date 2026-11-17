"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ordersApi, productsApi, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { computeEffectiveUnitPrice, useCart } from "@/lib/cart";
import { useCurrency } from "@/lib/currency";
import type { FulfillmentType, PaymentMethod, Product } from "@/lib/types";

const CATEGORIES = ["", "Tomatoes", "Cucumbers", "Potatoes", "Greens", "Fruits", "Onions"];

function categoryForSearch(value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  if (!normalized) return undefined;

  return CATEGORIES.find((category) => {
    if (!category) return false;
    const categoryName = category.toLocaleLowerCase();
    return categoryName === normalized || categoryName.slice(0, -1) === normalized;
  });
}

export default function CatalogPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, farmerGroups, totalKg, subtotal, addItem, updateQuantity, removeItem, clearCart } =
    useCart();
  const { formatPrice } = useCurrency();

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [isOrganic, setIsOrganic] = useState(false);

  const [qtyInputs, setQtyInputs] = useState<Record<string, number>>({});
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [scheduledDeliveryDate, setScheduledDeliveryDate] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>("PlatformCourier");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CashOnDelivery");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  async function handleCheckout() {
    if (!user) {
      router.push("/login");
      return;
    }
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      await ordersApi.checkout({
        items: items.map((i) => ({ productId: i.product.id, weightKg: i.quantityKg })),
        deliveryAddress: deliveryAddress.trim() || undefined,
        scheduledDeliveryDate: scheduledDeliveryDate || undefined,
        fulfillmentType,
        paymentMethod,
      });
      clearCart();
      router.push("/orders");
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : "Checkout failed.");
    } finally {
      setCheckingOut(false);
    }
  }

  useEffect(() => {
    let active = true;
    const searchedCategory = categoryForSearch(search);
    const catalogCategory = category || searchedCategory;
    productsApi
      .listCatalog({
        category: catalogCategory || undefined,
        region: region || undefined,
        search: searchedCategory ? undefined : search || undefined,
        isOrganic: isOrganic || undefined,
        page,
        pageSize: 12,
      })
      .then((res) => {
        if (!active) return;
        setProducts(res.items);
        setTotalPages(Math.max(1, res.totalPages));
        setTotalCount(res.totalCount);
        setError(null);
        setQtyInputs((prev) => {
          const next = { ...prev };
          for (const p of res.items) {
            if (next[p.id] === undefined) {
              next[p.id] = p.minOrderKg;
            }
          }
          return next;
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : "Failed to load produce catalog.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, region, search, isOrganic, page]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Left: Catalog & Filters */}
      <section className="space-y-6 lg:col-span-8">
        <div className="rounded-2xl border border-[#DCE6DF] bg-[#1B4332] p-6 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#95D5B2]">
                First-Hand Farm-Gate Prices • Direct From Regional Producers
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Buy Direct at First-Hand Farmer Prices
              </h1>
              <p className="mt-1.5 text-sm text-[#D8F3DC]">
                Zero middleman markup — pay the exact farm-gate wholesale price farmers sell at the field/orchard gate, delivered in one consolidated morning Milk-Run (06:00–10:00).
              </p>
            </div>
            {!user && (
              <Link
                href="/login"
                className="rounded-xl bg-[#52B788] px-4 py-2.5 text-sm font-semibold text-[#081C15] hover:bg-[#74C69D]"
              >
                Sign in with Phone OTP
              </Link>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="rounded-2xl border border-[#E2E8E4] bg-white p-4 shadow-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="text"
              placeholder="Search tomatoes, farm..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none sm:col-span-2"
            />
            <input
              type="text"
              placeholder="Region (e.g. Quba, Zira)"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm focus:border-[#1B4332] focus:outline-none"
            />
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={isOrganic}
                onChange={(e) => {
                  setIsOrganic(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 accent-[#1B4332]"
              />
              <span>Organic only</span>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat || "all"}
                type="button"
                onClick={() => {
                  setCategory(cat);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  category === cat
                    ? "bg-[#1B4332] text-white"
                    : "bg-[#F1F5F2] text-[#1F2933] hover:bg-[#D8F3DC]"
                }`}
              >
                {cat || "All Categories"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-56 animate-pulse rounded-2xl border border-[#E2E8E4] bg-white p-5"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#C7D3CC] bg-white p-10 text-center">
            <p className="text-base font-semibold text-[#1F2933]">
              No active produce listings match your filters.
            </p>
            <p className="mt-1 text-sm text-stone-500">
              Verified farmers can publish daily harvest listings from the{" "}
              <Link href="/farmer" className="font-semibold text-[#1B4332] underline">
                Farmer Hub
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {products.map((product) => {
              const selectedQty = qtyInputs[product.id] ?? product.minOrderKg;
              const unitPrice = computeEffectiveUnitPrice(
                product.basePricePerKg,
                product.priceTiers,
                selectedQty
              );
              const outOfStock = product.availableStockKg < product.minOrderKg;

              return (
                <article
                  key={product.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#E2E8E4] bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
                >
                  <div>
                    {product.imageUrls && product.imageUrls.length > 0 && (
                      <div className="mb-3 overflow-hidden rounded-xl border border-[#E2E8E4] bg-[#F7FAF8]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.imageUrls[0]}
                          alt={product.title}
                          className="h-36 w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block rounded-full bg-[#E9F5EE] px-2.5 py-0.5 text-[11px] font-semibold text-[#1B4332]">
                          {product.category}
                        </span>
                        {product.metadata.isOrganic && (
                          <span className="ml-1.5 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            Organic
                          </span>
                        )}
                        <h2 className="mt-2 text-lg font-bold text-[#1F2933]">
                          {product.title}
                        </h2>
                        <p className="text-xs text-stone-500">
                          {product.farmer?.businessName || product.farmer?.fullName || "Local Farm"}
                          {product.farmer?.region ? ` • ${product.farmer.region}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="whitespace-nowrap text-xl font-bold text-[#1B4332]">
                          {formatPrice(unitPrice)}
                          <span className="text-xs font-normal text-stone-500">/kg</span>
                        </p>
                        {unitPrice < product.basePricePerKg ? (
                          <p className="whitespace-nowrap text-[11px] font-medium text-emerald-700">
                            Tier applied (base {formatPrice(product.basePricePerKg)})
                          </p>
                        ) : (
                          <p className="whitespace-nowrap text-[11px] text-stone-400">
                            Farm-gate rate
                          </p>
                        )}
                      </div>
                    </div>

                    {product.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-stone-600">
                        {product.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
                      <span className="rounded-md bg-stone-100 px-2 py-1">
                        Stock: <strong>{product.availableStockKg} kg</strong>
                      </span>
                      <span className="rounded-md bg-stone-100 px-2 py-1">
                        Min order: <strong>{product.minOrderKg} kg</strong>
                      </span>
                      {product.metadata.grade && (
                        <span className="rounded-md bg-stone-100 px-2 py-1">
                          Grade: {product.metadata.grade}
                        </span>
                      )}
                      {product.metadata.packaging && (
                        <span className="rounded-md bg-stone-100 px-2 py-1">
                          {product.metadata.packaging}
                        </span>
                      )}
                    </div>

                    {product.priceTiers.length > 0 && (
                      <div className="mt-3 rounded-xl bg-[#F7FAF8] p-2.5 text-xs">
                        <p className="font-semibold text-[#1B4332]">
                          Bulk Farm-Gate Volume Tiers
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {product.priceTiers.map((tier, idx) => (
                            <span
                              key={tier.id ?? idx}
                              className="whitespace-nowrap rounded border border-[#D4DFD7] bg-white px-2 py-0.5"
                            >
                              {tier.minQuantityKg}+ kg →{" "}
                              <strong>{formatPrice(tier.pricePerKg)}/kg</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-[#F0F3F1] pt-4">
                    <input
                      type="number"
                      min={product.minOrderKg}
                      max={product.availableStockKg}
                      step="1"
                      value={selectedQty}
                      onChange={(e) =>
                        setQtyInputs((prev) => ({
                          ...prev,
                          [product.id]: Number(e.target.value) || product.minOrderKg,
                        }))
                      }
                      disabled={outOfStock}
                      className="w-24 rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm font-medium focus:border-[#1B4332] focus:outline-none"
                    />
                    <span className="text-xs text-stone-500">kg</span>
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => addItem(product, selectedQty)}
                      className="ml-auto rounded-xl bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2D6A4F] disabled:cursor-not-allowed disabled:bg-stone-300"
                    >
                      {outOfStock ? "Out of stock" : "Add to Cart"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between rounded-2xl border border-[#E2E8E4] bg-white px-4 py-3 text-xs">
            <span className="text-stone-600">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} listings)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[#D4DFD7] px-3 py-1.5 font-semibold text-[#1B4332] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-[#D4DFD7] px-3 py-1.5 font-semibold text-[#1B4332] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Right: Multi-Farmer Milk-Run Cart Preview */}
      <aside id="cart" className="lg:col-span-4">
        <div className="sticky top-20 rounded-2xl border border-[#DCE6DF] bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-2 border-b border-[#F0F3F1] pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1B4332]">Morning Cart</h2>
                {items.length > 0 && (
                  <span className="whitespace-nowrap rounded-full bg-[#D8F3DC] px-2.5 py-0.5 text-xs font-bold text-[#1B4332]">
                    {items.length} {items.length === 1 ? "item" : "items"} • {totalKg} kg
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-stone-500">
                {farmerGroups.length === 0
                  ? "Multi-farmer orders group into 1 morning delivery"
                  : `${farmerGroups.length} farm${farmerGroups.length > 1 ? "s" : ""} → 1 consolidated milk-run`}
              </p>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                Clear all
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-stone-500">
              Add produce from verified farms to preview your consolidated morning order.
            </div>
          ) : (
            <div className="mt-4 space-y-3.5">
              {farmerGroups.map((group) => (
                <div
                  key={group.farmerId}
                  className="rounded-xl border border-[#E2E8E4] bg-[#FAF9F6] p-3"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[#E8EFEA] pb-2 text-xs font-semibold text-[#1B4332]">
                    <span className="truncate">
                      {group.farmerName}
                      {group.region ? ` • ${group.region}` : ""}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-bold">
                      {formatPrice(group.subtotal)}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.product.id}
                        className="rounded-xl border border-[#E8EFEA] bg-white p-2.5 text-xs shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-[#1F2933]">
                            {item.product.title}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeItem(item.product.id)}
                            className="shrink-0 rounded px-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="whitespace-nowrap text-stone-500">
                            {formatPrice(item.unitPrice)}/kg
                          </span>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={item.product.minOrderKg}
                              max={item.product.availableStockKg}
                              value={item.quantityKg}
                              onChange={(e) =>
                                updateQuantity(
                                  item.product.id,
                                  Number(e.target.value) || item.product.minOrderKg
                                )
                              }
                              className="w-16 rounded-lg border border-[#D4DFD7] px-2 py-1 text-right font-semibold text-[#1F2933] focus:border-[#1B4332] focus:outline-none"
                            />
                            <span className="text-stone-500">kg</span>
                          </div>

                          <span className="whitespace-nowrap font-bold text-[#1B4332]">
                            {formatPrice(item.lineTotal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="space-y-3 border-t border-[#E2E8E4] pt-4 text-sm">
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>Total Weight</span>
                  <span className="whitespace-nowrap font-semibold text-[#1F2933]">
                    {totalKg} kg
                  </span>
                </div>
                <div className="flex items-center justify-between text-base font-bold text-[#1B4332]">
                  <span>Estimated Produce Subtotal</span>
                  <span className="whitespace-nowrap">{formatPrice(subtotal)}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Delivery Address (optional if saved in profile)
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Use saved Business Profile address"
                    className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Fulfillment
                    </label>
                    <select
                      value={fulfillmentType}
                      onChange={(e) => setFulfillmentType(e.target.value as FulfillmentType)}
                      className="mt-1 w-full rounded-xl border border-[#D4DFD7] bg-white px-2.5 py-2 text-xs"
                    >
                      <option value="PlatformCourier">Morning Milk-Run</option>
                      <option value="FarmerDelivery">Farmer Delivery</option>
                      <option value="BuyerPickup">Buyer Pickup (Free)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Delivery Date
                    </label>
                    <input
                      type="date"
                      value={scheduledDeliveryDate}
                      onChange={(e) => setScheduledDeliveryDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-2.5 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="mt-1 w-full rounded-xl border border-[#D4DFD7] bg-white px-3 py-2 text-xs"
                  >
                    <option value="CashOnDelivery">Cash on Delivery (COD)</option>
                    <option value="BankTransfer">Bank Transfer on Handover</option>
                    <option value="WeeklyInvoice">Weekly Consolidated Invoice</option>
                  </select>
                </div>

                {checkoutError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                    {checkoutError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={checkingOut}
                  onClick={() => void handleCheckout()}
                  className="w-full rounded-xl bg-[#1B4332] py-2.5 text-sm font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-60"
                >
                  {checkingOut
                    ? "Placing Consolidated Order..."
                    : user
                      ? "Place Consolidated Order"
                      : "Sign in to Checkout"}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
