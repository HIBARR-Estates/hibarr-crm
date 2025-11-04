import { Deal } from "@/Types/api/deals";
import { Link, usePage } from "@inertiajs/react";
import {
    Descriptions,
    Tag,
    Avatar,
    Tooltip,
    Tabs,
    Button,
    Dropdown,
    MenuProps,
} from "antd";
import {
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    EditOutlined,
    DeleteOutlined,
    MoreOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useState } from "react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import SaveDealModal from "@/Features/Deals/SaveDeal/SaveDealModal";
import DeleteDeal from "@/Features/Deals/DeleteDeal";

interface Props {
    deal: Deal;
    productNames: string[];
    customFieldCategories: any[];
    fields: any[];
    permissions: Record<string, string>;
}

export default function DealInfoSection({
    deal,
    productNames,
    customFieldCategories,
    fields,
    permissions,
}: Props) {
    const { props } = usePage();
    const user = props.auth.user;
    const [activeTab, setActiveTab] = useState("overview");
    const { action, handleAction, handleClose } = useGenericEntityAction();

    // Format currency
    const formatCurrency = (value: number, currencySymbol: string = "£") => {
        if (!value) return "--";
        return `${currencySymbol}${value.toLocaleString()}`;
    };

    // Get mobile number from JSON format
    const getMobileNumber = (mobile: string | null | undefined) => {
        if (!mobile) return "--";

        if (typeof mobile === "string" && mobile.trim().startsWith("{")) {
            try {
                const mobileData = JSON.parse(mobile.trim());
                return mobileData?.phone || mobile;
            } catch (e) {
                return mobile;
            }
        }
        return mobile;
    };

    // Action menu items
    const actionItems: MenuProps["items"] = [
        {
            key: "edit",
            label: (
                <span>
                    <EditOutlined className="mr-2" />
                    Edit Deal
                </span>
            ),
            onClick: () => {
                handleAction("edit");
            },
        },
        ...(permissions.delete_deals === "all" ||
        (permissions.delete_deals === "added" && deal.added_by === user?.id) ||
        (permissions.delete_deals === "owned" &&
            (deal.lead_agent?.user_id === user?.id ||
                deal.deal_watchers?.some((w: any) => w.id === user?.id))) ||
        (permissions.delete_deals === "both" &&
            (deal.added_by === user?.id ||
                deal.lead_agent?.user_id === user?.id ||
                deal.deal_watchers?.some((w: any) => w.id === user?.id)))
            ? [
                  {
                      key: "delete",
                      label: (
                          <span className="text-red-600">
                              <DeleteOutlined className="mr-2" />
                              Delete Deal
                          </span>
                      ),
                      onClick: () => {
                          handleAction("delete");
                      },
                  },
              ]
            : []),
    ];

    console.log(deal?.custom_fields_data);

    // Tab items for custom field categories
    const tabItems = [
        {
            key: "overview",
            label: "Overview",
            children: (
                <div className="p-6">
                    <Descriptions column={2} bordered size="middle">
                        <Descriptions.Item label="Deal Name" span={2}>
                            <span className="font-medium text-gray-900">
                                {deal.name}
                            </span>
                        </Descriptions.Item>

                        <Descriptions.Item label="Lead Contact">
                            {deal.contact ? (
                                <div className="space-y-1">
                                    <Link
                                        href={route(
                                            "lead-contact.show",
                                            deal.contact.id
                                        )}
                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        {deal.contact.client_name_salutation ||
                                            deal.contact.client_name}
                                    </Link>
                                    {deal.contact.client_id && (
                                        <Tag color="blue" className="text-xs">
                                            Client
                                        </Tag>
                                    )}
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Email">
                            {deal.contact?.client_email ? (
                                <div className="flex items-center space-x-2">
                                    <MailOutlined className="text-gray-400" />
                                    <a
                                        href={`mailto:${deal.contact.client_email}`}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        {deal.contact.client_email}
                                    </a>
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Mobile">
                            {deal.contact ? (
                                <div className="flex items-center space-x-2">
                                    <PhoneOutlined className="text-gray-400" />
                                    <span>
                                        {getMobileNumber(deal.contact.mobile)}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Company Name">
                            {deal.contact?.company_name || (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Deal Category">
                            {deal.category?.category_name || (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Deal Agent">
                            {deal.lead_agent ? (
                                <div className="flex items-center space-x-2">
                                    <Avatar
                                        size="small"
                                        src={deal.lead_agent.user?.image_url}
                                        icon={<UserOutlined />}
                                    />
                                    <span>{deal.lead_agent.user?.name}</span>
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Deal Watchers">
                            {deal.deal_watchers &&
                            deal.deal_watchers.length > 0 ? (
                                <div className="space-y-1">
                                    {deal.deal_watchers
                                        .slice(0, 3)
                                        .map((watcher: any) => (
                                            <div
                                                key={watcher.id}
                                                className="flex items-center space-x-2"
                                            >
                                                <Avatar
                                                    size="small"
                                                    src={watcher.image}
                                                    icon={<UserOutlined />}
                                                />
                                                <span className="text-sm">
                                                    {watcher.name}
                                                </span>
                                            </div>
                                        ))}
                                    {deal.deal_watchers.length > 3 && (
                                        <span className="text-xs text-gray-500">
                                            +{deal.deal_watchers.length - 3}{" "}
                                            more
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        {deal?.lead_status && (
                            <Descriptions.Item label="Status">
                                <Tag
                                    color={deal.lead_status.label_color}
                                    className="font-medium"
                                >
                                    {deal.lead_status.type}
                                </Tag>
                            </Descriptions.Item>
                        )}

                        <Descriptions.Item label="Close Date">
                            {deal.close_date ? (
                                dayjs(deal.close_date).format("MMM DD, YYYY")
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Deal Value">
                            {deal.value ? (
                                <span className="font-semibold">
                                    {formatCurrency(
                                        deal.value,
                                        deal.currency?.currency_symbol
                                    )}
                                </span>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Products" span={2}>
                            {productNames.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {productNames.map((product, index) => (
                                        <Tag key={index} color="blue">
                                            {product}
                                        </Tag>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>
                    </Descriptions>
                </div>
            ),
        },
        // Custom field categories as tabs
        ...(customFieldCategories || []).map((category) => ({
            key: `category-${category.id}`,
            label: category.name,
            children: (
                <div className="p-6">
                    <Descriptions column={2} bordered size="middle">
                        {fields
                            ?.filter(
                                (field) =>
                                    field.custom_field_category_id ===
                                    category.id
                            )
                            .map((field) => {
                                let value =
                                    deal.custom_fields_data?.[
                                        `field_${field.id}`
                                    ];
                                let span = 1;
                                // ensuure the span is adjusted for field types that may need more space
                                if (
                                    ["textarea", "file", "text"].includes(
                                        field.type
                                    )
                                ) {
                                    span = 2;
                                }
                                console.log(value, "on map value");

                                // Handle different field types
                                if (field.type === "date" && value) {
                                    value = dayjs(value).format("MMM DD, YYYY");
                                } else if (
                                    field.type === "select" &&
                                    value &&
                                    field.values
                                ) {
                                    value = field.values[value] || value;
                                } else if (field.type === "file" && value) {
                                    value = (
                                        <a
                                            href={`/storage/custom_fields/${value}`}
                                            className="text-blue-600 hover:text-blue-800"
                                            download
                                        >
                                            Download File
                                        </a>
                                    );
                                }

                                return (
                                    <Descriptions.Item
                                        key={field.id}
                                        label={field.label}
                                        span={span}
                                    >
                                        {value || (
                                            <span className="text-gray-500">
                                                --
                                            </span>
                                        )}
                                    </Descriptions.Item>
                                );
                            })}
                    </Descriptions>
                </div>
            ),
        })),
    ];

    return (
        <>
            <SaveDealModal
                open={action === "edit"}
                onClose={handleClose}
                deal={deal}
                setDeal={(deal) => {
                    console.log("Deal updated:", deal);
                }}
            />

            <DeleteDeal
                open={action === "delete"}
                onClose={() => handleClose()}
                deal={deal}
            />
            <div>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Deal Information
                    </h2>
                    <Dropdown menu={{ items: actionItems }} trigger={["click"]}>
                        <Button type="text" icon={<MoreOutlined />} />
                    </Dropdown>
                </div>

                {/* Content */}
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    className="deal-info-tabs"
                    tabBarStyle={{
                        paddingLeft: 24,
                        paddingRight: 24,
                        marginBottom: 0,
                        backgroundColor: "#fafafa",
                        borderBottom: "1px solid #f0f0f0",
                    }}
                />
            </div>
        </>
    );
}
