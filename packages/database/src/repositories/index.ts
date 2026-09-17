import { prisma } from '../client';
import { AddressRepository } from './address.repository';
import { CartRepository } from './cart.repository';
import { BrandRepository } from './brand.repository';
import { CategoryRepository } from './category.repository';
import { InventoryRepository } from './inventory.repository';
import { OrderRepository } from './order.repository';
import { PaymentRepository } from './payment.repository';
import { ProductRepository } from './product.repository';
import { UserRepository } from './user.repository';
import { ReviewRepository } from './review.repository';
import { AuditLogRepository } from './audit-log.repository';
import { AnalyticsRepository } from './analytics.repository';
import { SiteSettingRepository } from './site-setting.repository';
import { MediaLibraryRepository } from './media.repository';
import { CouponRepository } from './coupon.repository';
import { FlashSaleRepository } from './flash-sale.repository';
import { ShipmentRepository } from './shipment.repository';
import { BackInStockRepository } from './back-in-stock.repository';
import { WishlistRepository } from './wishlist.repository';

/**
 * Factory that wires all repositories to a shared Prisma client.
 * Use this in services and API handlers for consistent data access.
 */
export function createRepositories(db = prisma) {
  return {
    user: new UserRepository(db),
    brand: new BrandRepository(db),
    category: new CategoryRepository(db),
    product: new ProductRepository(db),
    inventory: new InventoryRepository(db),
    cart: new CartRepository(db),
    address: new AddressRepository(db),
    order: new OrderRepository(db),
    payment: new PaymentRepository(db),
    review: new ReviewRepository(db),
    auditLog: new AuditLogRepository(db),
    analytics: new AnalyticsRepository(db),
    siteSetting: new SiteSettingRepository(db),
    media: new MediaLibraryRepository(db),
    coupon: new CouponRepository(db),
    flashSale: new FlashSaleRepository(db),
    shipment: new ShipmentRepository(db),
    backInStock: new BackInStockRepository(db),
    wishlist: new WishlistRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export { BaseRepository } from './base.repository';
export { UserRepository, type UserWithRoles, type AdminUserListItem } from './user.repository';
export { ReviewRepository } from './review.repository';
export { WishlistRepository, type WishlistEntry } from './wishlist.repository';
export { BrandRepository, type AdminBrandListItem } from './brand.repository';
export { CategoryRepository, type CategoryWithChildren, type AdminCategoryListItem } from './category.repository';
export {
  ProductRepository,
  type ProductDetail,
  type ProductListItem,
  type ProductListFilters,
  type PaginatedProducts,
} from './product.repository';
export {
  InventoryRepository,
  type StockCheckResult,
  type LowStockInventory,
} from './inventory.repository';
export { CartRepository, type CartWithItems } from './cart.repository';
export { AddressRepository } from './address.repository';
export { OrderRepository, type OrderDetail } from './order.repository';
export { PaymentRepository } from './payment.repository';
export { AuditLogRepository } from './audit-log.repository';
export { AnalyticsRepository } from './analytics.repository';
export { SiteSettingRepository } from './site-setting.repository';
export { MediaLibraryRepository } from './media.repository';
