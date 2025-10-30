import React from "react";
import { Head } from "@inertiajs/react";
import { Card } from "antd";
import DashboardLayout from "@/Components/DashboardLayout";

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
    return (
        <DashboardLayout>
            <Head title="Create Deal" />

            <div style={{ padding: "24px" }}>
                <Card>
                    <h2 style={{ marginBottom: 24 }}>Create New Deal</h2>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default Create;
