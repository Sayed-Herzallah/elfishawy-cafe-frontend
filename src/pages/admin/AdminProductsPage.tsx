import React, { useState, useEffect } from 'react';
import { productService, categoryService, recipeService } from '../../services/catalogService';
import { inventoryService } from '../../services/opsService';
import { Product, Category, InventoryItem } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { formatPrice, formatNumber } from '../../utils/formatters';
import { productStockState } from '../../utils/stockStatus';
import { normalizeRecipeConsumeQty, toBaseQty, repairConsumeQty } from '../../utils/recipeUnits';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DateRangeFilter, toLocalDateString } from '../../components/ui/DateRangeFilter';
import { DashboardFilterBar } from '../../components/ui/DashboardFilterBar';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Coffee,
  Filter,
  FolderPlus,
  Eye,
  X,
  Calculator,
  Trash2 as TrashIcon,
  FlaskConical,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

/** تحويل الكمية لأصغر وحدة أساس (GRAM / ML / PIECE) لحساب دقيق */
const getQtyInBase = (value: number, unit: string): number => toBaseQty(value, unit);

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [recipeDepletedMap, setRecipeDepletedMap] = useState<Record<string, string[]>>({});
  const [primaryDepletedMap, setPrimaryDepletedMap] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [categoryErrors, setCategoryErrors] = useState<{ name?: string; description?: string }>({});
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isCategoryFormSubmitted, setIsCategoryFormSubmitted] = useState(false);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    stockQuantity: '',
    imageFile: null as File | null,
  });
  const [formErrors, setFormErrors] = useState<{ name?: string; description?: string; price?: string; category?: string; stockQuantity?: string; imageFile?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);

  // Recipe / Raw-material linking for auto stock calc
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [recipeRows, setRecipeRows] = useState<{
    inventoryItem: string;
    consumeQty: string;
    consumeUnit: string;
    isPrimary: boolean;
  }[]>([]);
  const [computedAvailable, setComputedAvailable] = useState<number | null>(null);
  const [recipeErrors, setRecipeErrors] = useState<{ row?: string }>({});
  const [recipeData, setRecipeData] = useState<{ availableProductQty: number; ingredientDetails: any[]; depletedSecondary?: { name: string; unit: string; currentStock: number }[] } | null>(null);

  const { showToast, showError } = useNotification();

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [prodRes, catRes, invRes, recRes] = await Promise.all([
        productService.listProducts(),
        categoryService.listCategories(),
        inventoryService.listInventory(),
        recipeService.listRecipes().catch(() => null),
      ]);

      if (prodRes.success && prodRes.data) setProducts(prodRes.data);
      if (catRes.success && catRes.data) setCategories(catRes.data);
      if (invRes.success && invRes.data) setInventoryItems(invRes.data);

      if (recRes && recRes.success && recRes.data) {
        const secMap: Record<string, string[]> = {};
        const priMap: Record<string, string[]> = {};
        recRes.data.forEach((r: any) => {
          const pId = typeof r.product === 'string' ? r.product : r.product?._id;
          if (!pId || !r.ingredients) return;
          const depletedSec: string[] = [];
          const depletedPri: string[] = [];
          r.ingredients.forEach((ing: any) => {
            const inv = ing.inventoryItem;
            const qty = Number(inv?.quantity) || 0;
            if (qty <= 0) {
              if (ing.isPrimary === false) {
                depletedSec.push(inv?.name || 'خامة ثانوية');
              } else {
                depletedPri.push(inv?.name || 'خامة أساسية');
              }
            }
          });
          if (depletedSec.length > 0) secMap[pId] = depletedSec;
          if (depletedPri.length > 0) priMap[pId] = depletedPri;
        });
        setRecipeDepletedMap(secMap);
        setPrimaryDepletedMap(priMap);
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Compute how many product units we can make from the linked raw inventory
  // ⚠️ القاعدة: الحساب يعتمد على الخامات الأساسية فقط (البن للقهوة، الشاي للشاي).
  // الخامات المساعدة (مثل السكر) تخصم عند البيع لكن لا تخنق رصيد الأكواب المتاحة.
  const computeAvailability = (rows: {
    inventoryItem: string;
    consumeQty: string;
    consumeUnit: string;
    isPrimary: boolean;
  }[]): number | null => {
    if (!rows || rows.length === 0) return null;

    const primaryRows = rows.filter((r) => r.isPrimary);
    const targetRows = primaryRows.length > 0 ? primaryRows : rows;

    let minAvailable = Infinity;

    for (const row of targetRows) {
      const inv = inventoryItems.find((i) => i._id === row.inventoryItem);
      const qty = Number(row.consumeQty);
      if (!row.inventoryItem || !qty || qty <= 0) continue;

      const invBase = inv ? getQtyInBase(inv.quantity, inv.unit) : 0;
      const repaired = inv
        ? repairConsumeQty(qty, row.consumeUnit || 'GRAM', inv.quantity, inv.unit, 1)
        : { qty, unit: row.consumeUnit || 'GRAM' };
      const consumeBase = getQtyInBase(repaired.qty, repaired.unit);
      if (consumeBase <= 0) continue;

      minAvailable = Math.min(minAvailable, Math.floor(invBase / consumeBase));
    }

    return Number.isFinite(minAvailable) ? minAvailable : null;
  };

  const updateComputedAvailable = (rows: {
    inventoryItem: string;
    consumeQty: string;
    consumeUnit: string;
    isPrimary: boolean;
  }[]) => {
    setComputedAvailable(computeAvailability(rows));
  };

  const handleRecipeRowChange = (
    idx: number,
    field: 'inventoryItem' | 'consumeQty' | 'consumeUnit' | 'isPrimary',
    value: any
  ) => {
    const updated = recipeRows.map((r, i) => {
      if (i !== idx) return r;
      if (field === 'inventoryItem') {
        const item = inventoryItems.find((inv) => inv._id === value);
        const isSugar = item?.name ? /سكر|sugar/i.test(item.name) : false;
        const defaultUnit =
          item?.unit === 'LITER' || item?.unit === 'ML'
            ? 'ML'
            : isSugar
            ? 'SPOON'
            : 'GRAM';
        return {
          ...r,
          inventoryItem: value,
          consumeUnit: defaultUnit,
          isPrimary: !isSugar,
        };
      }
      return { ...r, [field]: value };
    });
    setRecipeRows(updated);
    setRecipeErrors({});
    updateComputedAvailable(updated);
  };

  const addRecipeRow = () => {
    const unused = inventoryItems.find((i) => !recipeRows.some((r) => r.inventoryItem === i._id));
    const selectedItem = unused || inventoryItems[0];
    const isSugar = selectedItem?.name ? /سكر|sugar/i.test(selectedItem.name) : false;
    const defaultUnit =
      selectedItem?.unit === 'LITER' || selectedItem?.unit === 'ML'
        ? 'ML'
        : isSugar
        ? 'SPOON'
        : 'GRAM';
    const newRows = [
      ...recipeRows,
      {
        inventoryItem: selectedItem?._id || '',
        consumeQty: '',
        consumeUnit: defaultUnit,
        isPrimary: !isSugar,
      },
    ];
    setRecipeRows(newRows);
    setRecipeErrors({});
    updateComputedAvailable(newRows);
  };

  const removeRecipeRow = (idx: number) => {
    const updated = recipeRows.filter((_, i) => i !== idx);
    setRecipeRows(updated);
    updateComputedAvailable(updated);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Automatically sync computed availability with stock quantity form field
  useEffect(() => {
    if (recipeRows.length === 0) return; // منتج بدون خامات — الرصيد يدوي، متلمسوش
    // ✅ الأولوية للحساب المحلي الحي (computedAvailable) — بيتحدث فوراً مع كل تعديل
    // في كميات الاستهلاك. قيمة الـ Backend (recipeData) بديل احتياطي بس لو الحساب المحلي
    // مش متاح، بدل ما كانت بتعلّق الحقل على قيمة قديمة محفوظة وقت فتح النافذة.
    const calculated = computedAvailable !== null && computedAvailable !== undefined
      ? computedAvailable
      : recipeData?.availableProductQty;

    if (calculated !== null && calculated !== undefined) {
      setFormData((prev) => ({ ...prev, stockQuantity: String(calculated) }));
    }
  }, [computedAvailable, recipeData, recipeRows.length]);

  const handleFilterReset = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setStockFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const getProductImageUrl = (img: any): string => {
    if (typeof img === 'string' && img.trim()) return img;
    if (img && typeof img === 'object' && img.secure_url) return img.secure_url;
    return 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop';
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormErrors({});
    setRecipeErrors({});
    setRecipeRows([]);
    setComputedAvailable(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category: categories[0]?._id || '',
      stockQuantity: '',
      imageFile: null,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setFormErrors({});
    setRecipeErrors({});
    setRecipeRows([]);
    setComputedAvailable(null);
    setRecipeData(null);
    const catId = typeof prod.category === 'string' ? prod.category : prod.category._id;
    setFormData({
      name: prod.name,
      description: prod.description || '',
      price: String(prod.price),
      category: catId,
      stockQuantity: String(prod.stockQuantity),
      imageFile: null,
    });
    
    // Fetch recipe data from backend to get calculated available quantity
    recipeService.getRecipeByProduct(prod._id).then((res) => {
      if (res.success && res.data) {
        setRecipeData({
          availableProductQty: res.data.availableProductQty,
          ingredientDetails: res.data.ingredientDetails || [],
        });
        // Populate recipe rows from backend
        if (res.data.ingredientDetails && res.data.ingredientDetails.length > 0) {
          const rows = res.data.ingredientDetails.map((ing: any) => {
            const consumeUnit = ing.inputUnit || 'GRAM';
            const inv =
              typeof ing.inventoryItem === 'object' && ing.inventoryItem
                ? ing.inventoryItem
                : inventoryItems.find((i) => i._id === ing.inventoryItem);
            const qty = normalizeRecipeConsumeQty(
              ing,
              inv ? Number(inv.quantity) : undefined,
              inv?.unit
            );
            const invName = inv?.name || '';
            const isSugar = /سكر|sugar/i.test(invName);
            const isPrimary = ing.isPrimary !== undefined ? Boolean(ing.isPrimary) : !isSugar;
            return {
              inventoryItem: typeof ing.inventoryItem === 'string' ? ing.inventoryItem : ing.inventoryItem._id,
              consumeQty: String(qty),
              consumeUnit,
              isPrimary,
            };
          });
          setRecipeRows(rows);
          updateComputedAvailable(rows);
        }
      }
    }).catch(() => {
      // Recipe not found or error - continue without recipe data
    });
    
    setIsModalOpen(true);
  };

  const handleViewProduct = (prod: Product) => {
    setViewingProduct(prod);
    setIsViewModalOpen(true);
    setRecipeData(null); // إعادة تعيين البيانات قبل الجلب
    // Fetch recipe data for available quantity calculation
    recipeService.getRecipeByProduct(prod._id).then((res) => {
      if (res.success && res.data) {
        setRecipeData({
          availableProductQty: res.data.availableProductQty,
          ingredientDetails: res.data.ingredientDetails || [],
          depletedSecondary: res.data.depletedSecondary || [],
        });
      }
    }).catch(() => {
      setRecipeData(null);
    });
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCategoryFormSubmitted(true);
    const errors: { name?: string; description?: string } = {};

    if (!categoryForm.name.trim()) {
      errors.name = 'اسم التصنيف مطلوب';
    }
    // ✅ وصف التصنيف إجباري — برسالة واضحة توضح المطلوب
    if (!categoryForm.description.trim()) {
      errors.description = 'وصف التصنيف مطلوب — اكتب سطراً يوضح ما يحتويه هذا التصنيف (مثال: مشروبات ساخنة زي الشاي والقهوة والأعشاب)';
    } else if (categoryForm.description.trim().length < 5) {
      errors.description = `الوصف قصير جداً (${categoryForm.description.trim().length} حرف) — اكتب 5 أحرف على الأقل لتوضيح محتوى التصنيف`;
    }

    if (Object.keys(errors).length > 0) {
      setCategoryErrors(errors);
      showToast('الرجاء تصحيح الحقول المميزة باللون الأحمر', 'error');
      return;
    }

    setCategoryErrors({});

    try {
      setIsAddingCategory(true);
      const res = await categoryService.createCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
      });

      if (res.success) {
        showToast(`تم إنشاء التصنيف "${categoryForm.name.trim()}" بنجاح`);
        setIsCategoryModalOpen(false);
        setCategoryForm({ name: '', description: '' });
        loadData();
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    try {
      const res = await productService.deleteProduct(deleteTarget.id);
      if (res.success) {
        showToast(`تم حذف المنتج "${deleteTarget.name}" بنجاح`);
        setDeleteTarget(null);
        loadData();
      }
    } catch (err) {
      showError(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFormSubmitted(true);
    const errors: { name?: string; description?: string; price?: string; category?: string; stockQuantity?: string; imageFile?: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'اسم المنتج مطلوب';
    }
    if (!formData.description.trim()) {
      errors.description = 'وصف المنتج مطلوب';
    }
    if (formData.description.trim() && formData.description.trim().length < 2) {
      errors.description = 'يجب أن يكون الوصف حرفين على الأقل';
    }
    if (!formData.price || Number(formData.price) <= 0) {
      errors.price = 'الرجاء إدخال سعر صحيح أكبر من صفر';
    }
    if (!formData.category) {
      errors.category = 'الرجاء اختيار تصنيف المنتج';
    }
    // Only require manual stock quantity if no recipe ingredients are linked
    if (recipeRows.length === 0) {
      if (formData.stockQuantity === '' || Number(formData.stockQuantity) < 0) {
        errors.stockQuantity = 'الرجاء إدخال كمية مخزون صحيحة';
      }
    }
    
    // Require image when creating a new product
    if (!editingProduct && !formData.imageFile) {
      errors.imageFile = 'صورة المنتج مطلوبة إجبارياً لإضافة الصنف';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('الرجاء تصحيح الحقول المميزة باللون الأحمر', 'error');
      return;
    }

    setFormErrors({});

    // Validate recipe rows: every row must have a raw item + positive consume qty
    const validRows = recipeRows.filter((r) => r.inventoryItem && Number(r.consumeQty) > 0);
    if (recipeRows.length > 0 && validRows.length !== recipeRows.length) {
      setRecipeErrors({ row: 'أكمل اختيار الخامة وكمية الاستهلاك لكل صف (أو احذف الصف الفارغ)' });
      showToast('الرجاء إكمال بيانات الخامات المرتبطة (أو حذف الصف الفارغ)', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const data = new FormData();
      data.append('name', formData.name.trim());
      data.append('description', formData.description.trim());
      data.append('price', formData.price);
      data.append('category', formData.category);
      const finalStockQty = recipeRows.length > 0 
        ? String(computedAvailable !== null ? computedAvailable : (recipeData?.availableProductQty || 0))
        : (formData.stockQuantity || '0');
        
      data.append('stockQuantity', finalStockQty);
      if (formData.imageFile) {
        data.append('image', formData.imageFile);
      }

      let savedProductId = editingProduct ? editingProduct._id : '';

      if (editingProduct) {
        const res = await productService.updateProduct(editingProduct._id, data);
        if (res.success) {
          savedProductId = editingProduct._id;

          // ✅ حفظ الوصفة أيضاً عند التعديل — من غير كده كميات الاستهلاك الجديدة
          // مش بتتسجل على الـ Backend، وأي مزامنة مخزون بعدها (توريد/شراء)
          // بترجّع كمية المخزون المتاحة لعدد الأكواب القديم.
          try {
            const existingRecipes = await recipeService.listRecipes();
            const current = Array.isArray(existingRecipes?.data) ? existingRecipes.data : [];
            const existingRecipe = current.find(
              (rec) => (typeof rec.product === 'string' ? rec.product : rec.product._id) === savedProductId
            );

            if (validRows.length > 0) {
              const ingredients = validRows.map((r) => {
                const inv = inventoryItems.find((i) => i._id === r.inventoryItem);
                const rawQty = Number(r.consumeQty);
                const repaired = inv
                  ? repairConsumeQty(rawQty, r.consumeUnit, inv.quantity, inv.unit, 1)
                  : { qty: rawQty, unit: r.consumeUnit };
                return {
                  inventoryItem: r.inventoryItem,
                  inputQuantity: repaired.qty,
                  inputUnit: repaired.unit as 'KG' | 'GRAM' | 'LITER' | 'ML' | 'PIECE' | 'SPOON',
                  outputQuantity: 1,
                  isPrimary: r.isPrimary,
                };
              });
              if (existingRecipe) {
                await recipeService.updateRecipe(existingRecipe._id, { ingredients });
              } else {
                await recipeService.createRecipe({ product: savedProductId, ingredients, isActive: true });
              }
              showToast('تم تحديث المنتج والوصفة — كمية المخزون المتاحة اتحدثت بعدد الأكواب الجديد');
            } else if (existingRecipe) {
              // شيل كل الخامات أثناء التعديل → نمسح الوصفة عشان الرصيد يبقى يدوي
              // والمزامنة مترجّعش الرقم القديم
              await recipeService.deleteRecipe(existingRecipe._id);
              showToast('تم تحديث المنتج — الرصيد بقى يدوياً بدون خامات مرتبطة', 'info');
            } else {
              showToast('تم تحديث المنتج بنجاح');
            }
          } catch (recipeErr) {
            showError(recipeErr);
            showToast('تم تحديث المنتج لكن تعذّر حفظ الوصفة (الخامات)', 'info');
          }

          setIsModalOpen(false);
          loadData();
        }
      } else {
        const res = await productService.createProduct(data);
        if (res.success && res.data) {
          savedProductId = res.data._id;
          // Automatically sync the recipe (bill of materials) so stock auto-calculates
          if (validRows.length > 0) {
            try {
              const existingRecipes = await recipeService.listRecipes();
              const current = Array.isArray(existingRecipes?.data) ? existingRecipes.data : [];
              const existingRecipe = current.find(
                (rec) => (typeof rec.product === 'string' ? rec.product : rec.product._id) === savedProductId
              );
              const ingredients = validRows.map((r) => {
                const inv = inventoryItems.find((i) => i._id === r.inventoryItem);
                const rawQty = Number(r.consumeQty);
                const repaired = inv
                  ? repairConsumeQty(rawQty, r.consumeUnit, inv.quantity, inv.unit, 1)
                  : { qty: rawQty, unit: r.consumeUnit };
                return {
                  inventoryItem: r.inventoryItem,
                  inputQuantity: repaired.qty,
                  inputUnit: repaired.unit as 'KG' | 'GRAM' | 'LITER' | 'ML' | 'PIECE' | 'SPOON',
                  outputQuantity: 1,
                  isPrimary: r.isPrimary,
                };
              });
              if (existingRecipe) {
                await recipeService.updateRecipe(existingRecipe._id, { ingredients });
              } else {
                await recipeService.createRecipe({ product: savedProductId, ingredients, isActive: true });
              }
              showToast('تمت إضافة المنتج وربط الخامات للمخزون بنجاح');
            } catch (recipeErr) {
              showError(recipeErr);
              showToast('تم إضافة المنتج لكن تعذّر حفظ الوصفة (الخامات)', 'info');
            }
          } else {
            showToast('تمت إضافة المنتج بنجاح');
          }
          setIsModalOpen(false);
          loadData();
        }
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const catId = typeof p.category === 'string' ? p.category : p.category._id;
    const matchesCat = activeCategory === 'all' || catId === activeCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStock = true;
    if (stockFilter === 'in') matchesStock = productStockState(p) === 'available';
    if (stockFilter === 'low') matchesStock = productStockState(p) === 'low';
    if (stockFilter === 'out') matchesStock = productStockState(p) === 'out';

    // ✅ نطاق التاريخ المخصص — على تاريخ إضافة / تحديث المنتج
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const pDate = new Date(p.createdAt || p.updatedAt || '');
      if (!pDate || isNaN(pDate.getTime())) {
        matchesDate = false;
      } else {
        if (dateFrom && pDate < new Date(`${dateFrom}T00:00:00`)) matchesDate = false;
        if (dateTo && pDate > new Date(`${dateTo}T23:59:59.999`)) matchesDate = false;
      }
    }

    return matchesCat && matchesSearch && matchesStock && matchesDate;
  });

  const inStockCount = products.filter((p) => productStockState(p) === 'available').length;
  const lowStockCount = products.filter((p) => productStockState(p) === 'low').length;
  const outOfStockCount = products.filter((p) => productStockState(p) === 'out').length;

  return (
    <div className="space-y-6 text-right font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-200/60">
        <div>
          <h1 className="text-2xl font-bold font-arabic-heading text-gray-900">
            قائمة المنتجات (Menu Catalog)
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            إدارة قائمة المشروبات والمأكولات، الأسعار، وحالة التوفر في المخزن.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenAddModal}
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 ml-1.5" />}
            className="bg-[#2e5b9f] hover:bg-[#244b85]"
          >
            إضافة منتج جديد
          </Button>
          <Button
            onClick={() => {
              setCategoryErrors({});
              setCategoryForm({ name: '', description: '' });
              setIsCategoryModalOpen(true);
            }}
            variant="outline"
            leftIcon={<FolderPlus className="w-4 h-4" />}
          >
            تصنيف جديد
          </Button>
        </div>
      </div>

      {/* ✨ شريط الفلترة الموحّد — بحث + حالة المخزون + منتقي تاريخ احترافي */}
      <DashboardFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="ابحث باسم المنتج أو الوصف — مثال: كابتشينو، كرواسون"
        groupLabel="الحالة:"
        periods={[
          { id: 'all', label: `الكل (${formatNumber(products.length)})` },
          { id: 'in', label: `متوفر (${formatNumber(inStockCount)})` },
          { id: 'low', label: `منخفض (${formatNumber(lowStockCount)})` },
          { id: 'out', label: `نافذ (${formatNumber(outOfStockCount)})` },
        ]}
        activePeriod={stockFilter}
        onPeriodChange={(id) => setStockFilter(id as typeof stockFilter)}
        resultCount={filteredProducts.length}
        resultLabel="منتج معروض"
        activeCount={
          (searchQuery ? 1 : 0) +
          (activeCategory !== 'all' ? 1 : 0) +
          (stockFilter !== 'all' ? 1 : 0) +
          (dateFrom ? 1 : 0) +
          (dateTo ? 1 : 0)
        }
        onReset={handleFilterReset}
      >
        <DateRangeFilter
          value={{
            from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : null,
            to: dateTo ? new Date(`${dateTo}T00:00:00`) : null,
            preset: 'custom',
          }}
          onChange={(range) => {
            setDateFrom(range.from ? toLocalDateString(range.from) : '');
            setDateTo(range.to ? toLocalDateString(range.to) : '');
          }}
          showPresets
          className="w-full sm:w-[260px]"
        />
      </DashboardFilterBar>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white rounded-2xl border border-gray-200/80 p-3 shadow-2xs">
        <button
          onClick={() => setActiveCategory('all')}
          className={`py-1.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeCategory === 'all'
              ? 'bg-[#2e5b9f] text-white shadow-2xs'
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          الكل
        </button>
        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => setActiveCategory(cat._id)}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeCategory === cat._id
                ? 'bg-[#2e5b9f] text-white shadow-2xs'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
          <h3 className="font-bold text-base text-gray-900">قائمة المنتجات</h3>
        </div>

        {isLoading ? (
          <LoadingSkeleton type="table" count={8} />
) : filteredProducts.length === 0 ? (
          <div className="text-center py-14 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400 mx-2">
            <div className="w-14 h-14 rounded-2xl bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 flex items-center justify-center text-[#2e5b9f] mx-auto mb-3">
              <Coffee className="w-6 h-6" />
            </div>
            <p className="text-gray-600 font-bold text-sm">لا توجد منتجات مطابقة</p>
            <p className="text-xs text-gray-500 mt-2">جرّب كلمة بحث أخرى أو امسح الفلاتر لعرض كل المنتجات.</p>
          </div>
        ) : (
          <>
            {/* Mobile & Tablet Card Layout (< md) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
              {filteredProducts.map((prod) => {
                const catName =
                  typeof prod.category === 'object' ? prod.category.name : 'عام';
                const state = productStockState(prod);
                return (
                  <div
                    key={prod._id}
                    onClick={() => handleViewProduct(prod)}
                    className="bg-[#faf8f5]/50 border border-gray-200/60 rounded-2xl p-4 space-y-3 cursor-pointer hover:shadow-2xs transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getProductImageUrl(prod.image)}
                          alt={prod.name}
                          className="w-12 h-12 rounded-xl object-cover border border-gray-100 shadow-2xs shrink-0"
                          onError={(e) => {
                            e.currentTarget.src =
                              'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop';
                          }}
                        />
                        <div>
                          <span className="font-bold text-gray-900 text-sm block">{prod.name}</span>
                          <span className="inline-flex mt-1 py-0.5 px-2 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
                            {catName}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant={state === 'available' ? 'available' : state === 'low' ? 'low' : 'out'}
                          size="sm"
                        >
                          {state === 'available'
                            ? 'متوفر'
                            : state === 'low'
                            ? 'منخفض'
                            : primaryDepletedMap[prod._id] && primaryDepletedMap[prod._id].length > 0
                            ? `نفذ (${primaryDepletedMap[prod._id].join('، ')})`
                            : 'نفذ'}
                        </Badge>
                        {recipeDepletedMap[prod._id] && recipeDepletedMap[prod._id].length > 0 && state !== 'out' && (
                          <span
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1 py-0.5 rounded"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            عجز: {recipeDepletedMap[prod._id].join('، ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {prod.description && (
                      <p className="text-[11px] text-gray-400 line-clamp-2">
                        {prod.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block mb-0.5">السعر</span>
                        <span className="font-bold text-[#2e5b9f] font-mono text-sm">
                          {formatPrice(prod.price)}
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] text-gray-400 block mb-0.5">المخزون المتاح</span>
                        <span className="font-bold text-gray-700 font-mono">
                          {formatNumber(prod.stockQuantity)} وحدة
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100/50" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleViewProduct(prod)}
                        className="p-1.5 text-gray-400 hover:text-[#2e5b9f] hover:bg-blue-50 rounded-lg transition"
                        title="عرض التفاصيل"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(prod)}
                        className="p-1.5 text-gray-400 hover:text-[#2e5b9f] hover:bg-blue-50 rounded-lg transition"
                        title="تعديل المنتج"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: prod._id, name: prod.name })}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="حذف المنتج"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table Layout (>= md) */}
            <div className="hidden md:block overflow-x-auto -mx-6 px-6 pb-2">
              <table className="w-full text-right border-collapse text-xs min-w-[650px]">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                    <th className="pb-3 px-3">المنتج</th>
                    <th className="pb-3 px-3">التصنيف</th>
                    <th className="pb-3 px-3">السعر</th>
                    <th className="pb-3 px-3">المخزون المتاح</th>
                    <th className="pb-3 px-3">حالة التوفر</th>
                    <th className="pb-3 px-3 text-left">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {filteredProducts.map((prod) => {
                    const catName =
                      typeof prod.category === 'object' ? prod.category.name : 'عام';
                    const state = productStockState(prod);
                    return (
                      <tr
                        key={prod._id}
                        className="hover:bg-[#faf8f5]/60 transition cursor-pointer"
                        onClick={() => handleViewProduct(prod)}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={getProductImageUrl(prod.image)}
                              alt={prod.name}
                              className="w-10 h-10 rounded-xl object-cover border border-gray-100 shadow-2xs shrink-0"
                              onError={(e) => {
                                e.currentTarget.src =
                                  'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop';
                              }}
                            />
                            <div>
                              <span className="font-bold text-gray-900 block">{prod.name}</span>
                              {prod.description && (
                                <span className="text-[11px] text-gray-400 truncate max-w-xs block">
                                  {prod.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="inline-flex py-1 px-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg text-[11px]">
                            {catName}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-bold font-mono text-sm text-[#2e5b9f]">
                          {formatPrice(prod.price)}
                        </td>

                        <td className="py-3 px-3 font-mono font-medium text-gray-700">
                          {formatNumber(prod.stockQuantity)} وحدة
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={state === 'available' ? 'available' : state === 'low' ? 'low' : 'out'}
                              size="sm"
                            >
                              {state === 'available'
                                ? 'متوفر'
                                : state === 'low'
                                ? 'منخفض'
                                : primaryDepletedMap[prod._id] && primaryDepletedMap[prod._id].length > 0
                                ? `نفذ (${primaryDepletedMap[prod._id].join('، ')})`
                                : 'نفذ المخزون'}
                            </Badge>

                            {/* تنبيه عجز في خامة ثانوية (مثل السكر) */}
                            {recipeDepletedMap[prod._id] && recipeDepletedMap[prod._id].length > 0 && state !== 'out' && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.5 rounded"
                                title={`خامات ثانوية نفذت: ${recipeDepletedMap[prod._id].join('، ')}`}
                              >
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>عجز: {recipeDepletedMap[prod._id].join('، ')}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-left" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewProduct(prod)}
                              className="p-1.5 text-gray-400 hover:text-[#2e5b9f] hover:bg-blue-50 rounded-lg transition"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(prod)}
                              className="p-1.5 text-gray-400 hover:text-[#2e5b9f] hover:bg-blue-50 rounded-lg transition"
                              title="تعديل المنتج"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ id: prod._id, name: prod.name })}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="حذف المنتج"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* View Product Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="تفاصيل المنتج"
        maxWidth="md"
      >
        {viewingProduct && (
          <div className="space-y-4 text-right font-sans">
            <div className="flex items-center gap-4 p-4 bg-[#faf8f5] rounded-2xl border border-gray-100">
              <img
                src={getProductImageUrl(viewingProduct.image)}
                alt={viewingProduct.name}
                className="w-20 h-20 rounded-2xl object-cover border border-gray-200 shadow-2xs"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop';
                }}
              />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{viewingProduct.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{viewingProduct.description || 'لا يوجد وصف'}</p>
              </div>
            </div>

            {/* الأكواب المتاحة — بارز في الأعلى */}
            <div className="p-4 bg-gradient-to-l from-[#eef3fc] to-[#f5f8ff] rounded-2xl border border-[#c5d5f0] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#2e5b9f] font-bold block mb-0.5">الأكواب المتاحة (من المكونات الأساسية)</span>
                <span className="text-3xl font-bold font-mono text-[#2e5b9f]">
                  {recipeData ? formatNumber(recipeData.availableProductQty) : '…'}
                </span>
                <span className="text-sm text-[#2e5b9f] mr-1">كوب</span>
              </div>
              <div className="text-right">
                <Badge
                  variant={(() => {
                    const s = productStockState({
                      inStock: viewingProduct.inStock,
                      stockQuantity: recipeData?.availableProductQty ?? viewingProduct.stockQuantity,
                    });
                    return s === 'available' ? 'available' : s === 'low' ? 'low' : 'out';
                  })()}
                  size="sm"
                >
                  {(() => {
                    const s = productStockState({
                      inStock: viewingProduct.inStock,
                      stockQuantity: recipeData?.availableProductQty ?? viewingProduct.stockQuantity,
                    });
                    return s === 'available' ? 'متوفر' : s === 'low' ? 'منخفض' : 'نفذ المخزون';
                  })()}
                </Badge>
              </div>
            </div>

            {/* تحذير: خامات ثانوية نفذت */}
            {recipeData && recipeData.depletedSecondary && recipeData.depletedSecondary.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-amber-600 text-base">⚠️</span>
                  <span className="text-[12px] font-bold text-amber-700">
                    خامات ثانوية نفذت — لا تؤثر على عدد الأكواب لكن تحتاج تعبئة
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recipeData.depletedSecondary.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200"
                    >
                      🥄 {item.name}
                      <span className="text-amber-500 font-normal">(نفذ)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">السعر</span>
                <span className="text-lg font-bold font-mono text-[#2e5b9f]">{formatPrice(viewingProduct.price)}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">المخزون (يدوي)</span>
                <span className="text-lg font-bold font-mono text-gray-900">{formatNumber(viewingProduct.stockQuantity)} وحدة</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">التصنيف</span>
                <span className="text-sm font-bold text-gray-900">
                  {typeof viewingProduct.category === 'object' ? viewingProduct.category.name : 'عام'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] text-gray-400 font-bold block">حالة المنتج</span>
                <span className="text-sm font-bold text-gray-700">{viewingProduct.inStock ? '✅ متاح للبيع' : '🔴 غير متاح'}</span>
              </div>
            </div>

            {/* تفصيل حالة مكونات الوصفة ورصد العجز بدقة */}
            {recipeData && recipeData.ingredientDetails && recipeData.ingredientDetails.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800">تفاصيل الخامات ورصد العجز (الوصفة)</span>
                  <span className="text-[10px] text-gray-500">حساب كفاية المخزون لكل خامة</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {recipeData.ingredientDetails.map((detail, idx) => {
                    const itemName = detail.inventoryItem?.name || `خامة #${idx + 1}`;
                    const itemUnit = detail.inventoryItem?.unit || '';
                    const itemStock = Number(detail.inventoryItem?.quantity) || 0;
                    const availableCups = Number(detail.availableFromThisIngredient) || 0;
                    const isPrimary = detail.isPrimary !== false;
                    const isDepleted = itemStock <= 0 || availableCups <= 0;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs border ${
                          isDepleted
                            ? isPrimary
                              ? 'bg-red-50 border-red-200 text-red-800'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-white border-gray-100 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            isPrimary ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isPrimary ? 'أساسية' : 'ثانوية'}
                          </span>
                          <span className="font-semibold">{itemName}</span>
                          <span className="text-[10px] text-gray-400">
                            (رصيد: {formatNumber(itemStock)} {itemUnit})
                          </span>
                        </div>

                        <div className="text-left font-mono">
                          {isDepleted ? (
                            <span className="font-bold text-xs flex items-center gap-1">
                              {isPrimary ? '⛔ عجز أساسي (نفذ)' : '⚠️ عجز ثانوي (نفذ)'}
                            </span>
                          ) : (
                            <span className="font-bold">
                              تكفي: {formatNumber(availableCups)} كوب
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsViewModalOpen(false)}
              >
                إغلاق
              </Button>
              <Button
                type="button"
                variant="primary"
                className="bg-[#2e5b9f]"
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleOpenEditModal(viewingProduct);
                }}
              >
                تعديل المنتج
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
        maxWidth="2xl"
      >
        <form noValidate onSubmit={handleSubmit} className="space-y-4 text-right">
          <Input
            label="اسم المنتج *"
            placeholder="مثال: كابتشينو، كولد برو..."
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
            }}
            error={formErrors.name}
            required
            isSubmitted={isFormSubmitted}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="السعر (جنيها) *"
              type="number"
              min="0"
              placeholder="185"
              value={formData.price}
              onChange={(e) => {
                setFormData({ ...formData, price: e.target.value });
                if (formErrors.price) setFormErrors({ ...formErrors, price: undefined });
              }}
              error={formErrors.price}
              required
              isSubmitted={isFormSubmitted}
            />

            <Select
              label="التصنيف *"
              value={formData.category}
              onChange={(e) => {
                setFormData({ ...formData, category: e.target.value });
                if (formErrors.category) setFormErrors({ ...formErrors, category: undefined });
              }}
              error={formErrors.category}
              options={categories.map((c) => ({ value: c._id, label: c.name }))}
            />
          </div>

          <Input
            label={recipeRows.length > 0 ? "كمية المخزون المتاحة * (محسوبة تلقائياً)" : "كمية المخزون المتاحة *"}
            type="number"
            min="0"
            placeholder="30"
            disabled={recipeRows.length > 0}
            className={recipeRows.length > 0 ? "bg-gray-100 cursor-not-allowed font-bold" : ""}
            value={formData.stockQuantity}
            onChange={(e) => {
              if (recipeRows.length > 0) return; // double guard
              setFormData({ ...formData, stockQuantity: e.target.value });
              if (formErrors.stockQuantity) setFormErrors({ ...formErrors, stockQuantity: undefined });
            }}
            error={formErrors.stockQuantity}
            helperText={
              (() => {
                if (recipeRows.length > 0) {
                  return `🔒 هذا الحقل مغلق ومحمي. يتم حساب كمية الإنتاج المتاحة تلقائياً (${computedAvailable !== null ? formatNumber(computedAvailable) : 0} كوب) بناءً على أرصدة خامات المخزن الحالية وكميات الاستهلاك — وبيتحدث فوراً مع أي تعديل.`;
                }
                return 'اربط خامات المخزون بالأسفل لحساب الكمية تلقائياً من الخامات، أو اكتب الرصيد يدوياً للمنتجات الجاهزة.';
              })()
            }
            required
          />

{/* Recipe / Raw-material linking (auto stock calculation from inventory) */}
          <div className="rounded-2xl border border-[#2e5b9f]/25 bg-blue-50/40 p-4 text-right space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2e5b9f]/15">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-white border border-[#2e5b9f]/25 flex items-center justify-center shadow-2xs">
                  <FlaskConical className="w-4 h-4 text-[#2e5b9f]" />
                </span>
                <div>
                  <p className="text-xs font-bold text-gray-900">ربط خامات المخزون</p>
                  <p className="text-[10px] text-gray-500">احسب الكمية المتاحة تلقائياً من أرصدة المخزن</p>
                </div>
              </div>
              {(computedAvailable !== null || (recipeData?.availableProductQty !== undefined && recipeData?.availableProductQty !== null)) && (
                <button
                  type="button"
                  onClick={() => {
                    // ✅ نفس منطق الحقل: القيمة الحية المحلية أولاً — بتتحدث مع كل تعديل
                    const qty = computedAvailable !== null && computedAvailable !== undefined
                      ? computedAvailable
                      : recipeData?.availableProductQty;
                    setFormData((prev) => ({ ...prev, stockQuantity: String(qty) }));
                    if (formErrors.stockQuantity) setFormErrors({ ...formErrors, stockQuantity: undefined });
                  }}
                  className="inline-flex items-center gap-1 bg-[#2e5b9f] hover:bg-[#244b85] text-white font-bold text-[11px] py-1.5 px-3 rounded-xl transition cursor-pointer shadow-2xs"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>تطبيق المحسوب ({(() => {
                    const qty = computedAvailable !== null && computedAvailable !== undefined
                      ? computedAvailable
                      : recipeData?.availableProductQty;
                    return qty ?? 0;
                  })()})</span>
                </button>
              )}
            </div>

            {recipeRows.length > 0 && (
              <p className="text-[11px] text-gray-500 leading-relaxed flex items-center gap-1.5">
                <Info className="w-3 h-3 shrink-0" />
                مثال: خامة "حليب" برصيد ٢٠ لتر واستهلاك ٠.٢ لتر للكوب ← الكمية المتاحة ١٠٠ كوب.
              </p>
            )}

            {recipeRows.map((row, idx) => {
              const selectedInv = inventoryItems.find((i) => i._id === row.inventoryItem);
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-[#2e5b9f]/15 bg-white shadow-sm overflow-hidden"
                >
                  {/* Compact Row Header */}
                  <div className="flex items-center justify-between px-3.5 py-2 bg-gradient-to-l from-[#2e5b9f]/5 to-blue-50/30 border-b border-[#2e5b9f]/10">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleRecipeRowChange(idx, 'isPrimary', !row.isPrimary)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                          row.isPrimary
                            ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                        }`}
                        title={row.isPrimary ? "انقر للتحويل إلى خامة مساعدة" : "انقر للتحويل إلى خامة أساسية"}
                      >
                        {row.isPrimary ? '⭐ خامة أساسية (تحدد الأكواب)' : '🥄 خامة مساعدة (لا تقيّد الأكواب)'}
                      </button>
                      {selectedInv && (
                        <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                          الرصيد: {formatNumber(selectedInv.quantity)} {selectedInv.unit}
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-[#2e5b9f] bg-[#2e5b9f]/10 px-2 py-0.5 rounded-full">
                        خامة #{idx + 1}
                      </span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => removeRecipeRow(idx)}
                      title="إزالة الخامة"
                      className="inline-flex items-center gap-1 text-rose-500 hover:text-white font-bold text-[11px] hover:bg-rose-500 px-2 py-1 rounded-lg transition cursor-pointer border border-rose-200"
                    >
                      <TrashIcon className="w-3 h-3" />
                      <span>إزالة</span>
                    </button>
                  </div>

                  {/* Row Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.1fr] gap-2.5 p-3 items-end text-right">
                    {/* Inventory Item Select */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-700">الخامة من المخزون</label>
                      <div className="relative">
                        <select
                          value={row.inventoryItem}
                          onChange={(e) => handleRecipeRowChange(idx, 'inventoryItem', e.target.value)}
                          className="w-full appearance-none bg-[#faf8f5] hover:bg-white focus:bg-white border border-gray-200 focus:border-[#2e5b9f] focus:ring-2 focus:ring-[#2e5b9f]/15 rounded-xl pr-4 pl-9 py-2.5 text-xs text-gray-900 transition cursor-pointer focus:outline-none font-semibold"
                          dir="rtl"
                        >
                          {inventoryItems.map((i) => (
                            <option key={i._id} value={i._id}>
                              {i.name}  ·  {i.quantity} {i.unit}
                            </option>
                          ))}
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <FlaskConical className="w-3.5 h-3.5 text-[#2e5b9f]/60" />
                        </div>
                      </div>
                    </div>

                    {/* Consumption per unit */}
                    <Input
                      label="الاستهلاك للوحدة"
                      type="number"
                      min="0.001"
                      step="any"
                      placeholder="10"
                      value={row.consumeQty}
                      onChange={(e) => handleRecipeRowChange(idx, 'consumeQty', e.target.value)}
                    />

                    {/* Unit selection */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-700">وحدة الاستهلاك</label>
                      <div className="relative">
                        <select
                          value={row.consumeUnit}
                          onChange={(e) => handleRecipeRowChange(idx, 'consumeUnit', e.target.value)}
                          className="w-full appearance-none bg-[#faf8f5] hover:bg-white focus:bg-white border border-gray-200 focus:border-[#2e5b9f] focus:ring-2 focus:ring-[#2e5b9f]/15 rounded-xl pr-4 pl-9 py-2.5 text-xs text-gray-900 transition cursor-pointer focus:outline-none font-bold"
                          dir="rtl"
                        >
                          {[
                            { value: 'GRAM', label: 'جرام (GRAM)' },
                            { value: 'SPOON', label: 'معلقة (5 جرام)' },
                            { value: 'KG', label: 'كيلوجرام (KG)' },
                            { value: 'ML', label: 'مللي لتر (ML)' },
                            { value: 'LITER', label: 'لتر (LITER)' },
                            { value: 'PIECE', label: 'قطعة (PIECE)' },
                          ].map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Calculator className="w-3.5 h-3.5 text-[#2e5b9f]/60" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row Bottom Info */}
                  <div className="px-3 pb-2.5 pt-1.5 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    {row.isPrimary ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تحدد رصيد المنتج: {(() => {
                          if (!selectedInv || !Number(row.consumeQty)) return 'أدخل كمية الاستهلاك';
                          const invBase = getQtyInBase(selectedInv.quantity, selectedInv.unit);
                          const repaired = repairConsumeQty(Number(row.consumeQty), row.consumeUnit || 'GRAM', selectedInv.quantity, selectedInv.unit, 1);
                          const consumeBase = getQtyInBase(repaired.qty, repaired.unit);
                          return consumeBase > 0 ? `${formatNumber(Math.floor(invBase / consumeBase))} كوب متاح` : '—';
                        })()}
                      </span>
                    ) : (
                      <span className="text-purple-700 font-medium flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" />
                        خامة مساعدة (مثل السكر) — تُخصم من المخزن مع كل طلب ولا تقيّد رصيد الأكواب
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {recipeErrors.row && (
              <p className="text-[11px] text-rose-600 font-bold">{recipeErrors.row}</p>
            )}

            {inventoryItems.length === 0 ? (
              <p className="text-[11px] text-gray-500">
                لا توجد خامات في المخزون بعد. أضف خامات من صفحة المخزون أولاً لتفعيل الحساب التلقائي.
              </p>
            ) : (
              <button
                type="button"
                onClick={addRecipeRow}
                className="inline-flex items-center gap-1.5 border border-dashed border-[#2e5b9f]/40 text-[#2e5b9f] font-bold text-xs py-2 px-4 rounded-xl hover:bg-blue-100 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة خامة من المخزون</span>
              </button>
            )}
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${formErrors.description && isFormSubmitted ? 'text-rose-600 font-bold' : 'text-gray-700'}`}>
              الوصف والمكونات *
            </label>
            <textarea
              rows={2}
              placeholder="وصف مختصر للمنتج يظهر في المنيو..."
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                if (formErrors.description) setFormErrors({ ...formErrors, description: undefined });
              }}
              className={`w-full bg-[#faf8f5] hover:bg-white focus:bg-white border rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-[#2e5b9f]/20 focus:border-[#2e5b9f] ${formErrors.description && isFormSubmitted ? 'border-rose-500 bg-rose-50/30' : 'border-gray-200'}`}
            />
            {formErrors.description && isFormSubmitted && (
              <p className="text-[11px] text-rose-600 font-bold mt-1">⚠️ {formErrors.description}</p>
            )}
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${formErrors.imageFile && isFormSubmitted ? 'text-rose-600 font-bold' : 'text-gray-700'}`}>
              صورة المنتج (JPG / PNG) *
            </label>
            {formData.imageFile ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <span className="text-xs font-bold text-emerald-800 truncate flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {formData.imageFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, imageFile: null })}
                  className="text-xs font-bold text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                >
                  إزالة
                </button>
              </div>
            ) : (
              <label className={`flex items-center justify-center gap-2 border border-dashed rounded-xl py-4 px-3 text-xs font-bold transition cursor-pointer hover:bg-blue-50/60 ${formErrors.imageFile && isFormSubmitted ? 'border-rose-400 bg-rose-50/30 text-rose-600' : 'border-gray-300 text-gray-500'}`}>
                <Plus className="w-4 h-4" />
                اضغط لاختيار صورة المنتج
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    setFormData({ ...formData, imageFile: e.target.files ? e.target.files[0] : null });
                    if (formErrors.imageFile) setFormErrors({ ...formErrors, imageFile: undefined });
                  }}
                />
              </label>
            )}
            {formErrors.imageFile && isFormSubmitted && (
              <p className="text-[11px] text-rose-600 font-bold mt-1">⚠️ {formErrors.imageFile}</p>
            )}
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="bg-[#2e5b9f]"
            >
              {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setIsCategoryFormSubmitted(false);
        }}
        title="إضافة تصنيف جديد"
        maxWidth="sm"
      >
        <form noValidate onSubmit={handleCreateCategory} className="space-y-4 text-right">
          <Input
            label="اسم التصنيف *"
            placeholder="مثال: مشروبات ساخنة، حلويات، شيشة..."
            value={categoryForm.name}
            onChange={(e) => {
              setCategoryForm({ ...categoryForm, name: e.target.value });
              if (categoryErrors.name) setCategoryErrors({ ...categoryErrors, name: undefined });
            }}
            error={categoryErrors.name}
            required
            autoFocus
            isSubmitted={isCategoryFormSubmitted}
          />

          <div>
            <label className={`block text-xs font-bold mb-1.5 ${categoryErrors.description && isCategoryFormSubmitted ? 'text-rose-600' : 'text-gray-700'}`}>
              وصف التصنيف *
              <span className="text-gray-400 font-normal"> (إجباري — يوضح محتوى التصنيف)</span>
            </label>
            <textarea
              rows={2}
              placeholder="مثال: مشروبات ساخنة زي الشاي، القهوة، الأعشاب..."
              value={categoryForm.description}
              onChange={(e) => {
                setCategoryForm({ ...categoryForm, description: e.target.value });
                if (categoryErrors.description) setCategoryErrors({ ...categoryErrors, description: undefined });
              }}
              className={`w-full bg-[#faf8f5] hover:bg-white focus:bg-white border rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-[#2e5b9f]/20 focus:border-[#2e5b9f] ${
                categoryErrors.description && isCategoryFormSubmitted
                  ? 'border-rose-500 bg-rose-50/30'
                  : 'border-gray-200'
              }`}
              required
            />
            {categoryErrors.description && isCategoryFormSubmitted && (
              <p className="flex items-start gap-1 text-[11px] font-bold text-rose-600 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 inline-block shrink-0 mt-1" />
                {categoryErrors.description}
              </p>
            )}
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isAddingCategory}
              className="bg-[#2e5b9f]"
            >
              إضافة التصنيف
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="حذف المنتج"
        message={`هل أنت متأكد من حذف المنتج "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="نعم، احذف"
        cancelText="إلغاء"
        variant="danger"
        onConfirm={handleDeleteProduct}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};