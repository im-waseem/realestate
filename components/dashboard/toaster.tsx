"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface Toast {
  id: string;
  message: string;
  kind: "success" | "info" | "error";
}

const ToastContext = createContext<{
  toast: (message: string, kind?: Toast["kind"]) => void;
}>({ toast: () => undefined });

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`toast toast-${item.kind}`}
            role="status"
          >
            <span className="toast-dot" />
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext).toast;
}
