import { Toaster, toast } from "sonner";

export function ToastContainer() {
  return (
    <Toaster 
      position="top-center"
      richColors
      closeButton
      duration={4000}
    />
  );
}

// Export toast for direct use
export { toast };
