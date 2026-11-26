"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Enter a password with at least 6 characters."),
});

type LoginFields = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFields>({
    resolver: zodResolver(schema),
  });
  const busy = isSubmitting || redirecting;

  async function signIn(credentials: LoginFields) {
    setAuthError(null);
    try {
      const { error } = await createClient().auth.signInWithPassword(credentials);
      if (error) {
        setAuthError(error.message);
        return;
      }
      setRedirecting(true);
      router.replace("/");
      router.refresh();
    } catch {
      setAuthError("We couldn’t complete sign-in. Please try again.");
      setRedirecting(false);
    }
  }

  return (
    <main className={styles.page}>
      <figure className={styles.editorial}>
        <Image src="/brand/studio.webp" alt="" fill priority unoptimized sizes="(max-width: 760px) 100vw, 53vw" className={styles.photograph} />
        <div className={styles.shade} />
        <Image src="/brand/ism-mark.png" alt="ISM Agency" width={536} height={277} priority unoptimized className={styles.logo} />
        <figcaption>
          <p className={styles.motto}>
            <span>Always</span>{" "}<em>On Time.</em>
          </p>
          <p className={styles.credit}>Anuradhapura, Sri Lanka</p>
        </figcaption>
      </figure>

      <section className={styles.panel} aria-labelledby="login-heading">
        <div className={styles.formColumn}>
          <header className={styles.header}>
            <p className={styles.product}>ISM Flow</p>
            <h1 id="login-heading" className={styles.heading}>Sign in<span>.</span></h1>
            <p className={styles.intro}>Enter your work email to access the agency workspace.</p>
          </header>

          <form
            className={styles.form}
            onSubmit={handleSubmit(signIn)}
            onChange={() => { if (authError) setAuthError(null); }}
            aria-busy={busy}
            noValidate
          >
            <div className={styles.field}>
              <label htmlFor="login-email">Email address</label>
              <input
                {...register("email")}
                id="login-email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@company.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                required
              />
              {errors.email && <p className={styles.error} id="email-error" role="alert">{errors.email.message}</p>}
            </div>

            <div className={styles.field}>
              <label htmlFor="login-password">Password</label>
              <div className={styles.passwordField}>
                <input
                  {...register("password")}
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  required
                />
                <button
                  className={styles.reveal}
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-controls="login-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
              {errors.password && <p className={styles.error} id="password-error" role="alert">{errors.password.message}</p>}
            </div>

            {authError && <p role="alert" className={styles.authError}>{authError}</p>}
            <button className={styles.submit} type="submit" disabled={busy}>
              <span>{busy ? "Signing in…" : "Sign in"}</span>
              <ArrowRight size={20} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </form>
          <p className={styles.help}>For password resets, contact your system administrator.</p>
        </div>
      </section>
    </main>
  );
}
