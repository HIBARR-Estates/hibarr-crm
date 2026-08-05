import EditableFieldBase from "@/Components/EditableField";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof EditableFieldBase>;

/** Single-click activate wrapper around the shared EditableField. */
export default function EditableField(props: Props) {
    return <EditableFieldBase {...props} activateOnSingleClick />;
}
