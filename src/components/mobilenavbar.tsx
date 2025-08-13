import Link from "next/link";
import React from "react";

const Mobilenavbar = ({
    isMenuOpen,
    setIsMenuOpen,
}: {
    isMenuOpen: boolean;
    setIsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
    const closeNavbar = () => {
        setIsMenuOpen(false);
    };

    return (
        <>
            <div
                className={`fixed inset-0 z-50 md:hidden bg-black transition-opacity duration-300 ${
                    isMenuOpen
                        ? "opacity-100 "
                        : "opacity-0 pointer-events-none"
                }`}
                style={{
                    zIndex: 999999,
                }}
            >
                <div className="flex items-center justify-center h-full relative">
                    <nav className="w-full">
                        <ul className="flex flex-col items-center justify-center gap-8 font-Cattedrale tracking-wider">
                            <li key="about us" className="text-center">
                                <Link
                                    href={"#about-us"}
                                    onClick={closeNavbar}
                                    className="block px-4 py-2 text-2xl text-white transition duration-300 hover:text-[#CBFFFF]"
                                >
                                    About Us
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href={"/events"}
                                    onClick={closeNavbar}
                                    className="block px-4 py-2 text-2xl text-white transition duration-300 hover:text-[#CBFFFF]"
                                >
                                    Events
                                </Link>
                            </li>

                            {["Sponsors", "FAQs", "Contact Us"].map(
                                (section, index) => (
                                    <li key={index} className="text-center">
                                        <Link
                                            href={
                                                `#${section
                                                    .toLowerCase()
                                                    .replace(" ", "-")}` ||
                                                `/${section
                                                    .toLowerCase()
                                                    .replace(" ", "-")}`
                                            }
                                            onClick={closeNavbar}
                                            className="block px-4 py-2 text-2xl text-white transition duration-300 hover:text-[#CBFFFF]"
                                        >
                                            {section}
                                        </Link>
                                    </li>
                                )
                            )}
                        </ul>
                    </nav>
                </div>
            </div>
        </>
    );
};

export default Mobilenavbar;