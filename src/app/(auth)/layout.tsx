import React from "react";
import Image from "next/image";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="relative flex flex-col items-center bg-gradient-to-br from-[#BD81D9] to-[#776CDC] justify-center min-h-screen overflow-hidden">
      {/* Decorative background shape - positioned to stay within bounds */}
      <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 transform translate-x-24 -translate-y-24" />
      
      {/* Content wrapper with proper z-index */}
      <div className="relative z-10 w-full max-w-4xl px-4">
        {children}
      </div>
      
      {/* Background image - positioned to stay within bounds */}
      <Image
        src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755127425/skin-care-product-illustration-download-in-svg-png-gif-file-formats--natural-herbal-cosmetic-pack-beauty-illustrations-7974580_1_wbhirp.png"
        alt="Onboarding Background"
        className="absolute bottom-0 left-0 z-0 opacity-80"
        width={400}
        height={400}
      />
    </main>
  );
}