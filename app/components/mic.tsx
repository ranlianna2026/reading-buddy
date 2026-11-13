export function Mic({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      id="mic"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`btn w-full flex-1 gap-3 ${on ? "btn-sun listening" : "btn-leaf"}`}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
        <path d="M12 17.5V21M9 21h6" />
      </svg>
      {label}
    </button>
  );
}
