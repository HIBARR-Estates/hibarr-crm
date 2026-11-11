import React from "react";
import { Link } from "@inertiajs/react";
import { ExternalLink, Phone } from "lucide-react";
import { initialsOf } from "../utils";

interface CallIdentityProps {
    name: string;
    peer: string;
    leadUrl?: string | null;
    children?: React.ReactNode;
}

/**
 * Caller identity header (Avatar with initials or icon, Lead name link, peer phone number).
 */
export default function CallIdentity({
    name,
    peer,
    leadUrl,
    children,
}: CallIdentityProps) {
    const hasLink = Boolean(leadUrl && name.trim());

    return (
        <>
            <div className="sp__avatar" aria-hidden="true">
                {name?.trim() ? initialsOf(name, peer) : <Phone size={28} strokeWidth={1.8} />}
            </div>
            {name?.trim() ? (
                <h2 className="sp__name">
                    {hasLink && leadUrl ? (
                        <Link
                            href={leadUrl}
                            className="sp__name-link"
                            title="Open this lead — the call keeps running"
                        >
                            {name}
                            <ExternalLink className="sp__name-open" aria-hidden="true" />
                        </Link>
                    ) : (
                        name
                    )}
                </h2>
            ) : null}
            <p className="sp__number">{peer}</p>
            {children}
        </>
    );
}
