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
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    status: UserStatus;
    agency: string;
    audience: Audience;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: UserStatus;
    agency: string;
    audience: Audience;
  }
}
