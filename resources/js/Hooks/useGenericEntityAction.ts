import { TGenericEntityAction } from "@/Types/common";
import { useState } from "react";

export const useGenericEntityAction = <T>(
    defaultAction?: TGenericEntityAction,
) => {
    const [action, setAction] = useState<TGenericEntityAction | undefined>(
        defaultAction,
    );
    const [selected, setSelected] = useState<T>();

    const handleAction = (action: TGenericEntityAction, selected?: T) => {
        setAction(action);
        setSelected(selected);
    };

    const handleClose = (action?: TGenericEntityAction) => {
        setSelected(undefined);
        setAction(action);
    };

    return {
        action,
        selected,
        setSelected,
        handleAction,
        handleClose,
    };
};
