import type { Role, UserStatus } from "@/generated/prisma";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      status: UserStatus;
      agency: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    status: UserStatus;
    agency: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: UserStatus;
    agency: string;
  }
}
