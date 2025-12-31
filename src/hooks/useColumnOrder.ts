import { useState, useEffect, useCallback } from 'react';
import { ColumnKey, ColumnDef, DEFAULT_COLUMNS } from '@/types/driver';

const STORAGE_KEY = 'taxi-roster-column-order';

export function useColumnOrder() {
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);

  // Load column order from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const storedOrder: ColumnKey[] = JSON.parse(stored);
        // Reorder columns based on stored order, keeping any new columns at the end
        const reordered: ColumnDef[] = [];
        for (const key of storedOrder) {
          const col = DEFAULT_COLUMNS.find(c => c.key === key);
          if (col) reordered.push(col);
        }
        // Add any columns not in stored order
        for (const col of DEFAULT_COLUMNS) {
          if (!reordered.find(c => c.key === col.key)) {
            reordered.push(col);
          }
        }
        setColumns(reordered);
      }
    } catch (e) {
      console.error('Failed to load column order:', e);
    }
  }, []);

  // Save column order to localStorage
  const saveOrder = useCallback((newColumns: ColumnDef[]) => {
    try {
      const order = newColumns.map(c => c.key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch (e) {
      console.error('Failed to save column order:', e);
    }
  }, []);

  // Reorder columns (drag and drop)
  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prev => {
      const newColumns = [...prev];
      const [removed] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, removed);
      saveOrder(newColumns);
      return newColumns;
    });
  }, [saveOrder]);

  // Reset to default order
  const resetOrder = useCallback(() => {
    setColumns(DEFAULT_COLUMNS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { columns, moveColumn, resetOrder };
}
