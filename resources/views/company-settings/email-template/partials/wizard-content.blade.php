@php
    $bodyLooksLikeFullHtml = \App\Models\EmailTemplate::bodyLooksLikeFullHtml($template->body ?? null);
    $bodyLooksStripped = \App\Models\EmailTemplate::bodyLooksStripped($template->body ?? null);
    $preferHtmlSource = $bodyLooksLikeFullHtml || $bodyLooksStripped || empty($template->body);
@endphp
@if(isset($template->id))
    <input type="hidden" name="_form_action" id="form-action-url" value="{{ route('email-templates.update', $template->id) }}">
    <input type="hidden" name="_form_method" id="form-method" value="PUT">
@else
    <input type="hidden" name="_form_action" id="form-action-url" value="{{ route('email-templates.store') }}">
    <input type="hidden" name="_form_method" id="form-method" value="POST">
@endif

{{-- Stepper --}}
<div class="wizard-stepper d-flex align-items-start mb-4" id="wizard-stepper">
    <div class="stepper-step" data-step-target="1">
        <div class="stepper-circle">1</div>
        <div class="stepper-label">Basics</div>
    </div>
    <div class="stepper-line"></div>
    <div class="stepper-step" data-step-target="2">
        <div class="stepper-circle">2</div>
        <div class="stepper-label">Body</div>
    </div>
    <div class="stepper-line"></div>
    <div class="stepper-step" data-step-target="3">
        <div class="stepper-circle">3</div>
        <div class="stepper-label">Delivery</div>
    </div>
    <div class="stepper-line"></div>
    <div class="stepper-step" data-step-target="4">
        <div class="stepper-circle">4</div>
        <div class="stepper-label">Variables</div>
    </div>
</div>

<button type="button" class="btn btn-link btn-sm pl-0 f-13 mb-4" data-toggle="collapse" data-target="#merge-tag-help" aria-expanded="false" aria-controls="merge-tag-help">
    <i class="fa fa-info-circle mr-1"></i>How merge tags &amp; variable mappings work
    <i class="fa fa-chevron-down f-10 ml-1"></i>
