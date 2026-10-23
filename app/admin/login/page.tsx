import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_AUTH_COOKIE, ADMIN_AUTH_PROVIDER, isValidAdminSession } from "@/lib/admin-auth";
import styles from "../admin.module.css";

const NUS_LOGO = "https://www.nus.edu.sg/images/default-source/identity-images/fullcolorlogo.jpg";

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  if (isValidAdminSession(cookieStore.get(ADMIN_AUTH_COOKIE)?.value)) redirect("/admin/content");

  return (
    <main className={styles.loginShell}>
      <section className={styles.loginCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.nusLogo} src={NUS_LOGO} alt="National University of Singapore" />
        <div className={styles.loginEyebrow}>RC4 dashboard administration</div>
        <h1>Welcome back</h1>
        <p>Sign in with your NUS identity to manage RC4 highlights and connect the dining hall feed.</p>

        <form action={ADMIN_AUTH_PROVIDER.loginEndpoint} method="post">
          <button className={styles.nusLoginButton} type="submit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={NUS_LOGO} alt="" aria-hidden="true" />
            <span>{ADMIN_AUTH_PROVIDER.label}</span>
            <i aria-hidden="true">→</i>
          </button>
        </form>

        <div className={styles.mockNotice}>
          <strong>Prototype sign-in</strong>
          <span>No username or password is requested. This button creates a local mock admin session.</span>
        </div>
        <Link className={styles.backLink} href="/">← Back to dashboard</Link>
      </section>
    </main>
  );
}
