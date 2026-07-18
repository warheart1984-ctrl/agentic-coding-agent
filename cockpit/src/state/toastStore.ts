import { create } from "zustand";

export type ToastLevel = "info" | "success" | "warn" | "error";

export interface Toast {
  id: string;
  message: string;
  level: ToastLevel;
  createdAt: number;
}

interface ToastStore {
  toasts: Toast[];
  add: (message: string, level?: ToastLevel) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, level = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, level, createdAt: Date.now() }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
