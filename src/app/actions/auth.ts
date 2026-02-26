"use server";

import { revalidatePath } from "next/cache";
import { setCookie, deleteCookie } from "./_shared";

/**
 * Called after Google OAuth. Only stores the refresh token — no Google API calls here.
 * page.tsx handles finding/creating the spreadsheet on next render.
 */
export async function loginAction(refreshToken: string): Promise<void> {
  await setCookie("google_refresh_token", refreshToken);
  revalidatePath("/");
}

export async function logoutAction(): Promise<void> {
  await deleteCookie("google_refresh_token");
  revalidatePath("/");
}

export async function setTimezoneAction(tz: string): Promise<void> {
  await setCookie("tz", tz);
  revalidatePath("/");
}
