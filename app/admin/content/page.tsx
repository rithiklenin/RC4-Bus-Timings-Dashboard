import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";
import AdminConsole from "./AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return <AdminConsole adminEmail={user.email ?? "Approved administrator"} />;
}
