import type {
  AdminUserItem,
  AuthResponse,
  CheckoutGroup,
  DeliveryRun,
  DeliveryRunStatus,
  FulfillmentType,
  Order,
  OrderStatus,
  PagedResult,
  PaymentMethod,
  PaymentStatus,
  PresignedUploadResult,
  Product,
  ProductMetadata,
  ProfileResponse,
  SendOtpResponse,
  TelegramDeepLinkResponse,
  UserRole,
  UserSummary,
} from "./types";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:5095"
).replace(/\/+$/, "");

const ACCESS_TOKEN_KEY = "agromarket_access_token";
const REFRESH_TOKEN_KEY = "agromarket_refresh_token";

export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;

  constructor(message: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function getStoredTokens() {
  if (typeof window === "undefined") return { accessToken: null, refreshToken: null };
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

export function setStoredTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearStoredTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    const message =
      body.detail || body.title || `Request failed with status ${res.status}`;
    return new ApiError(message, res.status, body.errors);
  } catch {
    return new ApiError(`Request failed with status ${res.status}`, res.status);
  }
}

export async function tryRefreshTokens(): Promise<string | null> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearStoredTokens();
    return null;
  }

  const data = (await res.json()) as AuthResponse;
  setStoredTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = false, headers, ...rest } = options;
  const { accessToken } = getStoredTokens();

  const buildHeaders = (token: string | null) => ({
    ...(rest.body ? { "Content-Type": "application/json" } : {}),
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  });

  let res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: buildHeaders(accessToken),
  });

  if (res.status === 401 && auth) {
    const refreshed = await tryRefreshTokens();
    if (refreshed) {
      res = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers: buildHeaders(refreshed),
      });
    }
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export async function uploadFileWithPresignedUrl(
  presign: PresignedUploadResult,
  file: File
): Promise<string> {
  if (!presign.isLocalStub) {
    const putRes = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) {
      throw new ApiError(`Photo upload failed with status ${putRes.status}`, putRes.status);
    }
  }
  return presign.publicUrl;
}

export const authApi = {
  sendOtp: (phoneNumber: string) =>
    apiFetch<SendOtpResponse>("/api/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phoneNumber }),
    }),

  verifyOtp: (payload: {
    phoneNumber: string;
    code: string;
    fullName?: string;
    role?: "Farmer" | "Restaurant";
  }) =>
    apiFetch<AuthResponse>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => apiFetch<UserSummary>("/api/auth/me", { auth: true }),

  telegramDeepLink: () =>
    apiFetch<TelegramDeepLinkResponse>("/api/auth/telegram-deep-link", {
      auth: true,
    }),

  logout: async () => {
    const { refreshToken } = getStoredTokens();
    if (refreshToken) {
      await apiFetch<void>("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined);
    }
    clearStoredTokens();
  },
};

export const profileApi = {
  getMine: () => apiFetch<ProfileResponse>("/api/profiles/me", { auth: true }),

  upsertMine: (payload: {
    fullName?: string;
    businessName: string;
    region: string;
    address: string;
    preferredDeliveryWindow?: string;
    taxId?: string;
  }) =>
    apiFetch<ProfileResponse>("/api/profiles/me", {
      method: "PUT",
      auth: true,
      body: JSON.stringify(payload),
    }),
};

export const adminApi = {
  listUsers: (params?: {
    role?: UserRole | "";
    isVerified?: boolean | "";
    search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set("role", params.role);
    if (params?.isVerified !== "" && params?.isVerified !== undefined) {
      qs.set("isVerified", String(params.isVerified));
    }
    if (params?.search) qs.set("search", params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<PagedResult<AdminUserItem>>(`/api/admin/users${suffix}`, {
      auth: true,
    });
  },

  verifyUser: (id: string, isVerified: boolean, role?: UserRole) =>
    apiFetch<AdminUserItem>(`/api/admin/users/${id}/verify`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ isVerified, ...(role ? { role } : {}) }),
    }),

  markOrderPaid: (id: string, paymentStatus: PaymentStatus, paymentMethod?: PaymentMethod) =>
    apiFetch<Order>(`/api/admin/orders/${id}/payment`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ paymentStatus, ...(paymentMethod ? { paymentMethod } : {}) }),
    }),
};

