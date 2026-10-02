"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  CheckCircle2,
  Download,
  Key,
  Lock,
  Layers,
  Zap,
  ShieldCheck,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Invoice = {
  id: string;
  period: string;
  amount: string;
  status: "PAID" | "PENDING";
  date: string;
};

export default function BillingPage() {
  const { token, orgId } = useSession();
  const [ssoEnforced, setSsoEnforced] = useState(true);

  const mockInvoices: Invoice[] = [
    { id: "INV-2026-09", period: "Sep 1 - Sep 30, 2026", amount: "$1,250.00", status: "PAID", date: "Oct 1, 2026" },
    { id: "INV-2026-08", period: "Aug 1 - Aug 31, 2026", amount: "$1,250.00", status: "PAID", date: "Sep 1, 2026" },
    { id: "INV-2026-07", period: "Jul 1 - Jul 31, 2026", amount: "$1,250.00", status: "PAID", date: "Aug 1, 2026" },
  ];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Billing, Invoices & Enterprise SSO
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your organization tier, quota consumption, invoices, and SAML 2.0 Single Sign-On federation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-semibold py-1 px-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          >
            <ShieldCheck className="size-3.5 mr-1 text-emerald-500" />
            Enterprise Tier Active
          </Badge>
        </div>
      </div>

      {/* Subscription Tier Overview Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Current Plan */}
        <Card className="rounded-2xl border-border/70 shadow-xs md:col-span-2">
          <CardHeader className="pb-3 border-b border-border/70 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-brand-pink text-white flex items-center justify-center font-bold text-xs">
                  EP
                </div>
                <div>
                  <CardTitle className="text-sm font-heading font-bold text-foreground">
                    Enterprise Platform Fleet Plan
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Dedicated multi-tenant isolation with 99.99% uptime SLA guarantee
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold rounded-full">
                $1,250 / mo
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {/* Quota Progress */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-foreground">Monthly Ingress Telemetry Consumption</span>
                <span className="font-mono text-muted-foreground">18,240,000 / 50,000,000 events (36%)</span>
              </div>
              <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-pink to-brand-gold rounded-full w-[36%]" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl border border-border bg-secondary/30">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Canary Slots</p>
                <p className="text-base font-heading font-black text-foreground mt-0.5">Unlimited</p>
              </div>
              <div className="p-3 rounded-xl border border-border bg-secondary/30">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Audit Retention</p>
                <p className="text-base font-heading font-black text-foreground mt-0.5">365 Days</p>
              </div>
              <div className="p-3 rounded-xl border border-border bg-secondary/30">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Support Tier</p>
                <p className="text-base font-heading font-black text-brand-pink mt-0.5">24/7 Slack & Call</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enterprise SSO Card */}
        <Card className="rounded-2xl border-border/70 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/70 bg-muted/20">
            <CardTitle className="text-xs font-heading font-bold text-foreground flex items-center gap-2">
              <Lock className="size-3.5 text-brand-pink" />
              SAML 2.0 / OIDC Identity Provider
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-secondary/30">
              <div className="flex items-center gap-2">
                <Building className="size-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">Google Workspace OIDC</span>
              </div>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 rounded-full">
                Connected
              </Badge>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-bold text-foreground">Enforce SSO Authentication</p>
                <p className="text-[11px] text-muted-foreground">Disallow password-only logins for all members</p>
              </div>
              <button
                type="button"
                onClick={() => setSsoEnforced(!ssoEnforced)}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border",
                  ssoEnforced
                    ? "bg-brand-pink text-white border-brand-pink shadow-xs"
                    : "bg-secondary text-muted-foreground border-border"
                )}
              >
                {ssoEnforced ? "Enforced" : "Optional"}
              </button>
            </div>

            <div className="pt-2 border-t border-border">
              <span className="text-[10px] text-muted-foreground font-mono block truncate">
                ACS URL: https://api.strim.io/v1/sso/saml/callback
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices History Table */}
      <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/70 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-brand-pink" />
            <CardTitle className="text-xs font-heading font-bold text-foreground">
              Invoices & Statements
            </CardTitle>
          </div>
          <p className="text-[11px] text-muted-foreground">Billed automatically to Corporate Card (•••• 4242)</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Invoice ID
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Billing Period
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Amount
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Receipt
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInvoices.map((inv) => (
                <TableRow key={inv.id} className="hover:bg-secondary/40 transition-colors border-border/70">
                  <TableCell className="py-3 font-mono text-xs font-bold text-foreground">
                    {inv.id}
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground">
                    {inv.period}
                  </TableCell>
                  <TableCell className="py-3 font-mono text-xs font-bold text-foreground">
                    {inv.amount}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="text-[10px] rounded-full text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-bold">
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => alert(`Downloading receipt for ${inv.id}`)}
                      className="h-8 rounded-lg text-xs hover:bg-secondary cursor-pointer gap-1"
                    >
                      <Download className="size-3.5" />
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
