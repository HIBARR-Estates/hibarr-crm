import React from "react";
import { Head } from "@inertiajs/react";
import { Card } from "antd";
import DashboardLayout from "@/Components/DashboardLayout";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface CreateProps {
    pageTitle: string;
    auth: any;
    // Props from DealController's create method
    employees?: any[];
    leadAgents?: any[];
    leadContacts?: any[];
    stages?: any[];
    categories?: any[];
    sources?: any[];
    products?: any[];
    countries?: any[];
    salutations?: any[];
    fields?: any[];
    customFieldCategories?: any[];
}

const Create: React.FC<CreateProps> = (props) => {
    const { td } = useTd();
    return (
        <DashboardLayout>
            <Head title={td("Create Deal", { source: "en" })} />

            <div style={{ padding: "24px" }}>
                <Card>
                    <h2 style={{ marginBottom: 24 }}>{td("Create New Deal", { source: "en" })}</h2>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default Create;
