import { ReactNode } from "react";

const ICON_PATHS: Record<string, ReactNode> = {
    calendar: (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </>
    ),
    refresh: (
        <>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </>
    ),
    users: (
        <>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
    ),
    home: (
        <>
            <path d="M3 9.5 12 3l9 6.5" />
            <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
        </>
    ),
    info: (
        <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </>
    ),
    award: (
        <>
            <circle cx="12" cy="8" r="5" />
            <polyline points="8 13 8 21 12 19 16 21 16 13" />
        </>
    ),
    building: (
        <>
            <rect x="4" y="3" width="16" height="18" rx="1.5" />
            <line x1="9" y1="8" x2="9" y2="8" />
            <line x1="12" y1="8" x2="12" y2="8" />
            <line x1="15" y1="8" x2="15" y2="8" />
            <line x1="9" y1="12" x2="9" y2="12" />
            <line x1="12" y1="12" x2="12" y2="12" />
            <line x1="15" y1="12" x2="15" y2="12" />
            <line x1="12" y1="21" x2="12" y2="17" />
        </>
    ),
    wallet: (
        <>
            <rect x="2" y="6" width="20" height="14" rx="2" />
            <path d="M16 11h6v4h-6a2 2 0 1 1 0-4z" />
        </>
    ),
    "map-pin": (
        <>
            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.5" />
        </>
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </>
    ),
    bank: (
        <>
            <polygon points="12 3 2 8 22 8 12 3" />
            <line x1="4" y1="8" x2="4" y2="18" />
            <line x1="10" y1="8" x2="10" y2="18" />
            <line x1="14" y1="8" x2="14" y2="18" />
            <line x1="20" y1="8" x2="20" y2="18" />
            <line x1="2" y1="21" x2="22" y2="21" />
        </>
    ),
    lifebuoy: (
        <>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" />
            <line x1="5.5" y1="5.5" x2="9" y2="9" />
            <line x1="15" y1="15" x2="18.5" y2="18.5" />
            <line x1="18.5" y1="5.5" x2="15" y2="9" />
            <line x1="9" y1="15" x2="5.5" y2="18.5" />
        </>
    ),
};

interface DealIconProps {
    name: keyof typeof ICON_PATHS | string;
    size?: number;
    color?: string;
    className?: string;
}

export default function DealIcon({
    name,
    size = 14,
    color = "currentColor",
    className,
}: DealIconProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
        >
            {ICON_PATHS[name] ?? ICON_PATHS.info}
        </svg>
    );
}
