<div class="action-row border rounded p-3 mb-3 bg-white">
    {{-- Header: Action Type + Remove --}}
    <div class="row align-items-center">
        <div class="col-md-4">
            <label class="f-14 text-dark-grey mb-12">Action Type</label>
            <select name="actions[{{ $index }}][action_type]" class="form-control height-35 f-14 action-type-select">
                <option value="stage_transition" data-subject="deal" {{ ($action->action_type ?? 'stage_transition') == 'stage_transition' ? 'selected' : '' }}>Move to Stage</option>
                <option value="set_field_value" data-subject="any" {{ ($action->action_type ?? '') == 'set_field_value' ? 'selected' : '' }}>Set Field Value</option>
                <option value="lock_deal" data-subject="deal" {{ ($action->action_type ?? '') == 'lock_deal' ? 'selected' : '' }}>Lock Deal</option>
                <option value="send_email" data-subject="any" {{ ($action->action_type ?? '') == 'send_email' ? 'selected' : '' }}>Send Email</option>
                <option value="create_task" data-subject="any" {{ ($action->action_type ?? '') == 'create_task' ? 'selected' : '' }}>Create Task</option>
                <option value="create_note" data-subject="any" {{ ($action->action_type ?? '') == 'create_note' ? 'selected' : '' }}>Create Note</option>
                <option value="meta_conversion" data-subject="any" {{ ($action->action_type ?? '') == 'meta_conversion' ? 'selected' : '' }}>Meta Conversion</option>
            </select>
        </div>
        <div class="col-md-8 text-right">
            <button type="button" class="btn btn-sm btn-outline-danger remove-row"><i class="fa fa-times"></i> Remove</button>
        </div>
    </div>

    {{-- Stage Transition Fields --}}
    <div class="action-fields-stage-transition mt-3" style="{{ ($action->action_type ?? 'stage_transition') != 'stage_transition' ? 'display:none;' : '' }}">
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
    <div class="action-fields-set-field-value mt-3" style="{{ ($action->action_type ?? '') != 'set_field_value' ? 'display:none;' : '' }}">
        <div class="row">
            <div class="col-md-6">
                <label class="f-14 text-dark-grey mb-12">Field</label>
                <select name="actions[{{ $index }}][field_name]" class="form-control height-35 f-14 action-field-name-select">
                    <option value="">-- Select Field --</option>
                    <optgroup label="Deal Fields" class="action-field-group-deal">
                        <option value="outcome_status" data-subject="deal" {{ ($action->field_name ?? '') == 'outcome_status' ? 'selected' : '' }}>Outcome Status</option>
                        <option value="interested_in" data-subject="deal" {{ ($action->field_name ?? '') == 'interested_in' ? 'selected' : '' }}>Interested In</option>
                        <option value="motivation" data-subject="deal" {{ ($action->field_name ?? '') == 'motivation' ? 'selected' : '' }}>Motivation</option>
                        <option value="purchase_timeline" data-subject="deal" {{ ($action->field_name ?? '') == 'purchase_timeline' ? 'selected' : '' }}>Purchase Timeline</option>
                        <option value="budget_range" data-subject="deal" {{ ($action->field_name ?? '') == 'budget_range' ? 'selected' : '' }}>Budget Range</option>
                        <option value="strategy_meeting_booked" data-subject="deal" {{ ($action->field_name ?? '') == 'strategy_meeting_booked' ? 'selected' : '' }}>Strategy Meeting Booked</option>
                        <option value="downpayment_paid" data-subject="deal" {{ ($action->field_name ?? '') == 'downpayment_paid' ? 'selected' : '' }}>Downpayment Paid</option>
                        <option value="deposit_confirmation" data-subject="deal" {{ ($action->field_name ?? '') == 'deposit_confirmation' ? 'selected' : '' }}>Deposit Confirmation</option>
                        <option value="reservation_agreement" data-subject="deal" {{ ($action->field_name ?? '') == 'reservation_agreement' ? 'selected' : '' }}>Reservation Agreement</option>
                        <option value="sales_contract" data-subject="deal" {{ ($action->field_name ?? '') == 'sales_contract' ? 'selected' : '' }}>Sales Contract</option>
                    </optgroup>
                    <optgroup label="Lead Fields" class="action-field-group-lead">
                        @foreach($leadSettableFields as $key => $label)
                            <option value="{{ $key }}" data-subject="lead" {{ ($action->field_name ?? '') == $key ? 'selected' : '' }}>{{ $label }}</option>
                        @endforeach
                    </optgroup>
                </select>
            </div>
            <div class="col-md-6 action-field-value-container">
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
                @elseif(($action->field_name ?? '') == 'temperature')
                    <select name="actions[{{ $index }}][field_value]" class="form-control height-35 f-14 action-field-value-input">
                        <option value="cold" {{ ($action->field_value ?? '') == 'cold' ? 'selected' : '' }}>Cold</option>
                        <option value="warm" {{ ($action->field_value ?? '') == 'warm' ? 'selected' : '' }}>Warm</option>
                        <option value="hot" {{ ($action->field_value ?? '') == 'hot' ? 'selected' : '' }}>Hot</option>
                    </select>
                @else
                    <input type="text" name="actions[{{ $index }}][field_value]" class="form-control height-35 f-14 action-field-value-input" value="{{ $action->field_value ?? '' }}" placeholder="Value">
                @endif
            </div>
        </div>
    </div>

    {{-- Lock Deal Fields --}}
    <div class="action-fields-lock-deal mt-3" style="{{ ($action->action_type ?? '') != 'lock_deal' ? 'display:none;' : '' }}">
        <div class="alert alert-warning f-13 mb-0 p-2">
            <i class="fa fa-lock"></i> This action will <strong>lock the deal</strong>, preventing further changes to its stage, value, and other key fields.
            This is typically used after a deal is marked as Won to protect commission calculations.
        </div>
    </div>

    {{-- Send Email Fields --}}
    <div class="action-fields-send-email mt-3" style="{{ ($action->action_type ?? '') != 'send_email' ? 'display:none;' : '' }}">
        <div class="row">
            <div class="col-md-8">
                <label class="f-14 text-dark-grey mb-12">Email Template</label>
                <select name="actions[{{ $index }}][email_template_id]" class="form-control height-35 f-14 action-email-template-select">
                    <option value="">-- Select Template --</option>
                    @foreach($emailTemplates as $template)
                        <option value="{{ $template->id }}" {{ ($action->email_template_id ?? '') == $template->id ? 'selected' : '' }}>{{ $template->name }}</option>
                    @endforeach
                </select>
                <p class="f-11 text-lightest mt-1 mb-0">Manage templates under <a href="{{ route('email-templates.index') }}" target="_blank">Email Templates</a>.</p>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-md-12">
                <label class="f-14 text-dark-grey mb-12">Send To (any combination)</label>
                <div class="d-flex flex-wrap action-recipient-types-container">
                    @foreach($recipientTypes as $key => $meta)
                        <div class="custom-control custom-checkbox mr-4 mb-2 action-recipient-type-wrap" data-subject="{{ $meta['subject'] }}">
                            <input type="checkbox" class="custom-control-input action-recipient-type-check" id="recipient_{{ $index }}_{{ $key }}" name="actions[{{ $index }}][recipient_types][]" value="{{ $key }}" {{ in_array($key, $action->recipient_types ?? ['client']) ? 'checked' : '' }}>
                            <label class="custom-control-label" for="recipient_{{ $index }}_{{ $key }}">{{ $meta['label'] }}</label>
                        </div>
                    @endforeach
                </div>
            </div>
        </div>
        <div class="row mt-2">
            <div class="col-md-6 action-recipient-user-container" style="{{ in_array('specific_user', $action->recipient_types ?? []) ? '' : 'display:none;' }}">
                <label class="f-14 text-dark-grey mb-12">Specific User(s)</label>
                <select name="actions[{{ $index }}][recipient_user_ids][]" class="form-control f-14" multiple size="4">
                    @foreach($users as $companyUser)
                        <option value="{{ $companyUser->id }}" {{ in_array($companyUser->id, $action->recipient_user_ids ?? []) ? 'selected' : '' }}>{{ $companyUser->name }}</option>
                    @endforeach
                </select>
                <p class="f-11 text-lightest mt-1 mb-0">Hold Ctrl/Cmd to select multiple.</p>
            </div>
            <div class="col-md-6 action-recipient-email-container" style="{{ in_array('custom_email', $action->recipient_types ?? []) ? '' : 'display:none;' }}">
                <label class="f-14 text-dark-grey mb-12">Custom Email Address(es)</label>
                <textarea name="actions[{{ $index }}][recipient_emails]" class="form-control f-14" rows="4" placeholder="One per line, or comma-separated">{{ $action->recipient_emails ?? '' }}</textarea>
            </div>
        </div>
    </div>

    {{-- Create Task Fields --}}
    <div class="action-fields-create-task mt-3" style="{{ ($action->action_type ?? '') != 'create_task' ? 'display:none;' : '' }}">
        <div class="row">
            <div class="col-md-6">
                <div class="d-flex align-items-center justify-content-between mb-12">
                    <label class="f-14 text-dark-grey mb-0">Task Title</label>
                    @include('company-settings.deal-automation._tag-picker', ['targetId' => 'action_task_title_'.$index])
                </div>
                <input type="text" id="action_task_title_{{ $index }}" name="actions[{{ $index }}][title]" class="form-control height-35 f-14" value="{{ $action->title ?? '' }}" placeholder="e.g. Follow up with @{{name}}">
            </div>
            <div class="col-md-6">
                <div class="d-flex align-items-center justify-content-between mb-12">
                    <label class="f-14 text-dark-grey mb-0">Description (Optional)</label>
                    @include('company-settings.deal-automation._tag-picker', ['targetId' => 'action_task_content_'.$index])
                </div>
                <input type="text" id="action_task_content_{{ $index }}" name="actions[{{ $index }}][content]" class="form-control height-35 f-14" value="{{ $action->content ?? '' }}" placeholder="Merge tags like @{{lead_field_client_name}} work here too">
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-md-6">
                <label class="f-14 text-dark-grey mb-12">Assign To</label>
                <div class="row no-gutters">
                    <div class="col-6 pr-1">
                        <select name="actions[{{ $index }}][assignee_type]" class="form-control height-35 f-14 action-assignee-type-select">
                            @foreach($assignmentTypes as $key => $label)
                                <option value="{{ $key }}" {{ ($action->assignee_type ?? 'lead_owner') == $key ? 'selected' : '' }}>{{ $label }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="col-6 pl-1">
                        <select name="actions[{{ $index }}][assignee_user_id]" class="form-control height-35 f-14 action-assignee-user-select" style="{{ ($action->assignee_type ?? 'lead_owner') != 'specific_user' ? 'display:none;' : '' }}">
                            <option value="">-- Select User --</option>
                            @foreach($users as $companyUser)
                                <option value="{{ $companyUser->id }}" {{ ($action->assignee_user_id ?? '') == $companyUser->id ? 'selected' : '' }}>{{ $companyUser->name }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
            </div>
            <div class="col-md-6 action-assigner-container">
                <label class="f-14 text-dark-grey mb-12">Created/Assigned By</label>
                <div class="row no-gutters">
                    <div class="col-6 pr-1">
                        <select name="actions[{{ $index }}][assigner_type]" class="form-control height-35 f-14 action-assigner-type-select">
                            @foreach($assignmentTypes as $key => $label)
                                <option value="{{ $key }}" {{ ($action->assigner_type ?? 'lead_owner') == $key ? 'selected' : '' }}>{{ $label }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="col-6 pl-1">
                        <select name="actions[{{ $index }}][assigner_user_id]" class="form-control height-35 f-14 action-assigner-user-select" style="{{ ($action->assigner_type ?? 'lead_owner') != 'specific_user' ? 'display:none;' : '' }}">
                            <option value="">-- Select User --</option>
                            @foreach($users as $companyUser)
                                <option value="{{ $companyUser->id }}" {{ ($action->assigner_user_id ?? '') == $companyUser->id ? 'selected' : '' }}>{{ $companyUser->name }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-md-4">
                <label class="f-14 text-dark-grey mb-12">Due In (Optional)</label>
                <div class="row no-gutters">
                    <div class="col-6 pr-1">
                        <input type="number" min="1" max="3650" name="actions[{{ $index }}][due_date_delta_value]" class="form-control height-35 f-14" value="{{ $action->due_date_delta_value ?? '' }}" placeholder="e.g. 3">
                    </div>
                    <div class="col-6 pl-1">
                        <select name="actions[{{ $index }}][due_date_delta_unit]" class="form-control height-35 f-14">
                            @foreach($dueDateDeltaUnits as $key => $label)
                                <option value="{{ $key }}" {{ ($action->due_date_delta_unit ?? 'days') == $key ? 'selected' : '' }}>{{ $label }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
                <p class="f-11 text-lightest mt-1 mb-0">From when the automation creates the task — leave blank for no due date.</p>
            </div>
            <div class="col-md-3">
                <label class="f-14 text-dark-grey mb-12">Due Time (Optional)</label>
                <input type="time" name="actions[{{ $index }}][due_time]" class="form-control height-35 f-14" value="{{ ($action->due_time ?? null) ? \Illuminate\Support\Carbon::parse($action->due_time)->format('H:i') : '' }}">
                <p class="f-11 text-lightest mt-1 mb-0">Overrides the time-of-day on the due date above.</p>
            </div>
        </div>
    </div>

    {{-- Meta Conversion Fields --}}
    <div class="action-fields-meta-conversion mt-3" style="{{ ($action->action_type ?? '') != 'meta_conversion' ? 'display:none;' : '' }}">
        <div class="row">
            <div class="col-md-7">
                <div class="d-flex align-items-center justify-content-between mb-12">
                    <label class="f-14 text-dark-grey mb-0">Event Name</label>
                    @include('company-settings.deal-automation._tag-picker', ['targetId' => 'action_meta_event_name_'.$index])
                </div>
                <div class="d-flex flex-wrap align-items-center">
                    @if(!empty($metaEventNames))
                        <select class="form-control height-35 f-14 mr-2 mb-2 meta-event-name-picker" style="max-width: 220px;">
                            <option value="">-- Existing Event --</option>
                            @foreach($metaEventNames as $eventName)
                                <option value="{{ $eventName }}">{{ $eventName }}</option>
                            @endforeach
                        </select>
                        <span class="f-12 text-lightest mr-2 mb-2">or type a new one</span>
                    @endif
                    <input type="text" id="action_meta_event_name_{{ $index }}" name="actions[{{ $index }}][meta_event_name]" class="form-control height-35 f-14 mb-2" style="flex: 1 1 200px;" value="{{ $action->meta_event_name ?? '' }}" placeholder="e.g. Qualified, Committed">
                </div>
                <p class="f-11 text-lightest mt-1 mb-0">Pick an event name already used elsewhere, or type/insert a new one — merge tags work here too.</p>
            </div>
            <div class="col-md-3">
                <label class="f-14 text-dark-grey mb-12">Value (Optional)</label>
                <input type="number" step="0.01" min="0" name="actions[{{ $index }}][meta_event_value]" class="form-control height-35 f-14" value="{{ $action->meta_event_value ?? '' }}" placeholder="0.00">
            </div>
        </div>
        <p class="f-11 text-lightest mt-2 mb-0">Sends a conversion event to Meta (Facebook) Conversions API for this deal/lead's contact — requires Meta Pixel ID/Access Token configured for the app.</p>
    </div>

    {{-- Create Note Fields --}}
    <div class="action-fields-create-note mt-3" style="{{ ($action->action_type ?? '') != 'create_note' ? 'display:none;' : '' }}">
        <div class="row">
            <div class="col-md-6">
                <div class="d-flex align-items-center justify-content-between mb-12">
                    <label class="f-14 text-dark-grey mb-0">Note Title (Optional)</label>
                    @include('company-settings.deal-automation._tag-picker', ['targetId' => 'action_note_title_'.$index])
                </div>
                <input type="text" id="action_note_title_{{ $index }}" name="actions[{{ $index }}][title]" class="form-control height-35 f-14" value="{{ $action->title ?? '' }}" placeholder="Optional title">
            </div>
            <div class="col-md-6">
                <div class="d-flex align-items-center justify-content-between mb-12">
                    <label class="f-14 text-dark-grey mb-0">Note Details</label>
                    @include('company-settings.deal-automation._tag-picker', ['targetId' => 'action_note_content_'.$index])
                </div>
                <input type="text" id="action_note_content_{{ $index }}" name="actions[{{ $index }}][content]" class="form-control height-35 f-14" value="{{ $action->content ?? '' }}" placeholder="Merge tags like @{{lead_field_client_name}} work here too">
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-md-6 action-assigner-container">
                <label class="f-14 text-dark-grey mb-12">Added By</label>
                <div class="row no-gutters">
                    <div class="col-6 pr-1">
                        <select name="actions[{{ $index }}][assigner_type]" class="form-control height-35 f-14 action-assigner-type-select">
                            @foreach($assignmentTypes as $key => $label)
                                <option value="{{ $key }}" {{ ($action->assigner_type ?? 'lead_owner') == $key ? 'selected' : '' }}>{{ $label }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="col-6 pl-1">
                        <select name="actions[{{ $index }}][assigner_user_id]" class="form-control height-35 f-14 action-assigner-user-select" style="{{ ($action->assigner_type ?? 'lead_owner') != 'specific_user' ? 'display:none;' : '' }}">
                            <option value="">-- Select User --</option>
                            @foreach($users as $companyUser)
                                <option value="{{ $companyUser->id }}" {{ ($action->assigner_user_id ?? '') == $companyUser->id ? 'selected' : '' }}>{{ $companyUser->name }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
