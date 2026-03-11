<div class="row mb-2 action-row border-bottom pb-2">
    {{-- Action Type Selector --}}
    <div class="col-md-3">
        <label class="f-14 text-dark-grey mb-12">Action Type</label>
        <select name="actions[{{ $index }}][action_type]" class="form-control height-35 f-14 action-type-select">
            <option value="stage_transition" {{ ($action->action_type ?? 'stage_transition') == 'stage_transition' ? 'selected' : '' }}>Move to Stage</option>
            <option value="set_field_value" {{ ($action->action_type ?? '') == 'set_field_value' ? 'selected' : '' }}>Set Field Value</option>
            <option value="lock_deal" {{ ($action->action_type ?? '') == 'lock_deal' ? 'selected' : '' }}>Lock Deal</option>
        </select>
    </div>

    {{-- Stage Transition Fields --}}
    <div class="action-fields-stage-transition" style="{{ ($action->action_type ?? 'stage_transition') != 'stage_transition' ? 'display:none;' : '' }}">
        <div class="row">
            <div class="col-md-5">
                <label class="f-14 text-dark-grey mb-12">Target Pipeline (Optional)</label>
                <select name="actions[{{ $index }}][target_pipeline_id]" class="form-control height-35 f-14 action-pipeline-select">
                    <option value="">-- Same as Source --</option>
                    @foreach($pipelines as $pipeline)
                        <option value="{{ $pipeline->id }}" {{ ($action->target_pipeline_id ?? '') == $pipeline->id ? 'selected' : '' }}>{{ $pipeline->name }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-md-4">
                <label class="f-14 text-dark-grey mb-12">Target Stage</label>
                <select name="actions[{{ $index }}][target_stage_id]" class="form-control height-35 f-14 action-stage-select">
                    <option value="">-- Select Target Stage --</option>
                    @foreach($stages as $stage)
                        <option value="{{ $stage->id }}" data-pipeline-id="{{ $stage->lead_pipeline_id }}" {{ ($action->target_stage_id ?? '') == $stage->id ? 'selected' : '' }}>{{ $stage->name }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-md-3">
                <label class="f-14 text-dark-grey mb-12">&nbsp;</label>
                <div class="custom-control custom-checkbox mt-2">
                    <input type="checkbox" class="custom-control-input forward-only-check" id="forward_only_{{ $index }}" name="actions[{{ $index }}][forward_only]" {{ ($action->forward_only ?? true) ? 'checked' : '' }}>
                    <label class="custom-control-label" for="forward_only_{{ $index }}">Forward Only</label>
                </div>
                <p class="f-11 text-lightest mt-1 forward-only-help">Prevents moving the deal back to a previous stage.</p>
                <p class="f-11 text-danger mt-1 forward-only-warning" style="display: none;"><i class="fa fa-exclamation-triangle"></i> May overwrite manual progress.</p>
            </div>
        </div>
    </div>

    {{-- Set Field Value Fields --}}
    <div class="action-fields-set-field-value" style="{{ ($action->action_type ?? '') != 'set_field_value' ? 'display:none;' : '' }}">
        <div class="row">
            <div class="col-md-5">
                <label class="f-14 text-dark-grey mb-12">Field</label>
                <select name="actions[{{ $index }}][field_name]" class="form-control height-35 f-14 action-field-name-select">
                    <option value="">-- Select Field --</option>
                    <option value="outcome_status" {{ ($action->field_name ?? '') == 'outcome_status' ? 'selected' : '' }}>Outcome Status</option>
                    <option value="interested_in" {{ ($action->field_name ?? '') == 'interested_in' ? 'selected' : '' }}>Interested In</option>
                    <option value="motivation" {{ ($action->field_name ?? '') == 'motivation' ? 'selected' : '' }}>Motivation</option>
                    <option value="purchase_timeline" {{ ($action->field_name ?? '') == 'purchase_timeline' ? 'selected' : '' }}>Purchase Timeline</option>
                    <option value="budget_range" {{ ($action->field_name ?? '') == 'budget_range' ? 'selected' : '' }}>Budget Range</option>
                    <option value="strategy_meeting_booked" {{ ($action->field_name ?? '') == 'strategy_meeting_booked' ? 'selected' : '' }}>Strategy Meeting Booked</option>
                    <option value="downpayment_paid" {{ ($action->field_name ?? '') == 'downpayment_paid' ? 'selected' : '' }}>Downpayment Paid</option>
                    <option value="deposit_confirmation" {{ ($action->field_name ?? '') == 'deposit_confirmation' ? 'selected' : '' }}>Deposit Confirmation</option>
                    <option value="reservation_agreement" {{ ($action->field_name ?? '') == 'reservation_agreement' ? 'selected' : '' }}>Reservation Agreement</option>
                    <option value="sales_contract" {{ ($action->field_name ?? '') == 'sales_contract' ? 'selected' : '' }}>Sales Contract</option>
                </select>
            </div>
            <div class="col-md-5 action-field-value-container">
                <label class="f-14 text-dark-grey mb-12">Value</label>
                @if(($action->field_name ?? '') == 'outcome_status')
                    <select name="actions[{{ $index }}][field_value]" class="form-control height-35 f-14 action-field-value-input">
                        <option value="won" {{ ($action->field_value ?? '') == 'won' ? 'selected' : '' }}>Won</option>
                        <option value="lost" {{ ($action->field_value ?? '') == 'lost' ? 'selected' : '' }}>Lost</option>
                    </select>
                @elseif(in_array($action->field_name ?? '', ['strategy_meeting_booked', 'downpayment_paid', 'deposit_confirmation', 'reservation_agreement', 'sales_contract']))
                    <select name="actions[{{ $index }}][field_value]" class="form-control height-35 f-14 action-field-value-input">
                        <option value="1" {{ ($action->field_value ?? '') == '1' ? 'selected' : '' }}>True / Yes</option>
                        <option value="0" {{ ($action->field_value ?? '') == '0' ? 'selected' : '' }}>False / No</option>
                    </select>
                @else
                    <input type="text" name="actions[{{ $index }}][field_value]" class="form-control height-35 f-14 action-field-value-input" value="{{ $action->field_value ?? '' }}" placeholder="Value">
                @endif
            </div>
        </div>
    </div>

    {{-- Lock Deal Fields --}}
    <div class="action-fields-lock-deal" style="{{ ($action->action_type ?? '') != 'lock_deal' ? 'display:none;' : '' }}">
        <div class="row">
            <div class="col-md-8">
                <div class="alert alert-warning f-13 mt-1 mb-0 p-2">
                    <i class="fa fa-lock"></i> This action will <strong>lock the deal</strong>, preventing further changes to its stage, value, and other key fields.
                    This is typically used after a deal is marked as Won to protect commission calculations.
                </div>
            </div>
        </div>
    </div>

    {{-- Remove Button --}}
    <div class="col-md-1 d-flex align-items-center justify-content-center" style="margin-left: auto;">
        <button type="button" class="btn btn-sm btn-danger remove-row mt-4"><i class="fa fa-times"></i></button>
    </div>
</div>
