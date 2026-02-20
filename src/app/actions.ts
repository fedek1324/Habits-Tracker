"use server";

import { cookies } from "next/headers";

const COOKIE_NAME = "google_refresh_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function setRefreshTokenCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearRefreshTokenCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
