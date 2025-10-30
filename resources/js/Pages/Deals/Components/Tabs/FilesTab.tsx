import { Deal } from "@/Types/api/deals";
import { Empty, Button } from "antd";

interface Props {
    deal: Deal;
    permissions: Record<string, string>;
}

export default function FilesTab({ deal, permissions }: Props) {
    // This would typically load files data dynamically
    // For now, showing empty state with upload button

    return (
        <div className="p-8">
            <Empty
                description={
                    <div className="text-center">
                        <p className="text-gray-500 mb-2">No files uploaded</p>
                        {(permissions.add_lead_files === "all" ||
                            permissions.add_lead_files === "added") && (
                            <Button
                                type="primary"
                                onClick={() => {
                                    // Handle file upload modal
                                    // You'll need to implement this
                                    console.log("Open file upload modal");
                                }}
                            >
                                Upload First File
                            </Button>
                        )}
                    </div>
                }
            />
        </div>
    );
}
