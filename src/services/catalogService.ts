 import { ApiClient } from './api/apiClient';
import { ApiResponse, Category, Product, Recipe } from '../types';

export const categoryService = {
  listCategories: (): Promise<ApiResponse<Category[]>> => {
    return ApiClient.request<Category[]>('/categories', { method: 'GET' });
  },

  createCategory: (name: string | { name: string; description?: string }, description?: string): Promise<ApiResponse<Category>> => {
    const payload = typeof name === 'string' ? { name, description } : name;
    return ApiClient.request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCategory: (id: string, name?: string, description?: string): Promise<ApiResponse<Category>> => {
    return ApiClient.request<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, description }),
    });
  },

  deleteCategory: (id: string): Promise<ApiResponse<void>> => {
    return ApiClient.request<void>(`/categories/${id}`, { method: 'DELETE' });
  },
};

export const productService = {
  listProducts: (params?: { search?: string; category?: string; inStock?: boolean }): Promise<ApiResponse<Product[]>> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category) query.append('category', params.category);
    if (params?.inStock !== undefined) query.append('inStock', String(params.inStock));
    const qs = query.toString();
    return ApiClient.request<Product[]>(`/products${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  getProduct: (id: string): Promise<ApiResponse<Product>> => {
    return ApiClient.request<Product>(`/products/${id}`, { method: 'GET' });
  },

  createProduct: (formData: FormData): Promise<ApiResponse<Product>> => {
    return ApiClient.request<Product>('/products', {
      method: 'POST',
      body: formData,
    });
  },

  updateProduct: (id: string, formData: FormData): Promise<ApiResponse<Product>> => {
    return ApiClient.request<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: formData,
    });
  },

  deleteProduct: (id: string): Promise<ApiResponse<void>> => {
    return ApiClient.request<void>(`/products/${id}`, { method: 'DELETE' });
  },
};

// المنيو العام أصبح Static من ملف src/data/menuData.ts — لا يوجد endpoint للمنيو العام
export const recipeService = {
  listRecipes: (): Promise<ApiResponse<Recipe[]>> => {
    return ApiClient.request<Recipe[]>('/recipes', { method: 'GET' });
  },

  getRecipeByProduct: (productId: string): Promise<ApiResponse<{ recipe: Recipe; availableProductQty: number; ingredientDetails?: any[]; depletedSecondary?: { name: string; unit: string; currentStock: number }[] }>> => {
    return ApiClient.request<{ recipe: Recipe; availableProductQty: number; ingredientDetails?: any[]; depletedSecondary?: { name: string; unit: string; currentStock: number }[] }>(`/recipes/product/${productId}`, {
      method: 'GET',
    });
  },

  createRecipe: (data: { product: string; ingredients: any[]; isActive?: boolean }): Promise<ApiResponse<Recipe>> => {
    return ApiClient.request<Recipe>('/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateRecipe: (id: string, data: { ingredients?: any[]; isActive?: boolean }): Promise<ApiResponse<Recipe>> => {
    return ApiClient.request<Recipe>(`/recipes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteRecipe: (id: string): Promise<ApiResponse<void>> => {
    return ApiClient.request<void>(`/recipes/${id}`, { method: 'DELETE' });
  },
};