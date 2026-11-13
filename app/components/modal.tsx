import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// A dialog must escape the page: the top nav uses backdrop-blur, and a backdrop-filter ancestor
// becomes the containing block for position:fixed, which trapped this inside the 80px nav strip.
export function Modal({
  label,
  onClose,
  children,
  z = 50,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  z?: number;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = was;
      removeEventListener("keydown", escape);
    };
  }, []);
  if (!ready) return null;
  return createPortal(
    <div
      className="fixed inset-0 grid place-items-center overflow-y-auto bg-black/55 p-4 sm:p-6"
      style={{ zIndex: z }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div
        className="pop card my-auto flex max-h-[88svh] w-full max-w-lg flex-col gap-5 overflow-y-auto p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
