import { useEffect } from "react";
import { X, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

const STYLES = {
  info: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",
  warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400",
  error: "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400",
};

const ICON_STYLES = {
  info: "text-blue-500",
  warning: "text-yellow-500",
  error: "text-red-500",
};

export function ToastContainer() {
  const notifications = useSessionStore((s) => s.notifications);
  const removeNotification = useSessionStore((s) => s.removeNotification);

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          id={notification.id}
          message={notification.message}
          type={notification.type}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  id: number;
  message: string;
  type: "info" | "warning" | "error";
  onClose: () => void;
}

function Toast({ id, message, type, onClose }: ToastProps) {
  const Icon = ICONS[type];

  // Auto-close after 4 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        "flex items-start gap-2 p-3 rounded-lg border shadow-lg animate-in slide-in-from-right-full",
        STYLES[type]
      )}
    >
      <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", ICON_STYLES[type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm whitespace-pre-wrap">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-current opacity-50 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
