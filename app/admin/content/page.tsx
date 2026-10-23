import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_AUTH_COOKIE, isValidAdminSession } from "@/lib/admin-auth";
import AdminConsole from "./AdminConsole";

export default async function AdminContentPage() {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(ADMIN_AUTH_COOKIE)?.value)) redirect("/admin/login");
  return <AdminConsole />;
}
