"use server";

import { revalidatePath } from "next/cache";
import { setCookie, deleteCookie } from "./_shared";

export async function loginAction(userId: string): Promise<void> {
  await setCookie("user_id", userId);
  revalidatePath("/");
}

export async function logoutAction(): Promise<void> {
  await deleteCookie("user_id");
  await deleteCookie("tz");
  revalidatePath("/");
}

export async function setTimezoneAction(tz: string): Promise<void> {
  await setCookie("tz", tz);
  revalidatePath("/");
}
