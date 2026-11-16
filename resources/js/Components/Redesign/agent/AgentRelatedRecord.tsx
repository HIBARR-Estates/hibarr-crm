interface AgentRelatedRecordProps {
    label: string;
    /** The record's name ("Becker · Iskele apartment"). */
    name: string;
    /** Diamond for a deal, dot for a person, as on the task form's linked items. */
    kind: "deal" | "lead";
    /** Line under the box ("Set from the deal you are on"). */
    hint?: string;
}

/**
 * A read-only form field naming the record a create form books against
 * (canvas L7-32 "Related record"): the agent is already on that record, so
 * there is nothing to pick.
 */
export default function AgentRelatedRecord({ label, name, kind, hint }: AgentRelatedRecordProps) {
    return (
        <div className="modal-field" style={{ marginBottom: 16 }}>
            <label>{label}</label>
            <div className="agent-related" aria-readonly="true">
                <span className={`agent-related__mark agent-related__mark--${kind}`} aria-hidden="true" />
                <span className="agent-related__name">{name}</span>
            </div>
            {hint ? <p className="agent-related__hint">{hint}</p> : null}
        </div>
    );
}
