import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-sans font-medium transition-[color,background-color,border-color,opacity,transform] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-fg text-bg hover:bg-white",
        outline:
          "bg-surface text-fg shadow-ring hover:bg-surface-2",
        ghost: "bg-transparent text-muted hover:bg-surface hover:text-fg",
        danger: "bg-transparent text-warn hover:bg-surface",
      },
      size: {
        default: "h-11 rounded-full px-4 text-sm",
        lg: "h-12 rounded-full px-5 text-sm",
        sm: "h-9 rounded-full px-3.5 text-sm",
        icon: "size-11 rounded-full",
        send: "size-11 rounded-full",
      },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