</button>
<div class="collapse mb-4" id="merge-tag-help">
    <div class="alert alert-info f-13 mb-0">
        <p class="mb-0">
            Use merge tags in the subject or body — they're replaced with live values when a deal
            automation sends this template. Common tags:
            <code>@{{name}}</code> (deal name), <code>@{{value}}</code> (deal value),
            <code>@{{lead_field_client_name}}</code>, <code>@{{lead_field_client_email}}</code>,
            <code>@{{lead_field_mobile}}</code>. Custom field tags follow the same
            <code>@{{custom_field_ID}}</code> / <code>@{{lead_custom_field_ID}}</code> pattern
            used in the deal automation condition builder. Don't want to remember those raw keys —
            or need a variable that isn't in Subject/Body because it's used inside an external Plunk
            template? Give it a friendly name in <strong>Variable Mappings</strong> below and map it to
            a CRM field; <code>@{{yourName}}</code> then works the same as the built-in tags everywhere
            (Subject, Body, and as a Plunk template variable). A mapping can also link somewhere instead
            of showing a field value — flip its switch to <strong>CTA URL</strong> to make <code>@{{yourName}}</code>
            resolve to a link: to the record that triggered the automation, to its Deal or Lead
            specifically, or to any custom URL (which can itself use merge tags, e.g. a booking link
            pre-filled with the lead's email). Wrap it in a link in Body — Quill's link tool works fine.
        </p>
    </div>
</div>

{{-- Step 1: Basics --}}
<div class="wizard-step" data-step="1">
    <h4 class="mb-1">Template Basics</h4>
    <p class="f-12 text-lightest mb-3">Pick how the email is delivered, then name it and set its subject and preview text.</p>

    <div class="row">
        <div class="col-md-12">
            <label class="f-14 text-dark-grey mb-12 d-block">Template Type</label>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="template-mode-card border rounded p-3 h-100 mb-0" for="mode_custom">
                        <div class="custom-control custom-radio">
                            <input type="radio" id="mode_custom" name="mode" value="custom" class="custom-control-input template-mode-radio" {{ ($template->mode ?? 'custom') == 'custom' ? 'checked' : '' }}>
                            <span class="custom-control-label font-weight-bold f-14 d-block">Custom Template</span>
                        </div>
                        <p class="f-12 text-lightest mb-0 mt-1 ml-4 pl-1">Subject and body below are the whole email.</p>
                    </label>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="template-mode-card border rounded p-3 h-100 mb-0" for="mode_plunk_body">
                        <div class="custom-control custom-radio">
                            <input type="radio" id="mode_plunk_body" name="mode" value="plunk_body" class="custom-control-input template-mode-radio" {{ ($template->mode ?? '') == 'plunk_body' ? 'checked' : '' }}>
                            <span class="custom-control-label font-weight-bold f-14 d-block">Plunk Base Template</span>
                        </div>
                        <p class="f-12 text-lightest mb-0 mt-1 ml-4 pl-1">Body below is injected into a Plunk template you design.</p>
                    </label>
                </div>
            </div>
        </div>
    </div>

    <div class="row mt-2">
        <div class="col-md-6">
            <x-forms.text fieldId="name" :fieldLabel="__('app.name')" fieldName="name" fieldRequired="true"
                :fieldValue="$template->name ?? ''" />
        </div>
        <div class="col-md-6">
            <x-forms.text fieldId="subject" fieldLabel="Subject" fieldName="subject" fieldRequired="true"
                :fieldValue="$template->subject ?? ''" />
        </div>
    </div>

    <div class="row">
        <div class="col-md-6">
            <x-forms.text fieldId="preheader" fieldLabel="Preheader (Optional)" fieldName="preheader"
                :fieldValue="$template->preheader ?? ''"
                fieldHelp="The short preview text shown next to the subject in the inbox (Gmail, Outlook, etc.) — not shown in the email body itself. Merge tags work here too." />
        </div>
    </div>
</div>

{{-- Step 2: Body --}}
<div class="wizard-step d-none" data-step="2">
    <div class="d-flex align-items-center justify-content-between mb-1 flex-wrap">
        <h4 class="mb-0">Email Body</h4>
        <div class="d-flex align-items-center">
            <div class="btn-group btn-group-sm mr-2" role="group" aria-label="Body edit mode">
                <button type="button" class="btn btn-outline-secondary {{ !$preferHtmlSource ? 'active' : '' }}" id="body-mode-visual-btn">Visual</button>
                <button type="button" class="btn btn-outline-secondary {{ $preferHtmlSource ? 'active' : '' }}" id="body-mode-html-btn">HTML Source</button>
            </div>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="preview-template"><i class="fa fa-eye"></i> Preview</button>
        </div>
    </div>
    @if($bodyLooksStripped)
        <div class="alert alert-warning f-12 py-2 mb-2" id="body-stripped-warning">
            This template's body lost its HTML tags (usually from pasting in Visual mode). Switch to <strong>HTML Source</strong>, paste your full HTML again, then save — otherwise preview and sends will look like plain text.
        </div>
    @endif
    <p class="f-12 text-lightest mt-1 mb-2" id="body-mode-help"></p>
    <div id="body-editor" class="{{ $preferHtmlSource ? 'd-none' : '' }}">{!! $preferHtmlSource ? '' : ($template->body ?? '') !!}</div>
    <textarea name="body" id="body-html-source" class="form-control {{ $preferHtmlSource ? '' : 'd-none' }}" rows="18" spellcheck="false" style="font-family: 'Courier New', monospace; font-size: 12px;">{{ $preferHtmlSource ? ($template->body ?? '') : '' }}</textarea>
    <p class="f-11 text-lightest mt-2 mb-0 {{ $preferHtmlSource ? '' : 'd-none' }}" id="body-html-source-help">
        Used exactly as-is when it contains its own <code>&lt;table&gt;</code>/<code>&lt;style&gt;</code> layout —
        no extra padding/card wrapper gets added around it. Switching to Visual will simplify anything Quill
        can't represent (tables, <code>&lt;style&gt;</code> blocks), so stay here for a fully custom-designed email.
    </p>
</div>

{{-- Step 3: Delivery --}}
<div class="wizard-step d-none" data-step="3">
    <h4 class="mb-2">Plunk Delivery</h4>
    <div class="row">
        <div class="col-md-8">
            <label class="f-14 text-dark-grey mb-12" id="plunk-template-id-label">Plunk Template ID (optional)</label>
            <div class="d-flex flex-wrap align-items-center">
                <select id="plunk-template-picker" class="form-control height-35 f-14 mr-2 mb-2" style="max-width: 280px;">
                    <option value="">-- Browse Plunk Templates --</option>
                </select>
                <span class="f-12 text-lightest mr-2 mb-2">or</span>
                <input type="text" name="plunk_template_id" id="plunk_template_id" class="form-control height-35 f-14 mb-2" style="flex: 1 1 240px; max-width: 320px;"
                    value="{{ $template->plunk_template_id ?? '' }}" placeholder="Paste a Plunk template ID">
            </div>
            <p class="f-11 text-lightest mt-1 mb-0" id="plunk-template-id-help">If set, this email is sent through Plunk using that template — the merge tag values below are still passed as Plunk template variables.</p>
            <p class="f-11 mt-1 mb-0" id="plunk-template-picker-status" style="display:none;"></p>
        </div>
    </div>
</div>

{{-- Step 4: Variables --}}
<div class="wizard-step d-none" data-step="4">
    <h4 class="mb-1">Variable Mappings</h4>
    <p class="f-12 text-lightest mb-3">
        Map a variable name to a CRM field. Reference it as <code>@{{variableName}}</code> in Subject/Body,
        and it's also sent as a Plunk template variable — useful for naming things to match an existing
        Plunk template design, or for exposing a variable that only the Plunk template uses.
    </p>
    <div id="variable-mappings-container">
        @if(isset($template) && !empty($template->variable_mappings))
            @foreach($template->variable_mappings as $index => $mapping)
                @include('company-settings.email-template.variable-mapping-row', ['index' => $index, 'mapping' => $mapping])
            @endforeach
        @endif
    </div>
    <div class="d-flex flex-wrap align-items-center mt-2">
        <button type="button" class="btn btn-sm btn-outline-secondary mr-2 mb-2" id="add-variable-mapping"><i class="fa fa-plus"></i> Add Variable Mapping</button>
        <button type="button" class="btn btn-sm btn-outline-secondary mr-2 mb-2" id="detect-variables"><i class="fa fa-magic"></i> Detect Variables in Subject/Body</button>
        <span id="detect-variables-status" class="f-12 text-lightest" style="display:none;"></span>
    </div>
    <p class="f-11 text-lightest mt-1 mb-0">Pasting a template into Body auto-detects any <code>@{{tag}}</code> it uses and adds an empty mapping row for each new one — just pick the CRM field for each afterward.</p>
</div>

{{-- Templates for JS --}}
<script type="text/template" id="variable-mapping-template">
    @include('company-settings.email-template.variable-mapping-row', ['index' => 'INDEX', 'mapping' => null])
</script>
