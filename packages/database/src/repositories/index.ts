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
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export { BaseRepository } from './base.repository';
export { UserRepository, type UserWithRoles } from './user.repository';
export { BrandRepository } from './brand.repository';
export { CategoryRepository, type CategoryWithChildren } from './category.repository';
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
