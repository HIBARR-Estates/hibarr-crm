<div class="modal fade" id="template-preview-modal" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-xl" role="document" style="max-width: 920px;">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Preview — <span id="preview-modal-subject" class="text-muted"></span></h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
            </div>
            <div class="modal-body p-0">
                <p class="f-12 text-lightest px-3 pt-2 mb-2">
                    Merge tags (<code>@{{like}}</code> <code>@{{this}}</code>) are shown as-is here — they only resolve to real values when an automation actually sends this template to a deal/lead.
                </p>
                <iframe id="preview-modal-frame" title="Email preview" style="width:100%; min-height:520px; border:0; background:#f6f6f6;"></iframe>
            </div>
        </div>
    </div>
</div>
