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
    <div className={cn("flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-gradient-to-b from-background to-muted/20 px-6 py-12 text-center", className)} role={isError ? "alert" : undefined}>
      <div className={cn("mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/70", isError && "bg-destructive/10")}>
        <Icon className={cn("h-5 w-5 text-muted-foreground", isLoading && "animate-spin", isError && "text-destructive")} />
      </div>
      <h2 className="text-base font-semibold text-foreground">{title || (isLoading ? "Loading" : isError ? "Something went wrong" : "Nothing here yet")}</h2>
      {description && <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
      {actionLabel && onAction && <Button variant="outline" size="sm" onClick={onAction} className="mt-5">{actionLabel}</Button>}
    </div>
  );
}
