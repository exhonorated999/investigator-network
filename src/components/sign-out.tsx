import { signOutAction } from "@/app/(auth)/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="btn btn-ghost btn-sm"
      >
        Sign out
      </button>
    </form>
  );
}
