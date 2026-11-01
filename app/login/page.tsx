import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-serif text-5xl font-semibold tracking-tight">Closet</h1>
        <p className="mt-2 text-center text-muted-foreground">Your wardrobe, styled.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
