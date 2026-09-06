import { productService, recipeService } from '../services/catalogService';
import { inventoryService } from '../services/opsService';
import { isStockOut } from './stockStatus';
import { repairConsumeQty, toBaseQty } from './recipeUnits';

// Helper to convert units to base unit
export const toBase = (qty: number, unit: string): number => toBaseQty(qty, unit);

/**
 * ⚠️ تمت إزالة "الربط بالأسماء" نهائيًا — كان بيربط المنتج بأي خام اسمه قريب
 * (مثل: منتج "شاي" مع خام زبالة اسمه "00000شاي") وبيملّي أرصدة وهمية.
 * المزامنة دلولتً تعتمد على الوصفات فقط — لو الوصفة مكسورة (منتجها اتمسح)
 * يتم تخطيها بأمان بدون أي تحديث خاطئ.
 */

/**
 * Recalculate and update stockQuantity on the server for a specific product.
 * Sends the full product details (name, price, category) to pass backend validations.
 */
async function updateProductStockOnServer(product: any, newQty: number): Promise<boolean> {
  try {
    const fd = new FormData();
    fd.append('name', product.name);
    fd.append('price', String(product.price));

    const catId = typeof product.category === 'string'
      ? product.category
      : (product.category?._id || '');
    fd.append('category', catId);

    fd.append('stockQuantity', String(newQty));
    fd.append('inStock', String(newQty > 0));

    if (product.description) {
      fd.append('description', product.description);
    }

    const res = await productService.updateProduct(product._id, fd);
    return res.success;
  } catch (e) {
    console.error(`Failed to update product stock for ${product.name} (${product._id}):`, e);
    return false;
  }
}

/** استخراج معرف المنتج من الوصفة سواء كان ID أو object معبأ — أو null لو مكسورة */
const recipeProductId = (recipe: any): string | null => {
  const p = recipe?.product;
  if (!p) return null;
  if (typeof p === 'string') return p;
  return p._id || null;
};

/** حساب المتاح من وصفة واحدة بناءً على أرصدة مكوناتها (الخامات الأساسية فقط) */
const calcRecipeAvailability = (recipe: any, allInventory: any[]): number | null => {
  if (!recipe?.ingredients?.length) return null;

  // الخامات الأساسية فقط هي التي تحدد عدد الأكواب المتاحة (مثل البن للقهوة أو الشاي للشاي).
  // الخامات المساعدة (مثل السكر) تُخصم عند البيع ولا تقيّد رصيد الأكواب.
  const primaryIngredients = recipe.ingredients.filter((ing: any) => ing.isPrimary !== false);
  const targetIngredients = primaryIngredients.length > 0 ? primaryIngredients : recipe.ingredients;

  let minAvailable = Infinity;
  for (const ing of targetIngredients) {
    const ingId = typeof ing.inventoryItem === 'string' ? ing.inventoryItem : ing.inventoryItem?._id;
    const invItem = allInventory.find((i: any) => String(i._id) === String(ingId));
    if (!invItem || isStockOut(invItem.quantity)) return 0;

    const out = Number(ing.outputQuantity) > 0 ? Number(ing.outputQuantity) : 1;
    const repaired = repairConsumeQty(
      Number(ing.inputQuantity) || 0,
      ing.inputUnit || 'GRAM',
      Number(invItem.quantity) || 0,
      invItem.unit || 'KG',
      out
    );

    const inputQtyBase = toBase(repaired.qty, repaired.unit);
    const consumePerUnit = inputQtyBase / out;
    const invBase = toBase(invItem.quantity, invItem.unit);
    const available = consumePerUnit > 0 ? Math.floor(invBase / consumePerUnit) : Infinity;
    minAvailable = Math.min(minAvailable, available);
  }

  return Number.isFinite(minAvailable) ? minAvailable : 0;
};

/**
 * After restocking an inventory item, recalculate and update stockQuantity
 * for all products that use this item via recipes (bill of materials).
 * الوصفات المكسورة (منتجها اتمسح) يتم تجاهلها بأمان.
 */
