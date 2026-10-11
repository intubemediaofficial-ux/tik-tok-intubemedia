import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthArt, AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/security";

export const metadata = { title: "Sign up" };

export default async function Page() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="auth-wrap">
      <AuthArt />
      <div className="auth-form-side"><Suspense><AuthForm mode="signup" /></Suspense></div>
    </div>
  );
}
