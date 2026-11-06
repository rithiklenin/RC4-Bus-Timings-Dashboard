import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  redirect(await getAdminUser() ? "/admin/content" : "/admin/login");
}
