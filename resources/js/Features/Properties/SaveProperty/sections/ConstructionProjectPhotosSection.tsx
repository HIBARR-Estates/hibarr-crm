import React from "react";
import { Typography, Alert } from "antd";
import type { FormInstance } from "antd/lib/form";
import { PictureOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface ConstructionProjectPhotosSectionProps {
    form: FormInstance;
    projectId?: number;
}

/**
 * Project photos section for construction projects.
 *
 * Project-level assets (site plans, exterior photos) are managed through
 * the DeveloperProjectAsset system. In create mode, the user is informed
 * that photos can be uploaded after the project is saved. In edit mode,
 * photo management is available on the project detail page.
 *
 * Photos uploaded here are shown when viewing individual units of this project.
 */
const ConstructionProjectPhotosSection: React.FC<
    ConstructionProjectPhotosSectionProps
> = ({ form, projectId }) => {
    if (projectId) {
        return (
            <div>
                <Alert
                    message="Manage Project Photos"
                    description={
                        <>
                            <Text>
                                Site plans and exterior photos for this project
                                can be managed on the{" "}
                                <a
                                    href={`/developer-projects/${projectId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    project detail page
                                </a>
                                . Photos uploaded at the project level will
                                automatically appear when viewing individual
                                units of this project.
                            </Text>
                        </>
                    }
                    type="info"
                    showIcon
                    icon={<PictureOutlined />}
                />
            </div>
        );
    }

    return (
        <div>
            <Alert
                message="Photos Available After Save"
                description="Save the project first, then you can upload site plans and exterior photos from the project detail page. These photos will be visible on all individual units of this project."
                type="info"
                showIcon
                icon={<PictureOutlined />}
            />
        </div>
    );
};

export default ConstructionProjectPhotosSection;
