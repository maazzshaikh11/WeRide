/**
 * Toast store — global transient toast state (spec §5.7).
 * Variants: success (green plate), error (red), warn (yellow), info (black).
 * Auto-dismiss handled by ToastContainer.
 */
import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'warn' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant = 'success') => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Convenience hook (spec file plan: hooks/useToast.ts). */
export function useToast() {
  return useToastStore((s) => s.push);
}