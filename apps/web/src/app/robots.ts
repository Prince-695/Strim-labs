import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/how-it-works", "/docs"],
        disallow: ["/dashboard", "/projects", "/settings", "/login", "/signup", "/forgot-password", "/reset-password"],
      },
    ],
  };
}