export const productsApi = {
  listCatalog: (params?: {
    category?: string;
    region?: string;
    search?: string;
    isOrganic?: boolean;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.region) qs.set("region", params.region);
    if (params?.search) qs.set("search", params.search);
    if (params?.isOrganic) qs.set("isOrganic", "true");
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<PagedResult<Product>>(`/api/products${suffix}`);
  },

  listMine: () =>
    apiFetch<PagedResult<Product>>("/api/products/mine", { auth: true }),

  createUploadUrl: (fileName: string, contentType: string) =>
    apiFetch<PresignedUploadResult>("/api/products/upload-url", {
      method: "POST",
      auth: true,
      body: JSON.stringify({ fileName, contentType }),
    }),

  create: (payload: {
    category: string;
    title: string;
    description?: string;
    availableStockKg: number;
    minOrderKg: number;
    basePricePerKg: number;
    metadata?: Partial<ProductMetadata>;
    imageUrls?: string[];
    priceTiers?: { minQuantityKg: number; pricePerKg: number }[];
  }) =>
    apiFetch<Product>("/api/products", {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
    }),

  update: (
    id: string,
    payload: {
      category?: string;
      title?: string;
      description?: string;
      availableStockKg?: number;
      minOrderKg?: number;
      basePricePerKg?: number;
      priceTiers?: { minQuantityKg: number; pricePerKg: number }[];
      isActive?: boolean;
      rowVersion?: number;
    }
  ) =>
    apiFetch<Product>(`/api/products/${id}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify(payload),
    }),

  remove: (id: string) =>
    apiFetch<void>(`/api/products/${id}`, {
      method: "DELETE",
      auth: true,
    }),
};

export const ordersApi = {
  checkout: (payload: {
    items: { productId: string; weightKg: number }[];
    deliveryAddress?: string;
    scheduledDeliveryDate?: string;
    paymentMethod?: PaymentMethod;
    fulfillmentType?: FulfillmentType;
  }) =>
    apiFetch<CheckoutGroup>("/api/orders/checkout", {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
    }),

  repeatOrder: (checkoutGroupId: string) =>
    apiFetch<CheckoutGroup>(`/api/orders/${checkoutGroupId}/repeat`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({}),
    }),

  listCheckoutGroups: () =>
    apiFetch<PagedResult<CheckoutGroup>>("/api/orders/checkout-groups", {
      auth: true,
    }),

  listOrders: (params?: { status?: OrderStatus; unassignedOnly?: boolean; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.unassignedOnly) qs.set("unassignedOnly", "true");
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<PagedResult<Order>>(`/api/orders${suffix}`, { auth: true });
  },

  respond: (id: string, accept: boolean) =>
    apiFetch<Order>(`/api/orders/${id}/respond`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ accept }),
    }),

  createProofUploadUrl: (id: string, fileName: string, contentType: string) =>
    apiFetch<PresignedUploadResult>(`/api/orders/${id}/proof-upload-url`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ fileName, contentType }),
    }),

  reconcile: (
    id: string,
    items: {
      orderItemId: string;
      actualDeliveredWeightKg: number;
      rejectedWeightKg: number;
      proofPhotoUrl?: string;
    }[]
  ) =>
    apiFetch<Order>(`/api/orders/${id}/reconcile`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ items }),
    }),

  confirmReceipt: (id: string, approve: boolean, disputeNote?: string) =>
    apiFetch<Order>(`/api/orders/${id}/confirm`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ approve, ...(disputeNote ? { disputeNote } : {}) }),
    }),
};

export const logisticsApi = {
  listRuns: (params?: { status?: DeliveryRunStatus; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<PagedResult<DeliveryRun>>(`/api/logistics/runs${suffix}`, {
      auth: true,
    });
  },

  getRun: (id: string) =>
    apiFetch<DeliveryRun>(`/api/logistics/runs/${id}`, { auth: true }),

  createRun: (payload: {
    driverName: string;
    driverPhone: string;
    vehicleNote?: string;
    runDate?: string;
    orderIds: string[];
  }) =>
    apiFetch<DeliveryRun>("/api/logistics/runs", {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
    }),

  updateRunStatus: (id: string, status: DeliveryRunStatus) =>
    apiFetch<DeliveryRun>(`/api/logistics/runs/${id}/status`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ status }),
    }),
};
