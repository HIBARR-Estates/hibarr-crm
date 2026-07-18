import EditableField from "@/Components/EditableField";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof EditableField>;

/** v2.2's click-to-edit pattern (deal-v2-2.jsx:778-874) — single click,
 * dashed underline + pencil-on-hover — for every field in the Deal info
 * tab. Wraps the shared EditableField (used app-wide) rather than forking
 * it, opting into `activateOnSingleClick` so other pages keep their
 * existing double-click behavior. */
export default function DealEditableField(props: Props) {
    return <EditableField {...props} activateOnSingleClick />;
}
