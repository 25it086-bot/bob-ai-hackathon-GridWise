import { create } from "zustand";

interface AlertStore {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
}));
