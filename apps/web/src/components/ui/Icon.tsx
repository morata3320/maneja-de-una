import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  calendar: "M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16",
  clock: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  users:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m20 0v-3a4 4 0 0 0-3-4M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm5-3a4 4 0 0 1 0 8",
  gear: "M6 3v18M6 8h12V3m0 5v13M3 3h6m6 0h6M3 21h6m6 0h6",
  fuel: "M4 21V3h10v18M4 9h10m0 5h3v4a2 2 0 0 0 4 0V9l-3-3M2 21h14",
  star: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1Z",
  compare: "M5 21V10m7 11V3m7 18v-7M2 7h6m1-7h6m1 11h6",
  close: "m6 6 12 12M6 18 18 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  check: "m5 12 4 4L19 6",
  shield: "m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Zm-4 10 3 3 5-6",
  car: "m3 10 3-7h12l3 7v9h-3v-3H6v3H3Zm0 0h18M6 13h2m8 0h2",
  filter: "M4 7h16M4 17h16M8 4v6m8 4v6",
  bag: "M4 7h16v14H4Zm4 0V3h8v4",
  grid: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
  chart: "M4 3v18h18M8 16l4-5 4 2 5-8",
  bell: "M18 8a6 6 0 0 0-12 0c0 8-3 8-3 9h18c0-1-3-1-3-9M9 21h6",
  settings:
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  plus: "M12 5v14M5 12h14",
  edit: "m4 16 12-12 4 4L8 20H4Zm10-10 4 4",
  support: "M3 14v-3a9 9 0 0 1 18 0v3M3 12h4v7H3Zm14 0h4v7h-4m0 7h-5",
  logout: "M9 4H3v16h6m6-12 4 4-4 4M8 12h12",
  mail: "M3 5h18v14H3Zm0 0 9 8 9-8",
  chevron: "m9 5 7 7-7 7",
  info: "M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
};
export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.car} />
    </svg>
  );
}
