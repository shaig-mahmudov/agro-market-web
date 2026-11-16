"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, productsApi, uploadFileWithPresignedUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Product } from "@/lib/types";

export default function FarmerHubPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState("Tomatoes");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [availableStockKg, setAvailableStockKg] = useState("150");
  const [minOrderKg, setMinOrderKg] = useState("10");
  const [basePricePerKg, setBasePricePerKg] = useState("2.40");
  const [tiers, setTiers] = useState<{ minKg: string; price: string }[]>([
    { minKg: "50", price: "2.00" },
  ]);
  const [variety, setVariety] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [grade, setGrade] = useState("A");
  const [packaging, setPackaging] = useState("10kg crate");
  const [isOrganic, setIsOrganic] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStockKg, setEditStockKg] = useState("");
  const [editMinOrderKg, setEditMinOrderKg] = useState("");
  const [editBasePrice, setEditBasePrice] = useState("");
  const [editTiers, setEditTiers] = useState<{ minKg: string; price: string }[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadMine = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await productsApi.listMine();
      setProducts(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load your listings.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    productsApi
      .listMine()
      .then((res) => {
        if (!active) return;
        setProducts(res.items);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : "Failed to load your listings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  if (!user || (user.role !== "Farmer" && user.role !== "Admin")) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#DCE6DF] bg-white p-6 text-center">
        <p className="font-semibold">Farmer Hub requires a Farmer or Admin account.</p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-xl bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const priceTiers = tiers
        .filter((t) => Number(t.minKg) > 0 && Number(t.price) > 0)
        .map((t) => ({ minQuantityKg: Number(t.minKg), pricePerKg: Number(t.price) }));

      await productsApi.create({
        category,
        title,
        description: description || undefined,
        availableStockKg: Number(availableStockKg),
        minOrderKg: Number(minOrderKg),
        basePricePerKg: Number(basePricePerKg),
        metadata: {
          variety: variety || null,
          harvestDate: harvestDate || null,
          grade: grade || null,
          packaging: packaging || null,
          isOrganic,
        },
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        priceTiers,
      });

      setTitle("");
      setDescription("");
      setImageUrls([]);
      await loadMine();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to publish listing.");
    } finally {
      setCreating(false);
    }
  }

  function startEditing(product: Product) {
    if (editingId === product.id) {
      setEditingId(null);
      return;
    }
    setEditingId(product.id);
    setEditTitle(product.title);
    setEditStockKg(String(product.availableStockKg));
    setEditMinOrderKg(String(product.minOrderKg));
    setEditBasePrice(String(product.basePricePerKg));
    setEditTiers(
      product.priceTiers.map((t) => ({
        minKg: String(t.minQuantityKg),
        price: String(t.pricePerKg),
      }))
    );
  }

  async function handleSaveEdit(product: Product) {
    setSavingEdit(true);
    setError(null);
    try {
      const priceTiers = editTiers
        .filter((t) => Number(t.minKg) > 0 && Number(t.price) > 0)
        .map((t) => ({ minQuantityKg: Number(t.minKg), pricePerKg: Number(t.price) }));

      await productsApi.update(product.id, {
        title: editTitle.trim() || product.title,
        availableStockKg: Number(editStockKg),
        minOrderKg: Number(editMinOrderKg),
        basePricePerKg: Number(editBasePrice),
        priceTiers,
        rowVersion: product.rowVersion,
      });
      setEditingId(null);
      await loadMine();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save listing updates.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleActive(product: Product) {
    try {
      await productsApi.update(product.id, {
        isActive: !product.isActive,
        rowVersion: product.rowVersion,
      });
      await loadMine();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update listing.");
    }
  }

  async function handleAddStock(product: Product, deltaKg: number) {
    try {
      await productsApi.update(product.id, {
        availableStockKg: Math.max(0, product.availableStockKg + deltaKg),
        rowVersion: product.rowVersion,
      });
      await loadMine();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update stock.");
    }
  }

  async function handleDelete(productId: string) {
    try {
      await productsApi.remove(productId);
      await loadMine();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete listing.");
    }
  }

  async function handlePhotoUpload(file: File | null) {
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const presign = await productsApi.createUploadUrl(file.name, file.type || "image/webp");
      const publicUrl = await uploadFileWithPresignedUrl(presign, file);
      setImageUrls((prev) => [...prev, publicUrl]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload produce photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div className="space-y-6">
      {!user.isVerified && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Your farmer account is pending admin approval. Once verified, you can publish produce listings to restaurants.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* New Produce Form */}
        <section className="rounded-2xl border border-[#DCE6DF] bg-white p-5 shadow-xs lg:col-span-5">
          <h1 className="text-xl font-bold text-[#1B4332]">Publish Harvest Listing</h1>
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Category</label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">Variety</label>
                <input
                  type="text"
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                  placeholder="Pink Zira"
                  className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">Listing Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Zira Pink Greenhouse Tomatoes"
                className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Stock (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={availableStockKg}
                  onChange={(e) => setAvailableStockKg(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-2.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">Min (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={minOrderKg}
                  onChange={(e) => setMinOrderKg(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-2.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">Base $/kg</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={basePricePerKg}
                  onChange={(e) => setBasePricePerKg(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-2.5 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-[#F7FAF8] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1B4332]">
                  Volume Price Tiers (optional)
                </span>
                <button
                  type="button"
                  onClick={() => setTiers((prev) => [...prev, { minKg: "", price: "" }])}
                  className="text-xs font-semibold text-[#2D6A4F] hover:underline"
                >
                  + Add Tier
                </button>
              </div>
              {tiers.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min kg (e.g. 50)"
                    value={tier.minKg}
                    onChange={(e) =>
                      setTiers((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, minKg: e.target.value } : row))
                      )
                    }
                    className="w-1/2 rounded-lg border border-[#D4DFD7] bg-white px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="$/kg (e.g. 2.00)"
                    value={tier.price}
                    onChange={(e) =>
                      setTiers((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, price: e.target.value } : row))
                      )
                    }
                    className="w-1/2 rounded-lg border border-[#D4DFD7] bg-white px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setTiers((prev) => prev.filter((_, i) => i !== idx))}
                    className="px-1.5 text-xs text-stone-400 hover:text-red-600"
                    title="Remove tier"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Grade (A)"
                className="rounded-xl border border-[#D4DFD7] px-2.5 py-2 text-xs"
              />
              <input
                type="text"
                value={packaging}
                onChange={(e) => setPackaging(e.target.value)}
                placeholder="10kg crate"
                className="rounded-xl border border-[#D4DFD7] px-2.5 py-2 text-xs"
              />
              <input
                type="date"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                title="Harvest Date"
                className="rounded-xl border border-[#D4DFD7] px-2 py-2 text-xs"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isOrganic}
                onChange={(e) => setIsOrganic(e.target.checked)}
                className="h-4 w-4 accent-[#1B4332]"
              />
              <span>Certified / Organic produce</span>
            </label>

            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Produce Photos (WebP / JPEG / PNG)
              </label>
              <input
                type="file"
                accept="image/webp,image/jpeg,image/png"
                disabled={uploadingPhoto || !user.isVerified}
                onChange={(e) => void handlePhotoUpload(e.target.files?.[0] ?? null)}
                className="mt-1 w-full rounded-xl border border-[#D4DFD7] px-3 py-1.5 text-xs"
              />
              {uploadingPhoto && (
                <p className="mt-1 text-xs text-stone-500">Uploading photo to R2...</p>
              )}
              {imageUrls.length > 0 && (
                <p className="mt-1 text-xs font-medium text-[#2D6A4F]">
                  Attached {imageUrls.length} photo(s)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={creating || !user.isVerified}
              className="w-full rounded-xl bg-[#1B4332] py-2.5 text-sm font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
            >
              {creating ? "Publishing..." : "Publish Listing"}
            </button>
          </form>
        </section>

        {/* Farmer Listings */}
        <section className="space-y-3 lg:col-span-7">
          <h2 className="text-xl font-bold text-[#1B4332]">Your Farm Inventory</h2>
          {loading ? (
            <div className="rounded-2xl border border-[#E2E8E4] bg-white p-6 text-sm text-stone-500">
              Loading your listings...
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#C7D3CC] bg-white p-8 text-center text-sm text-stone-500">
              You have no active produce listings yet.
            </div>
          ) : (
            products.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-[#E2E8E4] bg-white p-4 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {p.imageUrls && p.imageUrls.length > 0 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrls[0]}
                        alt={p.title}
                        className="h-14 w-14 rounded-xl border border-[#E2E8E4] object-cover"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-[#1F2933]">{p.title}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            p.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-stone-200 text-stone-600"
                          }`}
                        >
                          {p.isActive ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {p.category} • Stock: <strong>{p.availableStockKg} kg</strong> • Min:{" "}
                        {p.minOrderKg} kg • Base: ${p.basePricePerKg.toFixed(2)}/kg
                      </p>
                      {p.priceTiers.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-[#2D6A4F]">
                          Tiers:{" "}
                          {p.priceTiers
                            .map((t) => `${t.minQuantityKg}+ kg @ $${t.pricePerKg.toFixed(2)}`)
                            .join(" | ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAddStock(p, 25)}
                      className="rounded-lg border border-[#D4DFD7] px-2.5 py-1 text-xs font-semibold hover:bg-[#E9F5EE]"
                    >
                      +25 kg
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditing(p)}
                      className="rounded-lg border border-[#1B4332] px-2.5 py-1 text-xs font-semibold text-[#1B4332] hover:bg-[#E9F5EE]"
                    >
                      {editingId === p.id ? "Close Edit" : "Edit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(p)}
                      className="rounded-lg border border-[#D4DFD7] px-2.5 py-1 text-xs font-semibold hover:bg-stone-100"
                    >
                      {p.isActive ? "Pause" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id)}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingId === p.id && (
                  <div className="mt-4 space-y-3 rounded-xl border border-[#DCE6DF] bg-[#FAF9F6] p-3.5 text-xs">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <label className="sm:col-span-2">
                        <span className="font-semibold text-stone-700">Title</span>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#D4DFD7] bg-white px-2.5 py-1.5"
                        />
                      </label>
                      <label>
                        <span className="font-semibold text-stone-700">Stock (kg)</span>
                        <input
                          type="number"
                          step="0.5"
                          value={editStockKg}
                          onChange={(e) => setEditStockKg(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#D4DFD7] bg-white px-2.5 py-1.5"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label>
                          <span className="font-semibold text-stone-700">Min (kg)</span>
                          <input
                            type="number"
                            step="0.5"
                            value={editMinOrderKg}
                            onChange={(e) => setEditMinOrderKg(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#D4DFD7] bg-white px-2 py-1.5"
                          />
                        </label>
                        <label>
                          <span className="font-semibold text-stone-700">Base $/kg</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editBasePrice}
                            onChange={(e) => setEditBasePrice(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#D4DFD7] bg-white px-2 py-1.5"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#1B4332]">Volume Price Tiers</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditTiers((prev) => [...prev, { minKg: "", price: "" }])
                          }
                          className="font-semibold text-[#2D6A4F] hover:underline"
                        >
                          + Add Tier
                        </button>
                      </div>
                      {editTiers.map((tier, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Min kg"
                            value={tier.minKg}
                            onChange={(e) =>
                              setEditTiers((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, minKg: e.target.value } : r
                                )
                              )
                            }
                            className="w-1/2 rounded-lg border border-[#D4DFD7] bg-white px-2.5 py-1"
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="$/kg"
                            value={tier.price}
                            onChange={(e) =>
                              setEditTiers((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, price: e.target.value } : r
                                )
                              )
                            }
                            className="w-1/2 rounded-lg border border-[#D4DFD7] bg-white px-2.5 py-1"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEditTiers((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="px-1.5 text-stone-400 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-[#D4DFD7] bg-white px-3 py-1.5 font-medium text-stone-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => void handleSaveEdit(p)}
                        className="rounded-lg bg-[#1B4332] px-3.5 py-1.5 font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                      >
                        {savingEdit ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
