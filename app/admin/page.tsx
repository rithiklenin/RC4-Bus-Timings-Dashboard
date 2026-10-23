import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_AUTH_COOKIE, isValidAdminSession } from "@/lib/admin-auth";

export default async function AdminPage() {
  const cookieStore = await cookies();
  redirect(isValidAdminSession(cookieStore.get(ADMIN_AUTH_COOKIE)?.value) ? "/admin/content" : "/admin/login");
}