export async function syncProductStockAfterRestock(inventoryItemId: string): Promise<number> {
  try {
    const [recipesRes, productsRes, invRes] = await Promise.all([
      recipeService.listRecipes(),
      productService.listProducts(),
      inventoryService.listInventory(),
    ]);

    if (!recipesRes.success || !recipesRes.data) return 0;
    if (!productsRes.success || !productsRes.data) return 0;
    if (!invRes.success || !invRes.data) return 0;

    const allRecipes = recipesRes.data;
    const allProducts = productsRes.data;
    const allInventory = invRes.data;

    // الوصفات المتأثرة بالخام المتورّد — مع تجاهل الوصفات المكسورة (product: null)
    const affectedRecipes = allRecipes.filter((recipe: any) => {
      if (!recipeProductId(recipe)) return false;
      return recipe.ingredients?.some((ing: any) => {
        const ingId = typeof ing.inventoryItem === 'string' ? ing.inventoryItem : ing.inventoryItem?._id;
        return String(ingId) === String(inventoryItemId);
      });
    });

    let updatedCount = 0;

    for (const recipe of affectedRecipes) {
      const productId = recipeProductId(recipe);
      const product = allProducts.find((p: any) => p._id === productId);
      if (!product) continue;

      const newQty = calcRecipeAvailability(recipe, allInventory);
      if (newQty === null) continue;

      const shouldUpdate =
        product.stockQuantity !== newQty ||
        Boolean(product.inStock) !== (newQty > 0);

      if (shouldUpdate) {
        const success = await updateProductStockOnServer(product, newQty);
        if (success) updatedCount++;
      }
    }

    return updatedCount;
  } catch (err) {
    console.error('syncProductStockAfterRestock error:', err);
    return 0;
  }
}

/**
 * ✅ إتمام عملية شراء/توريد مضمونة — تُستخدم من كل شاشات المشتريات:
 * 1) بتتحقق إن رصيد الخام زاد فعلاً بعد تسجيل قيد الشراء —
 *    لو الـ Backend مازودش الرصيد تلقائياً من القيد، بتعمل restock صريح كخطة بديلة.
 * 2) بتزامن أرصدة المنتجات المرتبطة بالخام عبر الوصفات فوراً —
 *    فالمنتجات النافدة بتفتح مباشرة في الكاشير والمنيو.
 */
export async function ensurePurchaseRestockAndSync(params: {
  itemId: string;
  /** رصيد الخام قبل التسجيل — null لو مش معروف */
  qtyBefore: number | null;
  /** الكمية المشتراة */
  addQty: number;
  /** سعر تكلفة الوحدة للفاتورة */
  unitCost?: number;
}): Promise<{ restocked: boolean; updatedProducts: number; newQty: number | null }> {
  const { itemId, qtyBefore, addQty, unitCost } = params;
  let restocked = false;
  let newQty: number | null = null;

  try {
    const freshRes = await inventoryService.listInventory();
    const fresh =
      freshRes.success && freshRes.data
        ? freshRes.data.find((i: any) => i._id === itemId)
        : undefined;
    newQty = fresh ? Number(fresh.quantity) : null;

    if (newQty !== null && qtyBefore !== null && newQty <= qtyBefore) {
      // ⚠️ الـ Backend مازودش الرصيد من قيد الشراء → restock صريح كخطة بديلة
      const res = await inventoryService.restockItem(itemId, addQty, unitCost);
      if (res.success) {
        restocked = true;
        newQty = Number(res.data?.quantity ?? newQty + addQty);
      }
    } else if (newQty !== null && qtyBefore !== null && newQty > qtyBefore) {
      // ✅ الـ Backend زوّد الرصيد تلقائياً من القيد
      restocked = true;
    }
  } catch {
    // فشل التحقق — نكمل بالمزامنة على أي حال
  }

  const updatedProducts = await syncProductStockAfterRestock(itemId);
  return { restocked, updatedProducts, newQty };
}

/**
 * Synchronize all products' stock levels with the current inventory — via recipes ONLY.
 * المنتجات بدون وصفة صالحة لا يتم لمسها إطلاقًا (رصيدها يدوي للأدمن).
 */
export async function syncAllProductsStock(): Promise<number> {
  try {
    const [recipesRes, productsRes, invRes] = await Promise.all([
      recipeService.listRecipes(),
      productService.listProducts(),
      inventoryService.listInventory(),
    ]);

    if (!recipesRes.success || !recipesRes.data) return 0;
    if (!productsRes.success || !productsRes.data) return 0;
    if (!invRes.success || !invRes.data) return 0;

    const allRecipes = recipesRes.data;
    const allProducts = productsRes.data;
    const allInventory = invRes.data;

    let updatedCount = 0;

    for (const product of allProducts) {
      const recipe = allRecipes.find((r: any) => recipeProductId(r) === product._id);
      if (!recipe) continue; // بدون وصفة صالحة → الرصيد يدوي، ممنوع نلمسه

      const finalQty = calcRecipeAvailability(recipe, allInventory);
      if (finalQty === null) continue;

      const shouldUpdate =
        product.stockQuantity !== finalQty ||
        Boolean(product.inStock) !== (finalQty > 0);

      if (shouldUpdate) {
        const success = await updateProductStockOnServer(product, finalQty);
        if (success) updatedCount++;
      }
    }

    return updatedCount;
  } catch (err) {
    console.error('syncAllProductsStock error:', err);
    return 0;
  }
}
