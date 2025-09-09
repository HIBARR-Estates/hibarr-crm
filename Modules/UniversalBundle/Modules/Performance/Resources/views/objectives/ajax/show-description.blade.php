<div class="modal-header">
    <h5 class="modal-title"
        id="modelHeading">@lang('app.description')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <div class="form-body">
            <div class="row">
                <div class="col-lg-12">
                    {!! !empty($objective->description) ? nl2br($objective->description) : '--' !!}
                </div>
            </div>
        </div>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
</div>
