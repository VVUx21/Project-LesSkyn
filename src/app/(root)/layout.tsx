import { getLoggedInUser } from "@/lib/server/users.actions";
import { redirect } from "next/navigation";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user1 = await getLoggedInUser();
  if (!user1) redirect("/Sign-in");
  return (
    <main className="flex h-screen w-full font-inter">
      <div className="flex size-full flex-col ">
          {children}
      </div>
    </main>
  );
}