import Link from "next/link";
import type { ReactNode } from "react";

interface RouteButtonProps {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}

const variants = {
  primary:
    "border-blue-400 bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400",
  secondary:
    "border-emerald-500/60 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
  ghost:
    "border-slate-700 bg-slate-950/60 text-slate-200 hover:border-slate-500 hover:bg-slate-900",
};

export default function RouteButton({
  href,
  children,
  icon,
  variant = "primary",
  className = "",
}: RouteButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition duration-200 ${variants[variant]} ${className}`}
    >
      {icon}
      {children}
    </Link>
  );
}
