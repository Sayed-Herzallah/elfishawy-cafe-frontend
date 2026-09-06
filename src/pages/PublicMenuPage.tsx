import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MENU_CATEGORIES,
  DEFAULT_MENU_IMAGE,
  filterMenuItems,
  getSortedCategories,
  getCategoryById,
  getItemPriceRange,
} from '../data/menuData';
import { Search, SearchX, ArrowLeft, X, Sparkles } from 'lucide-react';
import { usePageSEO } from '../seo/usePageSEO';
import { PAGE_SEO } from '../seo/seoConfig';
import { buildWebSiteSchema, buildMenuPageSchemas } from '../seo/structuredData';

const ALL_FILTER = 'all';

export const PublicMenuPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>(ALL_FILTER);
  const [searchQuery, setSearchQuery] = useState<string>('');

  usePageSEO({
    meta: PAGE_SEO.menu,
    jsonLd: [buildWebSiteSchema(), ...buildMenuPageSchemas()],
  });

  const categories = getSortedCategories();

  // المنيو ثابت (Static) — الفلترة والبحث تحدث فورًا بدون أي طلبات شبكة
  const filteredItems = useMemo(
    () => filterMenuItems({ categoryId: activeCategory, searchQuery }),
    [activeCategory, searchQuery]
  );

  const resetFilters = () => {
    setSearchQuery('');
    setActiveCategory(ALL_FILTER);
  };

  const hasActiveFilter = searchQuery.trim() !== '' || activeCategory !== ALL_FILTER;

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-[#1c1917] pb-24">
      {/* Top Banner Header with Back Button */}
      <div className="relative min-h-[360px] bg-gray-950 text-white flex items-center justify-center overflow-hidden px-6">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 scale-105"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1600&auto=format&fit=crop')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/70" />

        <div className="relative z-10 text-center space-y-4 max-w-xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold font-arabic-heading">
            منيو مقهى الفيشاوي
          </h1>
          <p className="text-lg md:text-xl text-white/80 font-calligraphy max-w-2xl mx-auto">
            قائمة المشروبات المتاحة وأسعارها
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-[#2e5b9f] hover:bg-[#244b85] text-white font-bold py-2.5 px-6 rounded-xl transition text-xs shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>العودة إلى الرئيسية</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Menu Catalog Section with Filter & Search */}
      <section className="py-12 px-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
          {/* Search Box */}
          <div className="relative w-full md:w-80 text-right">
            <Search className="w-4 h-4 text-[#2e5b9f] absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث عن مشروب مثل: قهوة، شاي، مانجو"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pr-10 pl-9 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2e5b9f]/20 focus:border-[#2e5b9f] shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="مسح البحث"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setActiveCategory(ALL_FILTER)}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeCategory === ALL_FILTER
                  ? 'bg-[#2e5b9f] text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              الكل
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-[#2e5b9f] text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="ml-1">{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Cards Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 p-8">
            <div className="w-14 h-14 rounded-2xl bg-[#2e5b9f]/5 border border-[#2e5b9f]/15 flex items-center justify-center text-[#2e5b9f] mx-auto mb-3">
              <SearchX className="w-6 h-6" />
            </div>
            <p className="text-gray-600 font-bold text-sm">لا توجد نتائج مطابقة لبحثك</p>
            <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">
              {searchQuery.trim()
                ? `لم نجد أي مشروب باسم «${searchQuery.trim()}». جرّب كلمة أخرى أو تصفّح تصنيفاً مختلفاً.`
                : 'لا توجد أصناف معروضة في هذا التصنيف حالياً، جرّب تصنيفاً آخر.'}
            </p>
            {hasActiveFilter && (
              <button
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-1.5 bg-[#2e5b9f] hover:bg-[#244b85] text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer shadow-2xs"
              >
                <X className="w-3.5 h-3.5" />
                مسح البحث والفلاتر
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const category = getCategoryById(item.categoryId);
              const availableVariants = item.variants.filter((v) => v.isAvailable);
              const priceRange = getItemPriceRange(item);
              const hasMultipleVariants = availableVariants.length > 1;

              return (
                <article
                  key={item.id}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-100/90 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                >
                  <div className="relative aspect-4/3 w-full bg-gray-100 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_MENU_IMAGE;
                      }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      {item.isPopular && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm bg-amber-400 text-amber-950">
                          <Sparkles className="w-3.5 h-3.5" />
                          الأكثر طلباً
                        </span>
                      )}
                    </div>
                    {category && (
                      <div className="absolute bottom-2.5 right-2.5">
                        <span className="text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm bg-white/95 text-gray-700">
                          {category.icon} {category.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 text-right flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 text-lg leading-snug">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{item.description}</p>
                    )}

                    {/* قائمة الأنواع — تظهر فقط لو الصنف له أكثر من نوع وسعر */}
                    {hasMultipleVariants && (
                      <ul className="mt-3 flex-1 divide-y divide-dashed divide-gray-100">
                        {availableVariants.map((variant) => (
                          <li key={variant.id} className="flex items-center justify-between py-2.5">
                            <span className="text-sm font-bold text-gray-600 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2e5b9f]/50" />
                              {variant.label}
                            </span>
                            <span className="text-base font-extrabold font-mono text-[#2e5b9f]">
                              {variant.price}
                              <span className="text-xs font-sans font-medium text-gray-400 mr-1">جنيها</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* ملخص السعر — مرة واحدة فقط بدون تكرار */}
                    <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between bg-[#faf8f5] -mx-4 -mb-4 px-4 py-3 rounded-b-2xl">
                      <span className="text-sm text-gray-400 font-bold">
                        {hasMultipleVariants ? 'يبدأ السعر من' : 'السعر'}
                      </span>
                      <span className="font-extrabold text-xl text-[#2e5b9f] font-mono">
                        {priceRange.min}
                        <span className="text-xs font-sans font-medium text-gray-400 mr-1">جنيها</span>
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
