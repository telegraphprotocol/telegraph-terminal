export function KrakenLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 32"
      fill="none"
      className={className}
      aria-label="Kraken"
      role="img"
    >
      {/* Octopus icon — always purple */}
      <ellipse cx="11" cy="11.5" rx="7" ry="7" fill="#5741D9" />
      <circle cx="8.4" cy="10.5" r="1.15" fill="white" />
      <circle cx="13.6" cy="10.5" r="1.15" fill="white" />
      <circle cx="8.7" cy="10.7" r="0.5" fill="#5741D9" />
      <circle cx="13.9" cy="10.7" r="0.5" fill="#5741D9" />
      {/* Tentacles */}
      <path d="M5.5 17.5 Q4 21.5 5.5 25 Q7 27.5 6.5 25.5 Q5.5 22.5 7 18.5" fill="#5741D9" />
      <path d="M8 19 Q7.5 23.5 9 26.5 Q10.5 29 10 27 Q8.5 24 10 20" fill="#5741D9" />
      <path d="M11 19.5 Q10.5 24.5 12 27.5 Q13.5 30 13 27.5 Q11.5 25 13 20" fill="#5741D9" />
      <path d="M14 19 Q15 23.5 16.5 26 Q18 28 17.5 26 Q16 23 16.5 19.5" fill="#5741D9" />
      <path d="M16.5 17.5 Q18.5 21.5 18 25 Q17.5 27 18.5 25.5 Q19.5 22 18 18" fill="#5741D9" />
      {/* Wordmark — inherits currentColor so it flips with theme */}
      <text
        x="25"
        y="20.5"
        fontFamily="Inter, Helvetica Neue, Helvetica, Arial, sans-serif"
        fontWeight="700"
        fontSize="16"
        fill="currentColor"
        letterSpacing="-0.4"
      >
        kraken
      </text>
    </svg>
  );
}
