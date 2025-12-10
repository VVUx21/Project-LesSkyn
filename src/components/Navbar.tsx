"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Mobilenavbar from "./mobilenavbar";
import { Ellipsis, XIcon } from "lucide-react";
import Image from "next/image";

// shadcn dropdown components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// auth helpers (adjust import paths)
import { getLoggedInUser, logoutAccount } from "@/lib/server/users.actions";

interface User {
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const loggedInUser = await getLoggedInUser();
        setUser(loggedInUser);
      } catch (err) {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  return (
    <>
      <nav
        className="w-[90%] md:w-[70%] lg:w-[70%] backdrop-blur-xl bg-[#F9FAFB40] font-Cattedrale fixed top-12 lg:top-7 rounded-2xl shadow-lg"
        style={{ zIndex: 9999999 }}
      >
        <div className="mx-auto px-5 md:px-12 sm:max-w-full">
          <div className="h-14 w-full items-center grid">
            {/* Desktop Navbar */}
            <div className="hidden md:flex justify-between items-center min-w-full">
              {/* Left: Logo */}
              <div className="flex items-center gap-2">
                <Link href="/">
                  <Image
                    src="https://res.cloudinary.com/dzieihe1s/image/upload/v1765351041/Group_27_tzjtss.png"
                    alt="Top Image"
                    width={30}
                    height={30}
                  />
                </Link>
                <h1 className="text-[#2C264C] text-2xl font-bold tracking-wide">
                  LesSkyn
                </h1>
              </div>

              {/* Right: Auth / User dropdown */}
              <div className="flex items-center gap-4">
                {!user ? (
                  <Link
                    href="/Sign-up"
                    className="px-4 py-2 rounded-lg bg-[#2C264C] text-white font-semibold hover:bg-[#403b63] transition"
                  >
                    Sign Up
                  </Link>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-[#2C264C] text-white font-semibold hover:opacity-90 transition"
                      >
                        {user.firstName.charAt(0)}
                        {user.lastName.charAt(0)}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-44" align="end">
                      <DropdownMenuLabel>
                        {user.firstName} {user.lastName}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile">Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings">Settings</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={logoutAccount}
                        className="text-red-600 focus:text-red-700 cursor-pointer"
                      >
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Mobile Navbar */}
            <div className="flex items-center justify-between h-full w-full md:hidden">
              <Image
                src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755003537/Group_6_n0fihn.png"
                alt="Top Image"
                width={30}
                height={30}
              />
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-[#2C264C]"
              >
                {!isMenuOpen ? <Ellipsis /> : <XIcon />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <Mobilenavbar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
    </>
  );
};

export default Navbar;
