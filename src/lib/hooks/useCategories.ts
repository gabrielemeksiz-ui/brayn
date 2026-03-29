import { useState, useEffect, useCallback } from 'react';
import type { Category } from '../types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const visibleCategories = categories
    .filter(c => !c.hidden)
    .sort((a, b) => a.sort_order - b.sort_order);

  const getCatById = (catId: string): Category | undefined =>
    categories.find(c => c.id === catId);

  const getCatLabel = (catId: string): string =>
    getCatById(catId)?.label ?? catId;

  const getCatColor = (catId: string): string =>
    getCatById(catId)?.color ?? '#6B7280';

  return {
    categories: visibleCategories,
    allCategories: categories,
    isLoading,
    getCatLabel,
    getCatColor,
    refetch: fetchCategories,
  };
}
