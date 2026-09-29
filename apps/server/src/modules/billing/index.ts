import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { requireAnyRole, requireRole } from "../../middleware/rbac";
import {
  createRetentionPolicyRoute,
  generateInvoiceRoute,
  getBillingOverviewRoute,
  getSsoConfigRoute,
  listChaosExperimentsRoute,
  listInvoicesRoute,
  listRetentionPoliciesRoute,
  purgeRetentionRoute,
  revertChaosExperimentRoute,
  startChaosExperimentRoute,
  updatePlanRoute,
  updateSsoConfigRoute,
} from "./routes";
import {
  createRetentionPolicyHandler,
  generateInvoiceHandler,
  getBillingOverviewHandler,
  getSsoConfigHandler,
  listChaosExperimentsHandler,
  listInvoicesHandler,
  listRetentionPoliciesHandler,
  purgeRetentionHandler,
  revertChaosExperimentHandler,
  startChaosExperimentHandler,
  updatePlanHandler,
  updateSsoConfigHandler,
} from "./handlers";

export const billingRoutes = new OpenAPIHono<AppEnv>();
billingRoutes.use("*", requireAuth, requireOrg);

// Billing overview & invoice routes require BILLING or ADMIN/OWNER role
billingRoutes.use("/", requireAnyRole(["BILLING"]));
billingRoutes.use("/invoices/*", requireAnyRole(["BILLING"]));
billingRoutes.use("/invoices", requireAnyRole(["BILLING"]));
billingRoutes.use("/plan", requireAnyRole(["BILLING"]));

billingRoutes.openapi(getBillingOverviewRoute, getBillingOverviewHandler);
billingRoutes.openapi(generateInvoiceRoute, generateInvoiceHandler);
billingRoutes.openapi(listInvoicesRoute, listInvoicesHandler);
billingRoutes.openapi(updatePlanRoute, updatePlanHandler);

export const retentionRoutes = new OpenAPIHono<AppEnv>();
retentionRoutes.use("*", requireAuth, requireOrg, requireRole("ADMIN"));

retentionRoutes.openapi(listRetentionPoliciesRoute, listRetentionPoliciesHandler);
retentionRoutes.openapi(createRetentionPolicyRoute, createRetentionPolicyHandler);
retentionRoutes.openapi(purgeRetentionRoute, purgeRetentionHandler);

export const ssoRoutes = new OpenAPIHono<AppEnv>();
ssoRoutes.use("*", requireAuth, requireOrg, requireRole("OWNER"));

ssoRoutes.openapi(getSsoConfigRoute, getSsoConfigHandler);
ssoRoutes.openapi(updateSsoConfigRoute, updateSsoConfigHandler);

export const chaosRoutes = new OpenAPIHono<AppEnv>();
chaosRoutes.use("*", requireAuth, requireOrg);

chaosRoutes.openapi(listChaosExperimentsRoute, listChaosExperimentsHandler);
chaosRoutes.openapi(startChaosExperimentRoute, startChaosExperimentHandler);
chaosRoutes.openapi(revertChaosExperimentRoute, revertChaosExperimentHandler);

export * from "./schemas";
export * from "./types";
export * as BillingService from "./service";
