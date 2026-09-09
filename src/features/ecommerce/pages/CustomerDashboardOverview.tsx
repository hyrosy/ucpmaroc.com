import React from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, ArrowRight, ShoppingBag } from "lucide-react";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";

interface CustomerDashboardContext {
  customer?: { name?: string | null } | null;
  portfolio?: { site_name?: string | null; public_slug?: string | null } | null;
}

export default function CustomerDashboardOverview() {
  const { customer, portfolio } = useOutletContext<CustomerDashboardContext>();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <DashboardPageHeader
        eyebrow={portfolio?.site_name || "Customer workspace"}
        title={`Welcome back, ${customer?.name?.split(" ")[0] || "there"}`}
        description="Manage your orders and track shipments from one place."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-primary/5 border-primary/20 shadow-none hover:bg-primary/10 transition-colors cursor-pointer" onClick={() => navigate(`../orders`)}>
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center">
                <Package size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-primary">My Orders</h3>
                <p className="text-xs text-primary/70 font-medium">Track your recent purchases</p>
              </div>
            </div>
            <ArrowRight className="text-primary opacity-50" />
          </CardContent>
        </Card>

        <Card className="bg-background border-border shadow-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 bg-muted text-muted-foreground rounded-full flex items-center justify-center mb-3">
            <ShoppingBag size={24} />
          </div>
          <h3 className="font-bold text-foreground">Continue Shopping</h3>
          <p className="text-xs text-muted-foreground mb-4">Head back to the store to see new arrivals.</p>
          <Button variant="outline" size="sm" onClick={() => navigate(`/pro/${portfolio.public_slug}`)}>
            Return to Store
          </Button>
        </Card>
      </div>
    </div>
  );
}