import { RowSelectionType } from "antd/es/table/interface";
import { useState } from "react";

const useGenericTableRowSelection = <T extends { id: React.Key }>(
    rowSelectionType: RowSelectionType = "checkbox"
) => {
    const [selectedEntities, setSelectedEntities] = useState<T[]>([]);

    const rowSelection = {
        onChange: (_: React.Key[], selectedRows: T[]) => {
            setSelectedEntities(selectedRows);
        },
    };

    const clearSelected = () => setSelectedEntities([]);

    return {
        selectedEntities,
        rowSelection: {
            type: rowSelectionType,
            selectedRowKeys: selectedEntities.map((item) => item.id),
            ...rowSelection,
        },
        clearSelected,
    };
};

export default useGenericTableRowSelection;
