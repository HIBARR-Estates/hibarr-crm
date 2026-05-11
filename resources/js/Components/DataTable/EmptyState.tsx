import React from "react";
import type { EmptyStateConfig } from "./types";

// Hoisted outside the component — static JSX never needs to re-create (rendering-hoist-jsx)
const DefaultIllustration: React.FC = () => (
    <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        focusable="false"
    >
        <rect
            x="4"
            y="10"
            width="56"
            height="44"
            rx="4"
            fill="#F3F4F6"
            stroke="#D1D5DB"
            strokeWidth="1.5"
        />
        <rect
            x="4"
            y="10"
            width="56"
            height="13"
            rx="4"
            fill="#E5E7EB"
            stroke="#D1D5DB"
            strokeWidth="1.5"
        />
        <line x1="4" y1="34" x2="60" y2="34" stroke="#D1D5DB" strokeWidth="1" />
        <line x1="4" y1="45" x2="60" y2="45" stroke="#D1D5DB" strokeWidth="1" />
        <circle cx="32" cy="40" r="9" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1.5" />
        <path
            d="M28.5 40L31.5 43L36 37"
            stroke="#3B82F6"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

interface EmptyStateProps extends EmptyStateConfig {
    className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    title = "No results found",
    description = "There are no records to display.",
    icon,
    action,
    className = "",
}) => (
    <div
        role="status"
        aria-label={title}
        className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}
    >
        <div className="mb-4 text-gray-300">
            {icon !== undefined ? icon : <DefaultIllustration />}
        </div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
        {description !== "" && (
            <p className="text-sm text-gray-400 text-center max-w-xs">{description}</p>
        )}
        {action !== undefined ? <div className="mt-4">{action}</div> : null}
    </div>
);

export default EmptyState;
