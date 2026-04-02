``
import { EditOutlined,
    MailOutlined,
    PhoneOutlined,
    CalendarOutlined,
    FileTextOutlined,
    PaperClipOutlined,
    PlusOutlined,
    HomeOutlined,
    EyeOutlined,
    CheckSquareOutlined,
    TrophyOutlined,
    SwapOutlined,
    SettingOutlined,
    LoginOutlined,
    LogoutOutlined,
    MessageOutlined,
    DownloadOutlined,
    UploadOutlined,
    FormOutlined,
    UserAddOutlined,
    TagOutlined,
    UserDeleteOutlined,
    CheckCircleOutlined,
    ThunderboltOutlined,
    GlobalOutlined,
    ApiOutlined,
    LinkOutlined,
    CloseCircleOutlined} from "@ant-design/icons";


export default function getEventIcon(slug: string | undefined): React.ReactNode {
    if (!slug) return <ThunderboltOutlined style={{ fontSize: "11px" }} />;

    const SLUG_ICON: Record<string, React.ReactNode> = {
        // Deal
        deal_created: <PlusOutlined style={{ fontSize: "11px" }} />,
        deal_updated: <EditOutlined style={{ fontSize: "11px" }} />,
        deal_stage_changed: <SwapOutlined style={{ fontSize: "11px" }} />,
        deal_pipeline_changed: <SwapOutlined style={{ fontSize: "11px" }} />,
        deal_agent_assigned: <UserAddOutlined style={{ fontSize: "11px" }} />,
        deal_note_added: <FileTextOutlined style={{ fontSize: "11px" }} />,
        deal_file_uploaded: <PaperClipOutlined style={{ fontSize: "11px" }} />,
        deal_property_linked: <LinkOutlined style={{ fontSize: "11px" }} />,
        deal_followup_created: <CalendarOutlined style={{ fontSize: "11px" }} />,
        deal_task_created: <CheckSquareOutlined style={{ fontSize: "11px" }} />,
        deal_closed_won: <TrophyOutlined style={{ fontSize: "11px" }} />,
        deal_closed_lost: <CloseCircleOutlined style={{ fontSize: "11px" }} />,
        // Lead
        lead_created: <PlusOutlined style={{ fontSize: "11px" }} />,
        lead_updated: <EditOutlined style={{ fontSize: "11px" }} />,
        lead_converted: <SwapOutlined style={{ fontSize: "11px" }} />,
        lead_status_changed: <TagOutlined style={{ fontSize: "11px" }} />,
        // Property
        property_created: <HomeOutlined style={{ fontSize: "11px" }} />,
        property_updated: <EditOutlined style={{ fontSize: "11px" }} />,
        property_viewed: <EyeOutlined style={{ fontSize: "11px" }} />,
        property_enquiry_received: <MailOutlined style={{ fontSize: "11px" }} />,
        // Task
        task_created: <CheckSquareOutlined style={{ fontSize: "11px" }} />,
        task_completed: <CheckCircleOutlined style={{ fontSize: "11px" }} />,
        task_updated: <EditOutlined style={{ fontSize: "11px" }} />,
        // Contact
        contact_created: <UserAddOutlined style={{ fontSize: "11px" }} />,
        contact_updated: <EditOutlined style={{ fontSize: "11px" }} />,
        // Communication
        email_sent: <MailOutlined style={{ fontSize: "11px" }} />,
        email_received: <MailOutlined style={{ fontSize: "11px" }} />,
        whatsapp_message_sent: <MessageOutlined style={{ fontSize: "11px" }} />,
        whatsapp_message_received: <MessageOutlined style={{ fontSize: "11px" }} />,
        // System
        user_login: <LoginOutlined style={{ fontSize: "11px" }} />,
        user_logout: <LogoutOutlined style={{ fontSize: "11px" }} />,
        settings_changed: <SettingOutlined style={{ fontSize: "11px" }} />,
        data_import: <DownloadOutlined style={{ fontSize: "11px" }} />,
        data_export: <UploadOutlined style={{ fontSize: "11px" }} />,
        // External
        website_visit: <GlobalOutlined style={{ fontSize: "11px" }} />,
        form_submission: <FormOutlined style={{ fontSize: "11px" }} />,
        webhook_received: <ApiOutlined style={{ fontSize: "11px" }} />,
        // User
        user_created: <UserAddOutlined style={{ fontSize: "11px" }} />,
        user_updated: <EditOutlined style={{ fontSize: "11px" }} />,
        user_deactivated: <UserDeleteOutlined style={{ fontSize: "11px" }} />,
    };

    if (SLUG_ICON[slug]) return SLUG_ICON[slug];

    if (slug.includes("phone") || slug.includes("call")) return <PhoneOutlined style={{ fontSize: "11px" }} />;
    if (slug.includes("email")) return <MailOutlined style={{ fontSize: "11px" }} />;
    if (slug.includes("updated") || slug.includes("changed")) return <EditOutlined style={{ fontSize: "11px" }} />;
    if (slug.includes("created")) return <PlusOutlined style={{ fontSize: "11px" }} />;
    if (slug.includes("completed")) return <CheckCircleOutlined style={{ fontSize: "11px" }} />;
    if (slug.includes("note")) return <FileTextOutlined style={{ fontSize: "11px" }} />;
    if (slug.includes("meeting") || slug.includes("followup")) return <CalendarOutlined style={{ fontSize: "11px" }} />;

    return <ThunderboltOutlined style={{ fontSize: "11px" }} />;
}