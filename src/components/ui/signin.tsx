import { forwardRef } from "react";
import { type VariantProps } from "class-variance-authority";
import { LogIn } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button.tsx";

export type SignInButtonProps = Omit<
  React.ComponentProps<"button">,
  "onClick"
> &
  VariantProps<typeof buttonVariants> & {
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    showIcon?: boolean;
    signInText?: string;
    signOutText?: string;
    loadingText?: string;
  };

export const SignInButton = forwardRef<HTMLButtonElement, SignInButtonProps>(
  ({ onClick, showIcon = true, signInText = "Connect backend", className, variant, size, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        onClick={onClick}
        variant={variant}
        size={size}
        className={className}
        aria-label="Connect backend"
        {...props}
      >
        {showIcon && <LogIn className="size-4" />}
        {signInText}
      </Button>
    );
  },
);

SignInButton.displayName = "SignInButton";
