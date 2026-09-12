import React, { useState, useEffect } from 'react';
import { categoryService } from '../../services/catalogService';
import { Category } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import { formatDate } from '../../utils/formatters';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FilterDialog } from '../../components/ui/FilterDialog';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Filter,
  Tag,
} from 'lucide-react';

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  
  // Filter Dialog
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
  });
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);

  const { showToast, showError } = useNotification();

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const res = await categoryService.listCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setFormErrors({});
    setFormData({ name: '' });
    setIsFormSubmitted(false);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormErrors({});
    setFormData({ name: cat.name });
    setIsFormSubmitted(false);
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFormSubmitted(true);
    const errors: { name?: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'اسم التصنيف مطلوب';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('الرجاء تصحيح الحقول المميزة باللون الأحمر', 'error');
      return;
    }

    setFormErrors({});

    try {
      setIsSubmitting(true);
      let res;
      if (editingCategory) {
        res = await categoryService.updateCategory(editingCategory._id, formData.name.trim());
      } else {
        res = await categoryService.createCategory({
          name: formData.name.trim(),
        });
      }

      if (res.success) {
        showToast(editingCategory ? `تم تحديث التصنيف "${formData.name.trim()}" بنجاح` : `تم إنشاء التصنيف "${formData.name.trim()}" بنجاح`);
        setIsAddModalOpen(false);
        setFormData({ name: '' });
        loadCategories();
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await categoryService.deleteCategory(deleteTarget.id);
      if (res.success) {
        showToast(`تم حذف التصنيف "${deleteTarget.name}" بنجاح`);
        loadCategories();
      }
    } catch (err) {
      showError(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  // Filter Dialog Config
  const filterDialogConfig = {
    title: 'تصفية التصنيفات',
    fields: [
      {
        name: 'search',
        label: 'بحث',
        type: 'input' as const,
        placeholder: 'اسم التصنيف...',
        defaultValue: searchQuery,
      },
    ],
    activeFiltersCount: searchQuery ? 1 : 0,
  };

  const handleFilterApply = (values: any) => {
    if (values.search !== undefined) setSearchQuery(values.search);
    setIsFilterDialogOpen(false);
  };

  const handleFilterReset = () => {
    setSearchQuery('');
    setIsFilterDialogOpen(false);
  };

  return (
    <div className="space-y-6 text-right font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-200/60">
        <div>
          <h1 className="text-2xl font-bold font-arabic-heading text-gray-900">
            إدارة التصنيفات
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            إنشاء وتعديل وحذف تصنيفات المنتجات والمنيو.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenAddModal}
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 ml-1.5" />}
            className="bg-[#2e5b9f] hover:bg-[#244b85]"
          >
            إضافة تصنيف جديد
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث باسم التصنيف — مثال: قهوة، حلويات، مخبوزات"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#faf8f5] hover:bg-white focus:bg-white border border-gray-200 rounded-xl pr-10 pl-3 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2e5b9f]/20 focus:border-[#2e5b9f]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsFilterDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200/60 rounded-xl text-xs font-bold text-gray-700 hover:bg-[#faf8f5] transition cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-[#2e5b9f]" />
              تصفية متقدمة
            </button>
            {searchQuery && (
              <button
                onClick={handleFilterReset}
                className="flex items-center justify-center gap-1 py-2 px-3 border border-gray-200/60 rounded-xl text-xs font-bold text-rose-600 hover:bg-[#fff5f5] transition cursor-pointer"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
          <span className="text-xs text-gray-400 font-mono">
            {filteredCategories.length} تصنيف معروض
          </span>
          <h3 className="font-bold text-base text-gray-900">قائمة التصنيفات</h3>
        </div>

        {isLoading ? (
          <LoadingSkeleton type="table" count={8} />
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-14 bg-white border border-dashed border-gray-200 rounded-2xl text-gray-400 mx-2">
            <div className="w-14 h-14 rounded-2xl bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 flex items-center justify-center text-[#2e5b9f] mx-auto mb-3">
              <Tag className="w-6 h-6" />
            </div>
            <p className="text-gray-600 font-bold text-sm">لا توجد تصنيفات مطابقة</p>
            <p className="text-xs text-gray-500 mt-2">جرّب كلمة بحث أخرى أو امسح الفلاتر لعرض كل التصنيفات.</p>
          </div>
        ) : (
          <>
            {/* Mobile & Tablet Card Layout (< md) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
              {filteredCategories.map((cat) => (
                <div
                  key={cat._id}
                  className="bg-[#faf8f5]/50 border border-gray-200/60 rounded-2xl p-4 space-y-3 text-right"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 text-sm">{cat.name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {cat.createdAt ? formatDate(cat.createdAt) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100/50">
                    <button
                      onClick={() => handleOpenEditModal(cat)}
                      className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-[#2e5b9f]/10 text-[#2e5b9f] hover:bg-[#2e5b9f]/20 font-bold transition text-[11px]"
                      title="تعديل التصنيف"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat._id, cat.name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="حذف التصنيف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout (>= md) */}
            <div className="hidden md:block overflow-x-auto -mx-6 px-6 pb-2">
              <table className="w-full text-right border-collapse text-xs min-w-[550px]">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                    <th className="pb-3 px-3">اسم التصنيف</th>
                    <th className="pb-3 px-3">تاريخ الإنشاء</th>
                    <th className="pb-3 px-3 text-left">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {filteredCategories.map((cat) => (
                    <tr key={cat._id} className="hover:bg-[#faf8f5]/60 transition">
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-gray-900 block">{cat.name}</span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-gray-500 text-[11px]">
                        {cat.createdAt ? formatDate(cat.createdAt) : '—'}
                      </td>

                      <td className="py-3.5 px-3 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(cat)}
                            className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 font-bold transition text-[11px]"
                            title="تعديل التصنيف"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat._id, cat.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="حذف التصنيف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCategory(null);
          setIsFormSubmitted(false);
        }}
        title={editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
        maxWidth="md"
      >
        <form noValidate onSubmit={handleSubmit} className="space-y-4 text-right">
          <Input
            label="اسم التصنيف *"
            placeholder="مثال: مشروبات ساخنة، حلويات، مخبوزات..."
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
            }}
            error={formErrors.name}
            required
            autoFocus
            isSubmitted={isFormSubmitted}
          />

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingCategory(null);
                setIsFormSubmitted(false);
              }}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="bg-[#2e5b9f]"
            >
              {editingCategory ? 'حفظ التعديلات' : 'إضافة التصنيف'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف التصنيف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
      />

      {/* Filter Dialog */}
      <FilterDialog
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        config={filterDialogConfig}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
      />
    </div>
  );
};