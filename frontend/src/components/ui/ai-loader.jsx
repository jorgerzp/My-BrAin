import * as React from "react";

export const Component = ({ size = 180, text = "Generating", isExiting = false }) => {
  const letters = text.split("");

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#fafafa]/85 via-[#f5f5f7]/85 to-[#e5e5e7]/85 dark:from-[#0f172a]/90 dark:via-[#090d16]/90 dark:to-black/95 backdrop-blur-md transition-all duration-500 ease-in-out ${
      isExiting ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
    }`}>
      <div
        className="relative flex items-center justify-center font-sans select-none"
        style={{ width: size, height: size }}
      >
        <div className="flex gap-[2px]">
          {letters.map((letter, index) => (
            <span
              key={index}
              className="inline-block text-[#1d1d1f] dark:text-white opacity-40 animate-loaderLetter font-semibold text-lg"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              {letter === " " ? "\u00A0" : letter}
            </span>
          ))}
        </div>

        <div className="absolute inset-0 rounded-full animate-loaderCircle"></div>
      </div>

      <style>{`
        @keyframes loaderCircle {
          0% {
            transform: rotate(90deg);
            box-shadow:
              0 6px 12px 0 #38bdf8 inset,
              0 12px 18px 0 #0071e3 inset,
              0 36px 36px 0 #1e40af inset,
              0 0 3px 1.2px rgba(56, 189, 248, 0.3),
              0 0 6px 1.8px rgba(0, 93, 255, 0.2);
          }
          50% {
            transform: rotate(270deg);
            box-shadow:
              0 6px 12px 0 #60a5fa inset,
              0 12px 6px 0 #0284c7 inset,
              0 24px 36px 0 #0071e3 inset,
              0 0 3px 1.2px rgba(56, 189, 248, 0.3),
              0 0 6px 1.8px rgba(0, 93, 255, 0.2);
          }
          100% {
            transform: rotate(450deg);
            box-shadow:
              0 6px 12px 0 #4dc8fd inset,
              0 12px 18px 0 #0071e3 inset,
              0 36px 36px 0 #1e40af inset,
              0 0 3px 1.2px rgba(56, 189, 248, 0.3),
              0 0 6px 1.8px rgba(0, 93, 255, 0.2);
          }
        }

        @keyframes loaderLetter {
          0%,
          100% {
            opacity: 0.35;
            transform: translateY(0);
          }
          20% {
            opacity: 1;
            transform: scale(1.18) translateY(-3px);
            color: #0071e3;
          }
          40% {
            opacity: 0.65;
            transform: translateY(0);
          }
        }

        .animate-loaderCircle {
          animation: loaderCircle 4s linear infinite;
        }

        .animate-loaderLetter {
          animation: loaderLetter 2.5s infinite;
        }

        /* Dark mode shadows overlay */
        @media (prefers-color-scheme: dark) {
          .animate-loaderCircle {
            box-shadow:
              0 6px 12px 0 #3b82f6 inset,
              0 12px 18px 0 #60a5fa inset,
              0 36px 36px 0 #1e3a8a inset,
              0 0 3px 1.2px rgba(59, 130, 246, 0.3),
              0 0 6px 1.8px rgba(96, 165, 250, 0.2);
          }
        }
      `}</style>
    </div>
  );
};

export default Component;
