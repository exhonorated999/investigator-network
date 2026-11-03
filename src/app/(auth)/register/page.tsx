import { connection } from "next/server";
import { RegisterForm } from "./register-form";
import { turnstileSiteKey } from "@/lib/turnstile";

export default async function RegisterPage() {
  // Read the site key per request. It is not a NEXT_PUBLIC_ variable, so a
  // Railway variable change is picked up on the next request after deploy
  // without being frozen into the client bundle at build time.
  await connection();
  return <RegisterForm turnstileSiteKey={turnstileSiteKey()} />;
}
