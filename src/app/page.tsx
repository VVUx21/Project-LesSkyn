import Image from 'next/image';
import Navbar from '@/components/Navbar';
import AboutUs from '@/components/AboutUs';
import { ChevronRight } from 'lucide-react';
import Contact from '@/components/footer';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="relative flex flex-col min-h-screen w-full items-center justify-center overflow-hidden  bg-gradient-to-br from-[#7772E7] via-[#9A68EB] to-[#D881F5F5] p-4 sm:p-6 md:p-0">
      <Navbar />
      {/* Decorative background shape */}
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10" />

      {/* Main Content Grid */}
      <div className="z-10 grid w-full max-w-7xl mt-20 grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
        
        {/* Left Column: Text Content & CTA */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <h1 className="text-4xl font-bold text-[#2C264C] sm:text-5xl md:text-6xl">
            Unlock Your Healthiest Skin— <br /> With Confidence
          </h1>
          <p className="mt-4 max-w-lg text-lg text-[#2C264C] md:text-xl">
            LesSkyn decodes skincare for you—personalized routines, real reviews, and expert guidance, all in one place.
          </p>
          <Link href="/onboarding">
            <button className="mt-8 cursor-pointer flex items-center justify-center gap-3 rounded-lg bg-[#443DFF] py-3 px-6 text-base font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
              TAKE YOUR SKIN QUIZ
              <svg
                xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          </Link>
        </div>

        {/* Right Column: Illustration */}
        <div className="flex items-center justify-center">
          <Image
            src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755002562/a1eea312cc7afd3fbbf90557ebb70ade153ec231_bufwj8.png" // Make sure this image is in your /public folder
            alt="Woman applying skincare products surrounded by flowers and leaves"
            width={900}
            height={900}
            priority // Load this image first as it's critical for the LCP
            className="h-auto mt-16 w-full max-w-sm md:max-w-md lg:max-w-full"
          />
        </div>
      </div>
      <AboutUs />
      <div className="flex flex-row justify-start mt-16 ml-44 w-full">
        <div className="bg-white/95 backdrop-blur-md min-w-2xl rounded-3xl p-8 md:p-12 shadow-2xl hover:shadow-3xl transition-all duration-500">
          <div className="text-center">
                  {/* Content Section */}
            <div className="space-y-6 order-2 lg:order-1">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 leading-tight">
                Your Dashboard
              </h1>
                    
            <p className="text-lg mx-auto text-gray-600 leading-relaxed max-w-md">
              Track your skincare progress, build healthy habits, and see your results all in one place.
            </p>
                    
            <button className="group mx-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold flex items-center gap-3 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
              VIEW DASHBOARD
            <div className="bg-orange-500 rounded-full p-1">
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </button>
        </div>
        </div>
      </div>
      <Image
          src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755006737/man-applying-cream-on-face-for-facial-skin-treatment-concept-illustration-vector_1_mirhoh.png"
          alt="Decorative Background"
          height={400}
          width={400}
          className={`relative z-10 -ml-32 -bottom-6`}
      />
      </div>
      <div className="flex flex-row justify-end mr-44 mt-16 w-full">
        <Image
            src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755010558/skin-care-and-treatment-5508417-4583564_1_ccyijz.png"
            alt="Decorative Background"
            height={400}
            width={400}
            className='relative z-10 -bottom-3 -mr-32'
          />
        <div className="bg-white/95 backdrop-blur-md min-w-2xl rounded-3xl p-8 md:p-12 shadow-2xl hover:shadow-3xl transition-all duration-500">
          <div className="text-center">
            {/* Content Section */}
            <div className="space-y-6 order-2 lg:order-1">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 leading-tight">
                Your Community
              </h1>
              
              <p className="text-lg mx-auto text-gray-600 leading-relaxed max-w-md">
                Connect with real people, share experiences, and get honest advice. Find routines, reviews, and support from everyone on their skin journey—just like you.
              </p>
              
              <button className="group mx-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold flex items-center gap-3 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
               JOIN NOW
                <div className="bg-orange-500 rounded-full p-1">
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-row justify-start mt-16 ml-44 w-full">
        <div className="bg-white/95 backdrop-blur-md min-w-2xl rounded-3xl p-8 md:p-12 shadow-2xl hover:shadow-3xl transition-all duration-500">
          <div className="text-center">
            {/* Content Section */}
            <div className="space-y-6 order-2 lg:order-1">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 leading-tight">
                Your Skin
              </h1>
              <p className="text-lg mx-auto text-gray-600 leading-relaxed max-w-md">
               Know about your skin type ,skin concerns and where your skin need to improve.
              </p>
              <button className="group mx-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold flex items-center gap-3 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                  SKIN PORTFOLIO
                <div className="bg-orange-500 rounded-full p-1">
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </button>      
            </div>
          </div>
        </div>
              <Image
                  src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755010600/facial-skin-treatment-8395272-6715534_1_liuhsm.png"
                  alt="Decorative Background"
                  height={400}
                  width={400}
                  className={`relative z-10 -ml-32 -bottom-12`}
              />
          </div>
      <div className="flex flex-row justify-end mr-44 mt-16 w-full">
        <Image
            src="https://res.cloudinary.com/dgtdkqfsx/image/upload/v1755010617/natural-skin-care-illustration-download-in-svg-png-gif-file-formats--product-herbal-cosmetic-pack-beauty-illustrations-7974588_1_r67hfz.png"
            alt="Decorative Background"
            height={500}
            width={500}
            className='relative z-10 -bottom-14 -mr-32'
          />
        <div className="bg-white/95 backdrop-blur-md min-w-2xl rounded-3xl p-8 md:p-12 shadow-2xl hover:shadow-3xl transition-all duration-500">
          <div className="text-center">
            {/* Content Section */}
            <div className="space-y-6 order-2 lg:order-1">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 leading-tight">
                Know Your Product
              </h1>
              
              <p className="text-lg mx-auto text-gray-600 leading-relaxed max-w-md">
                Personalized product recommendations based on your skin type and concerns. Get the best products tailored just for you.
              </p>
              
              <button className="group mx-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold flex items-center gap-3 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                CHECK NOW
                <div className="bg-orange-500 rounded-full p-1">
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
      <Contact />
    </main>
  );
}