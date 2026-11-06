import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminUser, isAdminAuthConfigured } from "@/lib/admin-auth";
import styles from "../admin.module.css";

const NUS_LOGO = "https://www.nus.edu.sg/images/default-source/identity-images/fullcolorlogo.jpg";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdminUser()) redirect("/admin/content");
  const query = await searchParams;

  return (
    <main className={styles.loginShell}>
      <section className={styles.loginCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.nusLogo} src={NUS_LOGO} alt="National University of Singapore" />
        <div className={styles.loginEyebrow}>RC4 dashboard administration</div>
        <h1>Admin sign-in</h1>
        <p>Enter your approved NUS email address to continue to the prototype admin page.</p>

        <form className={styles.emailLoginForm} action="/api/admin-auth/login" method="post">
          <label htmlFor="admin-email">Approved email address</label>
          <input id="admin-email" name="email" type="email" autoComplete="email" placeholder="name@nus.edu.sg" required />
          <button type="submit">Continue to admin page</button>
        </form>

        <div className={styles.loginNotice} role="note"><strong>Prototype access</strong><span>This prototype does not verify ownership of the email address. Only pre-approved NUS email addresses can access the admin page.</span></div>
        {query.error && <div className={`${styles.loginNotice} ${styles.loginError}`} role="alert"><strong>Unable to sign in</strong><span>{query.error}</span></div>}
        {!isAdminAuthConfigured() && <div className={`${styles.loginNotice} ${styles.loginError}`} role="alert"><strong>Setup required</strong><span>Add at least one email to the prototype admin whitelist and ensure Blob storage is connected.</span></div>}
        <Link className={styles.backLink} href="/">← Back to dashboard</Link>
      </section>
    </main>
  );
}
