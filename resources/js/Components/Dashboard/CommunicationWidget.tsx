import React from "react";
import { motion } from "framer-motion";
import { Card, Button } from "antd";
import { ArrowRight, MessageSquare, Activity } from "lucide-react";
import CommunicationTimeline from "@/Pages/Deals/Components/ActivitySidebar/CommunicationTimeline";

interface CommunicationActivity {
    id: number;
    channel_type: string;
    message_content: string;
    timestamp: string;
    sender_info: {
        name: string;
        contact?: string;
    };
    deal?: {
        id: number;
        name: string;
    };
}

interface CommunicationWidgetProps {
    activities: CommunicationActivity[];
}

export default function CommunicationWidget({
    activities,
}: CommunicationWidgetProps) {
    // Create a mock deal object for the timeline component
    const mockDeal = {
        id: 0,
        name: "Dashboard Overview",
        lead_pipeline_id: 1,
        pipeline_stage_id: 1,
        lead_id: null,
        agent_id: null,
        value: 0,
        currency_id: null,
        next_follow_up: null,
        close_date: null,
        note: null,
    } as any;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="h-full"
        >
            <CommunicationTimeline deal={mockDeal} compact={true} />
        </motion.div>
    );
}
