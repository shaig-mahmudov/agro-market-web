export type UserRole = "Farmer" | "Restaurant" | "Driver" | "Admin";

export interface UserSummary {
  id: string;
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  isVerified: boolean;
  telegramChatId: number | null;
}

export interface BusinessProfile {
  businessName: string;
  region: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  preferredDeliveryWindow: string | null;
  taxId: string | null;
}

export interface ProfileResponse extends UserSummary {
  businessProfile: BusinessProfile | null;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  isNewUser?: boolean;
  user: UserSummary;
}

export interface SendOtpResponse {
  phoneNumber: string;
  expiresAt: string;
  devOtpCode: string | null;
}

export interface TelegramDeepLinkResponse {
  token: string;
  deepLinkUrl: string;
  expiresAt: string;
}

export interface AdminUserItem {
  id: string;
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  isVerified: boolean;
  telegramChatId: number | null;
  createdAt: string;
  businessName: string | null;
  region: string | null;
}

export interface PriceTier {
  id?: string;
  minQuantityKg: number;
  pricePerKg: number;
}

export interface ProductMetadata {
  variety: string | null;
  harvestDate: string | null;
  grade: string | null;
  packaging: string | null;
  isOrganic: boolean;
}

export interface FarmerSummary {
  id: string;
  fullName: string;
  businessName: string | null;
  region: string | null;
}

export interface Product {
  id: string;
  farmerId: string;
  category: string;
  title: string;
  description: string | null;
  availableStockKg: number;
  minOrderKg: number;
  basePricePerKg: number;
  metadata: ProductMetadata;
  imageUrls: string[];
  isActive: boolean;
  updatedAt: string;
  rowVersion: number;
  priceTiers: PriceTier[];
  farmer: FarmerSummary | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface MediaUploadResult {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  url: string;
}

export type FulfillmentType = "PlatformCourier" | "FarmerDelivery" | "BuyerPickup";
export type PaymentMethod = "CashOnDelivery" | "BankTransfer" | "WeeklyInvoice";
export type PaymentStatus = "Unpaid" | "Paid" | "Disputed";
export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "PickedUp"
  | "InTransit"
  | "DeliveredPendingApproval"
  | "Delivered"
  | "Disputed"
  | "Cancelled";

export interface OrderItem {
  id: string;
  productId: string;
  productTitleSnapshot: string;
  unitPriceApplied: number;
  estimatedWeightKg: number;
  actualDeliveredWeightKg: number | null;
  rejectedWeightKg: number | null;
  proofPhotoUrl: string | null;
}

export interface Order {
  id: string;
  checkoutGroupId: string;
  restaurantId: string;
  farmerId: string;
  farmerName: string | null;
  farmerTaxId: string | null;
  restaurantName: string | null;
  restaurantTaxId: string | null;
  deliveryRunId: string | null;
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
  estimatedTotalAmount: number;
  platformFeeAmount: number;
  deliveryFeeAmount: number;
  finalTotalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  disputeNote: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

export interface CheckoutGroup {
  id: string;
  restaurantId: string;
  restaurantName: string | null;
  restaurantTaxId: string | null;
  deliveryAddress: string;
  scheduledDeliveryDate: string;
  cutoffAt: string;
  totalDeliveryFee: number;
  createdAt: string;
  orders: Order[];
}

export type DeliveryRunStatus = "Planned" | "PickingUp" | "InTransit" | "Completed";

export interface DeliveryRunOrderSummary {
  id: string;
  checkoutGroupId: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  farmerName: string | null;
  farmerAddress: string | null;
  restaurantName: string | null;
  deliveryAddress: string | null;
  estimatedTotalAmount: number;
  finalTotalAmount: number;
  totalEstimatedWeightKg: number;
  items: OrderItem[];
}

export interface DeliveryRun {
  id: string;
  driverName: string;
  driverPhone: string;
  vehicleNote: string | null;
  runDate: string;
  status: DeliveryRunStatus;
  createdAt: string;
  orders: DeliveryRunOrderSummary[];
}

