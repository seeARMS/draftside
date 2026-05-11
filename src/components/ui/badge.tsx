import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium leading-4",
  {
    variants: {
      variant: {
        default: "bg-muted/70 text-muted-foreground",
        success: "bg-muted/70 text-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border border-border bg-background text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
