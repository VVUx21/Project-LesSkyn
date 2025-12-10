import React from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/server/users.actions";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getLoggedInUser();
  if (user) {
    redirect("/");
  }
  return (
    <main className="relative flex flex-col items-center bg-gradient-to-br from-[#BD81D9] to-[#776CDC] justify-center min-h-screen overflow-hidden">
      <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 transform translate-x-24 -translate-y-24" />
      
      <div className="relative z-10 w-full max-w-4xl px-4">
        {children}
      </div>
      
      <Image
        src="https://res.cloudinary.com/dzieihe1s/image/upload/v1765351588/skin-care-product-illustration-download-in-svg-png-gif-file-formats--natural-herbal-cosmetic-pack-beauty-illustrations-7974580_1_py2idj.png"
        alt="Onboarding Background"
        className="absolute bottom-0 left-0 z-0 opacity-80"
        width={400}
        height={400}
      />
    </main>
  );
}