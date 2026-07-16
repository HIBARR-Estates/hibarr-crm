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
    "file-text": (
        <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="16" y2="17" />
        </>
    ),
    "check-square": (
        <>
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </>
    ),
    video: (
        <>
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </>
    ),
    mail: (
        <>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
        </>
    ),
    phone: (
        <>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </>
    ),
    copy: (
        <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
    ),
    check: <polyline points="20 6 9 17 4 12" />,
    "external-link": (
        <>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </>
    ),
    "chevron-down": <polyline points="6 9 12 15 18 9" />,
    "chevron-up": <polyline points="18 15 12 9 6 15" />,
    "chevron-left": <polyline points="15 18 9 12 15 6" />,
    "chevron-right": <polyline points="9 18 15 12 9 6" />,
    paperclip: (
        <>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </>
    ),
    image: (
        <>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
        </>
    ),
    archive: (
        <>
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
        </>
    ),
    trash: (
        <>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </>
    ),
    layers: (
        <>
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
        </>
    ),
    plus: (
        <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
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
