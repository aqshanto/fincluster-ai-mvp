import Image from "next/image";

type VisualTone = "blue" | "cyan" | "amber" | "violet" | "emerald";

interface LandingVisualProps {
  src: string;
  alt: string;
  label: string;
  caption?: string;
  priority?: boolean;
  tone?: VisualTone;
  className?: string;
  aspectClassName?: string;
}

const toneStyles: Record<
  VisualTone,
  {
    lineLeft: string;
    lineRight: string;
    badge: string;
    glow: string;
  }
> = {
  blue: {
    lineLeft: "from-transparent to-blue-500/50",
    lineRight: "from-blue-500/50 to-transparent",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    glow: "bg-blue-500/10",
  },
  cyan: {
    lineLeft: "from-transparent to-cyan-500/50",
    lineRight: "from-cyan-500/50 to-transparent",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    glow: "bg-cyan-500/10",
  },
  amber: {
    lineLeft: "from-transparent to-amber-500/50",
    lineRight: "from-amber-500/50 to-transparent",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    glow: "bg-amber-500/10",
  },
  violet: {
    lineLeft: "from-transparent to-violet-500/50",
    lineRight: "from-violet-500/50 to-transparent",
    badge: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    glow: "bg-violet-500/10",
  },
  emerald: {
    lineLeft: "from-transparent to-emerald-500/50",
    lineRight: "from-emerald-500/50 to-transparent",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    glow: "bg-emerald-500/10",
  },
};

export default function LandingVisual({
  src,
  alt,
  label,
  caption,
  priority = false,
  tone = "blue",
  className = "",
  aspectClassName = "aspect-video",
}: LandingVisualProps) {
  const styles = toneStyles[tone];

  return (
    <figure className={`w-full ${className}`}>
      {/* The visual label is placed immediately above the image here. */}
      <div className="mb-5 flex items-center gap-3">
        <span
          className={`h-px flex-1 bg-linear-to-r ${styles.lineLeft}`}
          aria-hidden="true"
        />

        <span
          className={`rounded-full border px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] sm:text-xs ${styles.badge}`}
        >
          {label}
        </span>

        <span
          className={`h-px flex-1 bg-linear-to-r ${styles.lineRight}`}
          aria-hidden="true"
        />
      </div>

      <div className="group relative">
        <div
          className={`pointer-events-none absolute -inset-5 rounded-4xl blur-3xl ${styles.glow}`}
          aria-hidden="true"
        />

        <div
          className={`relative ${aspectClassName} w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-[#020817] shadow-[0_24px_80px_rgba(2,8,23,0.7)] sm:rounded-3xl`}
        >
          <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl ring-1 ring-inset ring-white/5 sm:rounded-3xl" />

          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            quality={95}
            sizes="(max-width: 640px) 96vw, (max-width: 1024px) 92vw, 1280px"
            className="object-contain transition-transform duration-500 group-hover:scale-[1.005]"
          />
        </div>
      </div>

      {caption && (
        <figcaption className="mx-auto mt-4 max-w-4xl text-center text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
