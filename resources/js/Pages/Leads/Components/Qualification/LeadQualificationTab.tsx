import React, { useMemo } from "react";
import { Spin } from "antd";
import { Lead } from "@/Types/api/leads";
import { getRegistrationService } from "@/Services/RegistrationService";
import EmptyState from "./EmptyState";
import InProgressView from "./InProgressView";
import CompletedRecap from "./CompletedRecap";
import useLeadQualificationLoader from "./useLeadQualificationLoader";

interface LeadQualificationTabProps {
    lead: Lead;
}

const LeadQualificationTab: React.FC<LeadQualificationTabProps> = ({
    lead,
}) => {
    const registrationService = useMemo(() => getRegistrationService(), []);
    const {
        phase,
        current,
        history,
        templateTree,
        qualificationService,
        templateService,
        loadQualifications,
        handleStarted,
        handleQualificationUpdated,
        finishQualificationSession,
        handleStartNew,
    } = useLeadQualificationLoader(lead.id);

    if (phase === "loading") {
        return (
            <div className="flex justify-center py-16">
                <Spin size="large" />
            </div>
        );
    }

    if (phase === "empty") {
        return (
            <EmptyState
                leadId={lead.id}
                templateService={templateService}
                qualificationService={qualificationService}
                onStarted={handleStarted}
            />
        );
    }

    if (phase === "inProgress" && current && templateTree) {
        return (
            <InProgressView
                lead={lead}
                qualification={current}
                templateTree={templateTree}
                qualificationService={qualificationService}
                registrationService={registrationService}
                onQualificationUpdated={handleQualificationUpdated}
                onActionsDone={finishQualificationSession}
                onAbandoned={loadQualifications}
            />
        );
    }

    if (phase === "completed" && current) {
        return (
            <CompletedRecap
                qualification={current}
                history={history}
                templateService={templateService}
                onStartNew={handleStartNew}
            />
        );
    }

    return (
        <EmptyState
            leadId={lead.id}
            templateService={templateService}
            qualificationService={qualificationService}
            onStarted={handleStarted}
        />
    );
};

export default LeadQualificationTab;
