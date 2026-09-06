/**
 * تحويل الكمية لأصغر وحدة أساس (GRAM / ML / PIECE)
 */
export const toBaseQty = (value: number, unit: string): number => {
  const u = (unit || '').toUpperCase();
  if (u === 'KG' || u === 'LITER') return value * 1000;
  if (u === 'SPOON') return value * 5;
  return value;
};

type ConsumeLike = {
  inputQuantity?: number;
  inputUnit?: string;
  outputQuantity?: number;
  isPrimary?: boolean;
  consumptionPerUnitInBase?: number;
};

/** كم وحدة منتج يمكن إنتاجها من خامة واحدة */
export const availableFromIngredient = (
  consumeQty: number,
  consumeUnit: string,
  invQty: number,
  invUnit: string,
  outputQty = 1
): number => {
  const consumeBase = toBaseQty(consumeQty, consumeUnit) / (outputQty > 0 ? outputQty : 1);
  const invBase = toBaseQty(invQty, invUnit);
  return consumeBase > 0 ? Math.floor(invBase / consumeBase) : 0;
};

/**
 * إصلاح نسبة الاستهلاك المفسدة (خطأ ×1000):
 * - 2 أو 10 أو 20 كجم للكوب الواحد مستحيل في المشروبات (المقصود جرامات أو معالق)
 * - 20 كجم محفوظة كـ KG بدل 20 جرام
 */
export const repairConsumeQty = (
  qty: number,
  unit: string,
  invQty: number,
  invUnit: string,
  outputQty = 1
): { qty: number; unit: string; repaired: boolean } => {
  if (qty <= 0 || invQty <= 0) return { qty, unit, repaired: false };

  const u = (unit || 'KG').toUpperCase();
  const out = outputQty > 0 ? outputQty : 1;

  // 1) كشف خطأ الكيلوجرام/اللتر الصريح: مستحيل كوباية قهوة أو شاي تستهلك >= 0.25 كجم أو لتر
  if ((u === 'KG' || u === 'LITER') && out <= 1 && qty >= 0.25) {
    const subUnit = u === 'KG' ? 'GRAM' : 'ML';
    return { qty, unit: subUnit, repaired: true };
  }

  if (availableFromIngredient(qty, unit, invQty, invUnit, out) > 0) {
    return { qty, unit, repaired: false };
  }

  if (u === 'KG' || u === 'LITER') {
    const divided = qty / 1000;
    if (divided >= 0.000001 && availableFromIngredient(divided, unit, invQty, invUnit, out) > 0) {
      return { qty: divided, unit, repaired: true };
    }

    const subUnit = u === 'KG' ? 'GRAM' : 'ML';
    if (availableFromIngredient(qty, subUnit, invQty, invUnit, out) > 0) {
      return { qty, unit: subUnit, repaired: true };
    }
  }

  return { qty, unit, repaired: false };
};

/**
 * استخراج كمية الاستهلاك للعرض/الحفظ مع محاولة إصلاح القيم المفسدة.
 */
export const normalizeRecipeConsumeQty = (
  ing: ConsumeLike,
  invQty?: number,
  invUnit?: string
): number => {
  const consumeUnit = ing.inputUnit || 'KG';
  const out = Number(ing.outputQuantity) > 0 ? Number(ing.outputQuantity) : 1;
  let qty = Number(ing.inputQuantity) || 0;

  if (qty > 0 && invQty !== undefined && invUnit) {
    const repaired = repairConsumeQty(qty, consumeUnit, invQty, invUnit, out);
    return repaired.qty;
  }

  return qty;
};
