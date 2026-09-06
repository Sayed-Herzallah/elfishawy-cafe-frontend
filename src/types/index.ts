export type UserRole = 'admin' | 'cashier';

export interface User {
  _id: string;
  userName: string;
  email: string;
  phone: string;
  address?: string;
  roleType: UserRole;
  verify: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductImage {
  secure_url: string;
  public_id: string;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  image?: ProductImage;
  category: string | Category;
  inStock: boolean;
  stockQuantity: number;
  availableQuantityByRecipe?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export type Unit = 'KG' | 'GRAM' | 'LITER' | 'ML' | 'PIECE' | 'SPOON';

export interface RecipeIngredient {
  inventoryItem: string | InventoryItem;
  inputQuantity: number;
  inputUnit: Unit;
  outputQuantity: number;
  isPrimary?: boolean;
  consumptionPerUnitInBase?: number;
  availableFromThisIngredient?: number;
}

export interface Recipe {
  _id: string;
  product: string | Product;
  ingredients: RecipeIngredient[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  _id: string;
  name: string;
  quantity: number;
  unit: string;
  minLimit: number;
  costPrice?: number;
  lastRestocked?: string;
  lastRestockedBy?: string | { _id: string; userName: string; email: string };
  createdAt?: string;
  updatedAt?: string;
}

export type OrderStatus = 'pending' | 'completed' | 'cancelled';

export interface OrderItem {
  product: string | Product;
  quantity: number;
  price: number; // snapshotted at order creation
}

export interface Order {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  tableNumber?: number;
  notes?: string;
  cashierId: string | { _id: string; userName: string; email: string };
  createdAt: string;
  updatedAt?: string;
}

export type ExpenseCategory = 'rent' | 'salaries' | 'utilities' | 'inventory' | 'other';

export interface Expense {
  _id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  inventoryItemLinked?: string | InventoryItem;
  inventoryQuantityAdded?: number;
  /** سعر وحدة الشراء اللي دخلها الكاشير (لو الـ API بيرجعها) */
  unitCost?: number;
  /** اسم المورد (لو الـ API بيرجعه منفصل) */
  supplierName?: string;
  /** رقم الفاتورة الورقية (لو الـ API بيرجعه منفصل) */
  invoiceNumber?: string;
  date: string;
  addedBy: string | { _id: string; userName: string; email: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface KPIStats {
  totalSales: number;
  totalOrdersCount: number;
  totalExpenses: number;
  netProfit: number;
  lowStockCount: number;
}

export interface SalesTrendItem {
  _id: string; // YYYY-MM-DD
  totalSales: number;
  ordersCount: number;
}

export interface ExpenseBreakdownItem {
  _id: ExpenseCategory;
  totalAmount: number;
  count: number;
}

export interface TopProductItem {
  _id: string;
  name: string;
  price: number;
  quantitySold: number;
  revenueGenerated: number;
}

export interface ChartsData {
  salesTrend: SalesTrendItem[];
  expenseBreakdown: ExpenseBreakdownItem[];
  topProducts: TopProductItem[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  tokens?: AuthTokens;
  accessToken?: string;
  details?: string[];
}
