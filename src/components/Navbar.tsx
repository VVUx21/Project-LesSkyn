"use client";
import React, { useState } from "react";

import Link from "next/link";

import Mobilenavbar from "./mobilenavbar";
import { Ellipsis, HamIcon, XIcon } from "lucide-react";
import Image from "next/image";

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            <nav
                className="w-[90%] md:w-[70%] lg:w-[70%] backdrop-blur-xl bg-[#F9FAFB40] font-Cattedrale fixed top-12 lg:top-7 rounded-2xl shadow-lg"
                style={{
                    zIndex: 9999999,
                }}
            >
                <div className="mx-auto px-5 md:px-12 sm:max-w-full ">
                    <div className="h-14 w-full items-center grid">
                        <div className="hidden md:block min-w-full">
                            <div className="flex items-center gap-2 w-full">
                                <Link href="/">
                                    <Image
                                        src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755003537/Group_6_n0fihn.png"
                                        alt="Top Image"
                                        width={30}
                                        height={30}
                                        className=""
                                    />
                                </Link>
                                <h1
                                className="text-[#2C264C] text-2xl font-bold tracking-wide"
                                >
                                  LesSkyn
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center justify-between h-full w-full md:hidden">
                            <Image
                                src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755003537/Group_6_n0fihn.png"
                                alt="Top Image"
                                width={30}
                                height={30}
                                className=""
                            />
                            <button
                                onClick={() => {
                                    setIsMenuOpen(!isMenuOpen);
                                }}
                                className="text-white"
                            >
                                {!isMenuOpen ? <Ellipsis /> : <XIcon />}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <Mobilenavbar
                isMenuOpen={isMenuOpen}
                setIsMenuOpen={setIsMenuOpen}
            />
        </>
    );
};

export default Navbar;