import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import {
  changePasswordRoute,
  forgotPasswordRoute,
  getMeRoute,
  googleCallbackRoute,
  googleUrlRoute,
  loginRoute,
  logoutRoute,
  refreshRoute,
  resetPasswordRoute,
  signUpRoute,
  updateMeRoute,
} from "./routes";
import {
  changePasswordHandler,
  forgotPasswordHandler,
  getMeHandler,
  googleCallbackHandler,
  googleUrlHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  resetPasswordHandler,
  signUpHandler,
  updateMeHandler,
} from "./handlers";

export const authRoutes = new OpenAPIHono<AppEnv>();

authRoutes.openapi(signUpRoute, signUpHandler);
authRoutes.openapi(loginRoute, loginHandler);
authRoutes.openapi(googleUrlRoute, googleUrlHandler);
authRoutes.openapi(googleCallbackRoute, googleCallbackHandler);
authRoutes.openapi(logoutRoute, logoutHandler);
authRoutes.openapi(refreshRoute, refreshHandler);
authRoutes.openapi(forgotPasswordRoute, forgotPasswordHandler);
authRoutes.openapi(resetPasswordRoute, resetPasswordHandler);
authRoutes.openapi(getMeRoute, getMeHandler);
authRoutes.openapi(updateMeRoute, updateMeHandler);
authRoutes.openapi(changePasswordRoute, changePasswordHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
