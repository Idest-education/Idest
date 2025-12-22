"use client";

import Image from "next/image";
import { Github, Linkedin, Mail } from "lucide-react";
import { Anton } from "next/font/google";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

export default function LandingRoot() {
  // NOTE: Video is served from the Next.js `public/` directory:
  // `public/assets/cat-peeps.webm` -> `/assets/cat-peeps.webm`
  const videoSrc = "/assets/cat-peeps.webm";

  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="h-screen overflow-hidden bg-[#0b0b0b] text-white">
      <div className="h-full w-full">
        <div className="relative w-full h-full bg-black overflow-hidden">
          {/* Video background - positioned where laptop would be (center-bottom) */}
          <video
            className="absolute inset-0 w-full h-full bg-black object-cover object-[center_85%]"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
          >
            <source src={videoSrc} type="video/webm" />
          </video>

          {/* Gradient originating from the video (laptop) area and spreading outward */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_800px_500px_at_50%_70%,rgba(255,107,53,0.25),rgba(255,107,53,0.15)_40%,transparent_70%)]" />

          <div className="relative z-20 h-full flex flex-col">
            {/* Top bar */}
            <header className="flex items-start justify-between px-6 pt-6 sm:px-10 sm:pt-9">
              <Image
                src={logo}
                alt="Idest"
                priority
                className="h-4 sm:h-5 w-auto opacity-80"
              />
              <div
                className={`${anton.className} text-white/80 text-xl sm:text-2xl font-bold`}
              >
                {currentTime}
              </div>
            </header>

            {/* Main headline - positioned higher up */}
            <div className="px-6 sm:px-10 pt-12 sm:pt-16 md:pt-20 flex flex-col items-center justify-start gap-6 sm:gap-8">
              <h1
                className={`${anton.className} font-bold mx-auto max-w-5xl text-center leading-[1.02] tracking-tight text-[#FF6B35] select-none text-[34px] sm:text-[54px] md:text-[68px] lg:text-[84px]`}
              >
                HỌC TIẾNG ANH CÙNG IDEST NHÉ?
              </h1>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mt-4">
                <a
                  href="/auth/login"
                  className={`${anton.className} font-bold px-8 py-4 bg-[#FF6B35] text-white rounded-lg hover:bg-[#FF7B45] transition-colors text-lg sm:text-xl shadow-lg`}
                >
                  ĐI HỌC LUÔN ĐÂY!
                </a>
                <a
                  href="/auth/sign-up"
                  className={`${anton.className} font-bold px-8 py-4 bg-transparent border-2 border-[#FF6B35] text-[#FF6B35] rounded-lg hover:bg-[#FF6B35]/10 transition-colors text-lg sm:text-xl`}
                >
                  Tớ chưa có tài khoản
                </a>
              </div>
            </div>
          </div>

          {/* Bottom right icons */}
          <div className="absolute z-20 right-6 bottom-6 sm:right-10 sm:bottom-9 flex flex-col items-center gap-4 text-white/70">
            <a
              href="https://www.linkedin.com/in/chihenhuynh/"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="hover:text-white transition-colors"
            >
              <Linkedin className="w-5 h-5" />
            </a>
            <a
              href="https://github.com/LuckiPhoenix"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="hover:text-white transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="mailto:huynhchihen2005@gmail.com"
              aria-label="Email"
              className="hover:text-white transition-colors"
            >
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}


