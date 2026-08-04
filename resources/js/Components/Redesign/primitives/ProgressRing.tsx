import { REDESIGN_TOKENS as T } from "../tokens";

interface ProgressRingProps {
    done: number;
    total: number;
    size?: number;
    stroke?: number;
    color?: string;
    trackColor?: string;
    /** Rendered in the middle; defaults to `done/total`. */
    label?: string;
}

/**
 * Small donut progress indicator — used for "N of M answered" style counters
 * where a bar would be too wide for the space.
 */
export default function ProgressRing({
    done,
    total,
    size = 34,
    stroke = 3,
    color = T.BLUE,
    trackColor = "#ffffff66",
    label,
}: ProgressRingProps) {
    const safeTotal = Math.max(total, 1);
    const ratio = Math.min(Math.max(done / safeTotal, 0), 1);
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <span
            className="relative inline-flex shrink-0 items-center justify-center"
            style={{ width: size, height: size }}
            role="img"
            aria-label={`${done} of ${total}`}
        >
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={trackColor}
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - ratio)}
                    style={{ transition: "stroke-dashoffset 0.3s ease" }}
                />
            </svg>
            <span
                className="absolute inset-0 flex items-center justify-center"
                style={{ fontSize: size <= 30 ? 9 : 10, fontWeight: 700 }}
            >
                {label ?? `${done}/${total}`}
            </span>
        </span>
    );
}
