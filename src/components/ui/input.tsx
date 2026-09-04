import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-12 w-full rounded-xl bg-surface px-4 font-sans text-base text-fg shadow-ring outline-none transition-[box-shadow,background-color] duration-150 placeholder:text-faint focus:bg-surface-2 focus:shadow-ring",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
