import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api/client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?error=missing_code", request.url));
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/google/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const msg = errorData.message || "Failed to authenticate with Google";
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent(msg)}`, request.url)
      );
    }

    const data = await res.json();
    const token = data.accessToken;

    // Redirect to onboarding or dashboard passing token to client handler
    const redirectUrl = new URL("/onboarding", request.url);
    if (token) {
      redirectUrl.searchParams.set("token", token);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(err.message || "OAuth failure")}`, request.url)
    );
  }
}
