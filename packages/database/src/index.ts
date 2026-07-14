export { prisma, type PrismaClient } from './client';
export {
  createRepositories,
  type Repositories,
  BaseRepository,
  UserRepository,
  BrandRepository,
  CategoryRepository,
  ProductRepository,
  InventoryRepository,
  CartRepository,
  AddressRepository,
  OrderRepository,
  PaymentRepository,
  type UserWithRoles,
  type CategoryWithChildren,
  type ProductDetail,
  type ProductListItem,
  type ProductListFilters,
  type PaginatedProducts,
  type StockCheckResult,
  type LowStockInventory,
  type CartWithItems,
  type OrderDetail,
} from './repositories';

// Re-export Prisma types for consumers
export type {
  User,
  Brand,
  Category,
  Product,
  ProductVariant,
  Order,
  OrderStatus,
  Address,
  PaymentProvider,
  PaymentStatus,
  RoleName,
} from '@prisma/client';

export { Prisma } from '@prisma/client';
