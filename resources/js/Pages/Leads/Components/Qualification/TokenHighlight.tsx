import React from "react";
import { QualificationToken } from "@/Types/qualification";
import { splitTokenParts } from "./qualificationUtils";

interface TokenHighlightProps {
    text: string;
    tokenMap: Record<QualificationToken, string>;
    className?: string;
}

const TokenHighlight: React.FC<TokenHighlightProps> = ({
    text,
    tokenMap,
    className = "",
}) => {
    const parts = splitTokenParts(text);

    return (
        <span className={className}>
            {parts.map((part, index) => {
                if (part.type === "token" && part.token) {
                    const resolved = (tokenMap[part.token] || "").trim();
                    // Missing data: omit the token entirely (do not render placeholder)
                    if (!resolved) {
                        return null;
                    }
                    return (
                        <mark
                            key={`${part.token}-${index}`}
                            className="bg-amber-100 text-amber-900 px-1 rounded font-semibold not-italic"
                            title={part.token}
                        >
                            {resolved}
                        </mark>
                    );
                }
                return <span key={`text-${index}`}>{part.value}</span>;
            })}
        </span>
    );
};

export default TokenHighlight;
