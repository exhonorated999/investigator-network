import type { Metadata } from "next";
import { Orbitron, Rajdhani, JetBrains_Mono } from "next/font/google";
import { auth } from "@/auth";
import { PresenceBeacon } from "@/components/presence-beacon";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Investigator Network — Training Platform",
  description:
    "Investigator Network: professional investigator training, courses, and certification.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Only signed-in users emit heartbeats, so logged-out visitors on the login
  // and marketing pages don't generate pointless traffic.
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${orbitron.variable} ${rajdhani.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script
          // Apply saved theme before paint so there is no light/dark flash.
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {signedIn ? <PresenceBeacon /> : null}
        {children}
      </body>
    </html>
  );
}
