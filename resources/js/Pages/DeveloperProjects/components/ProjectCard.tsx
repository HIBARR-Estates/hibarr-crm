import { Link } from "@inertiajs/react";
import { Dropdown, Popconfirm } from "antd";
import {
    Eye,
    ExternalLink,
    Pencil,
    Trash2,
    MoreHorizontal,
    MapPin,
    Building2,
} from "lucide-react";
import type { MenuProps } from "antd";
import type { DeveloperProject } from "@/Types/developerProject";
import { usePermission } from "@/lib/permissionUtils";
import { formatLocationNameForDisplay } from "@/lib/utils";

function formatCompletionDate(
    dateStr: string | null | undefined,
): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

interface ProjectCardProps {
    project: DeveloperProject;
    onEdit?: (project: DeveloperProject) => void;
    onDelete?: (project: DeveloperProject) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
    project,
    onEdit,
    onDelete,
}) => {
    const { hasPermission } = usePermission();
    const canEdit = hasPermission("edit_developer_projects");
    const canDelete = hasPermission("delete_developer_projects");

    const hasProperties = (project.properties_count ?? 0) > 0;
    const totalUnits = project.total_units ?? project.properties_count ?? 0;
    const totalSold =
        project.total_units_sold ?? project.sold_properties_count ?? 0;
    const soldPct =
        totalUnits > 0 ? Math.round((totalSold / totalUnits) * 100) : 0;

    // First project photo from assets
    const firstPhoto =
        project?.thumbnail?.url ?? project.assets?.[0]?.url ?? null;

    const menuItems: MenuProps["items"] = [
        {
            key: "view",
            label: (
                <Link
                    href={route("developer-projects.show", project.id)}
                    className="flex items-center gap-2"
                >
                    <Eye size={13} />
                    View
                </Link>
            ),
        },
        {
            key: "open-new-tab",
            label: (
                <a
                    href={route("developer-projects.show", project.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                >
                    <ExternalLink size={13} />
                    Open in new tab
                </a>
            ),
        },
        ...(canEdit
            ? [
                  {
                      key: "edit",
                      label: (
                          <span
                              className="flex items-center gap-2"
                              onClick={() => onEdit?.(project)}
                          >
                              <Pencil size={13} />
                              Edit
                          </span>
                      ),
                  },
              ]
            : []),
        ...(canDelete
            ? [
                  { type: "divider" as const },
                  {
                      key: "delete",
                      label: (
                          <Popconfirm
                              title="Delete Project"
                              description="Are you sure? Properties will be unassigned."
                              onConfirm={() => onDelete?.(project)}
                              okText="Delete"
                              cancelText="Cancel"
                              okButtonProps={{ danger: true }}
                          >
                              <span className="flex items-center gap-2 text-red-500">
                                  <Trash2 size={13} />
                                  Delete
                              </span>
                          </Popconfirm>
                      ),
                  },
              ]
            : []),
    ];

    return (
        <Link
            href={route("developer-projects.show", project.id)}
            className="group relative block bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
        >
            {/* ── Developer logo strip ── */}
            <div className="p-2 flex justify-center items-center h-10 border-b border-gray-100 bg-white">
                {project.developer?.logo_url ? (
                    <img
                        src={project.developer.logo_url}
                        alt={project.developer.name}
                        className="max-h-full w-full object-contain"
                    />
                ) : (
                    <span className="text-[11px] font-semibold text-gray-400 truncate px-2 capitalize">
                        {project.developer?.name ?? ""}
                    </span>
                )}
            </div>

            {/* ── Hero image ── */}
            <div className="relative h-48 overflow-hidden flex items-center justify-center bg-gray-50">
                {/* Context menu — always visible on hover */}
                <div
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    <Dropdown
                        menu={{ items: menuItems }}
                        trigger={["click"]}
                        placement="bottomRight"
                    >
                        <button className="w-7 h-7 flex items-center justify-center bg-white/90 rounded-md shadow text-gray-600 hover:bg-white transition-colors cursor-pointer">
                            <MoreHorizontal size={16} />
                        </button>
                    </Dropdown>
                </div>

                {firstPhoto ? (
                    <img
                        src={firstPhoto}
                        alt={project.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-[#001529] flex items-center justify-center px-4">
                        <span className="text-white/60 text-sm font-semibold text-center leading-snug select-none">
                            {project.name}
                        </span>
                    </div>
                )}

                {/* Percentage sold badge */}
                <div className="absolute top-2.5 left-2.5 flex flex-col items-center justify-center bg-black/60 rounded px-2 py-1 min-w-[44px]">
                    <span className="text-[15px] font-extrabold text-white leading-none">
                        {soldPct}%
                    </span>
                    <span className="text-[9px] font-bold text-white/90 tracking-widest uppercase leading-none mt-0.5">
                        SOLD
                    </span>
                </div>
            </div>

            {/* ── Card body ── */}
            <div className="px-4 pt-3 pb-4 bg-white">
                <p className="font-bold text-sm text-slate-900 truncate mb-0.5">
                    {project.name}
                </p>

                {project.location?.name ? (
                    <p className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                        <MapPin size={11} className="text-gray-300 shrink-0" />
                        {formatLocationNameForDisplay(project.location.name)}
                    </p>
                ) : (
                    <p className="text-xs text-gray-400 mb-3">No location</p>
                )}

                <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 pt-2.5 gap-0">
                    {/* Left — price or property count */}
                    <div className="pr-3">
                        {project.starting_price ? (
                            <>
                                <p className="text-[10px] text-gray-400 mb-0.5">
                                    Price From
                                </p>
                                <p className="font-bold text-sm text-slate-900">
                                    {new Intl.NumberFormat("en-GB", {
                                        style: "currency",
                                        currency: "GBP",
                                        maximumFractionDigits: 0,
                                    }).format(Number(project.starting_price))}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-[10px] text-gray-400 mb-0.5">
                                    Properties
                                </p>
                                <p
                                    className={`text-sm font-semibold ${hasProperties ? "text-green-600" : "text-gray-400"}`}
                                >
                                    <Building2
                                        size={11}
                                        className="inline mr-1"
                                    />
                                    {project.properties_count ?? 0}
                                </p>
                            </>
                        )}
                    </div>

                    {/* Right — completion date + properties count when price is shown */}
                    <div className="pl-3 text-right flex flex-col items-end gap-1">
                        {project.completion_date && (
                            <div>
                                <p className="text-[10px] text-gray-400 mb-0.5">
                                    Completion
                                </p>
                                <p className="text-[11px] font-semibold text-gray-600">
                                    {formatCompletionDate(
                                        project.completion_date,
                                    )}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default ProjectCard;
