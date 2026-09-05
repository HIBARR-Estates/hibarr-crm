import Avatar from "./Avatar";
import { initialsFromName } from "../adapters/initials";
import { REDESIGN_TOKENS as T } from "../tokens";

export interface AvatarStackPerson {
    id: number | string;
    name?: string | null;
    image?: string | null;
    /** Palette for this face — see Avatar. Defaults to the blue "default". */
    type?: "agent" | "participant" | "watcher" | "default";
}

interface AvatarStackProps {
    people: AvatarStackPerson[];
    size?: number;
    /** Faces shown before the rest collapse into a "+N" chip. */
    max?: number;
}

/**
 * Overlapping row of faces with a "+N" overflow chip — the redesign's own
 * stack, so it carries redesign tokens and the white separator ring rather
 * than antd's avatar group.
 */
export default function AvatarStack({
    people,
    size = 26,
    max = 4,
}: AvatarStackProps) {
    if (people.length === 0) return null;

    const shown = people.slice(0, max);
    const overflow = people.length - shown.length;

    return (
        <span className="inline-flex items-center">
            {shown.map((person, index) => (
                <span
                    key={person.id}
                    className="inline-flex rounded-full"
                    style={{
                        marginLeft: index ? -8 : 0,
                        boxShadow: `0 0 0 2px ${T.WHITE}`,
                    }}
                >
                    <Avatar
                        initials={initialsFromName(person.name)}
                        type={person.type ?? "default"}
                        src={person.image}
                        size={size}
                        title={person.name ?? undefined}
                    />
                </span>
            ))}
            {overflow > 0 && (
                <span
                    className="inline-flex items-center justify-center rounded-full font-bold"
                    style={{
                        marginLeft: -8,
                        width: size,
                        height: size,
                        fontSize: 11,
                        background: T.NAVY_SOFT,
                        color: T.NAVY,
                        boxShadow: `0 0 0 2px ${T.WHITE}`,
                    }}
                >
                    +{overflow}
                </span>
            )}
        </span>
    );
}
