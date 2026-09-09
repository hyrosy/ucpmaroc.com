import React from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardStateVariant = "loading" | "empty" | "error";

interface DashboardStateProps {
  variant: DashboardStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function DashboardState({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: DashboardStateProps) {
  const isLoading = variant === "loading";
  const isError = variant === "error";
  const Icon = isLoading ? Loader2 : isError ? AlertCircle : Inbox;

  return (
    <div className={cn("flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 px-6 py-12 text-center", className)} role={isError ? "alert" : undefined}>
      <Icon className={cn("mb-4 h-8 w-8 text-muted-foreground", isLoading && "animate-spin", isError && "text-destructive")} />
      <h2 className="text-base font-semibold text-foreground">{title || (isLoading ? "Loading" : isError ? "Something went wrong" : "Nothing here yet")}</h2>
      {description && <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
      {actionLabel && onAction && <Button variant="outline" size="sm" onClick={onAction} className="mt-5">{actionLabel}</Button>}
    </div>
  );
}
