import { cn } from "@/lib/cn";

interface Props {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md";
  onClick?: () => void;
}

export function Card({ children, className, padding = "md", onClick }: Props) {
  const padMap = { none: "", sm: "p-3", md: "p-5" };
  if (onClick) {
    return (
      <button
        type="button"
        className={cn(
          "w-full text-left bg-[var(--color-base-2)] border border-[var(--color-base-4)] rounded-lg",
          "shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
          padMap[padding],
          "cursor-pointer transition-colors hover:bg-[var(--color-base-3)]",
          className
        )}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }
  return (
    <div
      className={cn(
        "bg-[var(--color-base-2)] border border-[var(--color-base-4)] rounded-lg",
        "shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
        padMap[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
