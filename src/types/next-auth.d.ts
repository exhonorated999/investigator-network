import type { Role, UserStatus, Audience } from "@/generated/prisma";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      status: UserStatus;
      agency: string;
      audience: Audience;
      /// Current password is a temporary credential the user did not choose.
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    status: UserStatus;
    agency: string;
    audience: Audience;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: UserStatus;
    agency: string;
    audience: Audience;
    mustChangePassword: boolean;
  }
}
