import { useQuery } from '@tanstack/react-query';

interface Category {
  id: number;
  key: string;
  label: string;
  color: string;
  isActive: boolean;
  displayOrder: number;
}

export function useCategoryColors() {
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const getCategoryColor = (categoryKey: string): string => {
    const category = categories.find(cat => cat.key === categoryKey);
    return category?.color || '#95A5A6';
  };

  const categoryColorMap = categories.reduce((acc, category) => {
    acc[category.key] = category.color;
    return acc;
  }, {} as Record<string, string>);

  return {
    categories,
    getCategoryColor,
    categoryColorMap
  };
}