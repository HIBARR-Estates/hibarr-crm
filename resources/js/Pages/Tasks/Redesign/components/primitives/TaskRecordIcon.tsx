import { BankOutlined } from "@ant-design/icons";
import { BriefcaseIcon, HouseDoorIcon, PersonIcon } from "@/Components/icons";
import type { RecordTypeKey } from "../../config/taskDesignTokens";

interface TaskRecordIconProps {
    type: RecordTypeKey;
    size?: number;
    color?: string;
}

/**
 * Icon for a linked record type, reusing the very components the sidebar
 * renders so a "Lead" here looks like "Leads" in the nav. These are 16×16
 * fill-based icons, unlike the stroked 24×24 glyphs used elsewhere, so they
 * take their colour from `currentColor` on the wrapper.
 */
export default function TaskRecordIcon({
    type,
    size = 15,
    color,
}: TaskRecordIconProps) {
    const icon = (() => {
        switch (type) {
            case "lead":
                return <PersonIcon width={size} height={size} />;
            case "deal":
                return <BriefcaseIcon width={size} height={size} />;
            case "property":
                return <HouseDoorIcon width={size} height={size} />;
            case "project":
                return <BankOutlined style={{ fontSize: size }} />;
            default:
                return null;
        }
    })();

    return (
        <span
            aria-hidden="true"
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color,
                lineHeight: 0,
            }}
        >
            {icon}
        </span>
    );
}
