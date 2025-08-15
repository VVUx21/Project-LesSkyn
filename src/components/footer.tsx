"use client";
import Image from "next/image";
import Link from "next/link";

import { Mail, Facebook, Instagram, Twitter, Linkedin,ArrowRightIcon } from "lucide-react";

export default function Contact() {
  // Scroll to specific section
  const handleClick = ( e: React.MouseEvent<HTMLAnchorElement>,
  href: string) => {
    e.preventDefault();
    if (href) {
      const targetElement = document.getElementById(href);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth" });
      }
    }
  };
  return (
    <>
      {/* Footer Section */}
      <footer className="bg-[#3A36E587] text-[#2C264C] py-4 mt-16 w-full rounded-t-3xl">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center my-5 px-6 ">
          {/* Conference Details */}
          <div className="flex flex-col items-center ml-36 md:items-start text-center md:text-left mb-6">
            <Image
              src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755003537/Group_6_n0fihn.png"
              alt="CVMI-2025 Logo"
              width={150}
              height={150}
            />
            <h2 className="text-4xl font-bold text-[#FBFAFF] mt-4 ml-5">LesSkyn</h2>
          </div>

          {/* Navigation Menu */}
        <div className="site mr-[19px] sm:mr-[26px] md:mr-[80px] 2xl:mr-[268px]">
        <h1 className='font-archivoBlack font-normal text-[16px] sm:text-[25px] 2xl:text-[32px]'>Site map</h1>
        <ul className='mt-5'>
          {
            ['Sign-in','Sign-up','scrape_products'].map((item, index) => {
                return <li key={index} className='text-[12px] sm:text-[20px]  hover:scale-105 2xl:text-[25px] font-archivo font-semibold mb-2 flex items-center gap-3'>
                   <a href={`/${item}`}>{item}</a>
                  <ArrowRightIcon
                    className='sm:w-[18px] w-2 h-2'
                    aria-label="icon"
                  />
                </li>
                })
          }
        </ul>
        </div>
        </div>
        <div className="w-[98%] h-0.5 bg-gray-700 mx-4 mt-2"></div>

        {/* Footer Bottom */}
          <div className="flex flex-col md:flex-row justify-center items-center mt-4 px-4 mx-auto">
            <ul className="flex space-x-4 mt-4">
            {[
              {
                icon: Twitter,
                name: "Twitter",
                url: "#",
              },
              {
                icon: Instagram,
                name: "Instagram",
                url: "#",
              },
              {
                icon: Facebook,
                name: "Facebook",
                url: "#",
              },
              {
                icon: Linkedin ,
                name: "Linkedin",
                url: "#",
              },
            ].map((social) => (
              <li key={social.name}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center group"
                >
                  <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                    <social.icon className="w-6 h-6 text-white"  />
                  </div>
                </a>
              </li>
            ))}
          </ul>
          </div>
      </footer>
      </>
  );
}