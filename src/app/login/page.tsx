import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthArt, AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/security";

export const metadata = { title: "Log in" };

export default async function Page() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="auth-wrap">
      <AuthArt />
      <div className="auth-form-side"><Suspense><AuthForm mode="login" /></Suspense></div>
    </div>
  );
}
