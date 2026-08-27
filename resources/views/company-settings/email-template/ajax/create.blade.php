<div class="modal-header">
    <h5 class="modal-title">New Email Template</h5>
    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
</div>

<x-form id="email-template-form" method="POST">
    <div class="modal-body" style="max-height: 75vh; overflow-y: auto;">
        @include('company-settings.email-template.partials.wizard-content', ['template' => $template])
    </div>
    <div class="modal-footer">
        @include('company-settings.email-template.partials.wizard-actions', ['isModal' => true])
    </div>
</x-form>

@include('company-settings.email-template.partials.preview-modal')
@include('company-settings.email-template.partials.wizard-styles')
@include('company-settings.email-template.partials.wizard-scripts', ['template' => $template, 'isModal' => true])
@include('company-settings.email-template.partials.preview-modal-scripts')
