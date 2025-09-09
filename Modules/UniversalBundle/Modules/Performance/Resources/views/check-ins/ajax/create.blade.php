<div class="modal-header">
    <h5 class="modal-title">{{ $pageTitle }}</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>

<x-form id="save-check-ins-form">
    <div class="modal-body">
        <div class="portlet-body"></div>
                <div class="row">
                    <div class="col-md-6">
                        <x-forms.label class="my-3" fieldId="key_result_id" :fieldLabel="__('performance::app.keyResult')" fieldRequired="true">
                        </x-forms.label>
                        @if ($keyResultId)
                        <span class="input-group-text" id="key_result_id">{{ $keyResultId->title }}</span>
                        <input type="hidden" name="key_result_id" id="key_result_id" value="{{ $keyResultId->id }}">
                        @else
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="key_result_id" id="key_result_id"
                                data-live-search="true">
                                @foreach ($keyResults as $keyResult)
                                <option value="{{ $keyResult->id }}" @if ($keyResultId && $keyResult->id == $keyResultId->id) selected @endif>{{ $keyResult->title }}</option>
                                @endforeach
                            </select>
                        </x-forms.input-group>
                        @endif
                    </div>

                    <div class="col-md-6">
                        <x-forms.number fieldName="current_value" fieldId="current_value" fieldLabel="{{ __('performance::app.currentValue') }}" fieldRequired="true" fieldValue="{{ $keyResultId->current_value }}" />
                    </div>

                    <div class="col-md-12">
                        <x-forms.textarea :fieldLabel="__('performance::app.progressUpdate')" :fieldPlaceholder="__('performance::placeholders.progressUpdate')" fieldName="progress_update" fieldId="progress_update" />
                    </div>

                    <div class="col-md-12">
                        <x-forms.textarea :fieldLabel="__('performance::app.barriers')" :fieldPlaceholder="__('performance::placeholders.barriersUpdate')" fieldName="barriers" fieldId="barriers" />
                    </div>

                    <div class="col-md-4">
                        <x-forms.label class="my-3" fieldId="confidence_level" :fieldLabel="__('performance::app.confidenceLevel')" fieldRequired="true">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="confidence_level"
                                id="confidence_level" data-live-search="true" data-size="5">
                                @foreach ($confidenceLevels as $key => $level)
                                <option value="{{ $key }}">{{ $level }}</option>
                                @endforeach
                            </select>
                        </x-forms.input-group>
                    </div>

                    <div class="col-md-4">
                        <x-forms.datepicker fieldId="check_in_date" fieldRequired="true" :fieldLabel="__('performance::app.checkInDate')" fieldName="check_in_date" :fieldValue="now($company->timezone)->format($company->date_format)" :fieldPlaceholder="__('performance::app.checkInDate')" />
                    </div>

                    <div class="col-md-4">
                        <div class="bootstrap-timepicker timepicker">
                            <x-forms.text :fieldLabel="__('app.time')"
                                :fieldPlaceholder="__('placeholders.hours')" fieldName="time" fieldId="time" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
        <x-forms.button-primary id="save-check-ins" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>

<script>
    $(document).ready(function() {
        $('.select-picker').selectpicker();

        datepicker('#check_in_date', {
            position: 'bl',
            maxDate: new Date(),
            ...datepickerConfig
        });


        $('#time').timepicker({
            @if (company()->time_format == 'H:i')
                showMeridian: false,
            @endif
        });

        $('#save-check-ins').click(function() {
            const url = "{{ route('check-ins.store') }}";
            var data = $('#save-check-ins-form').serialize();

            if (url) {
                $.easyAjax({
                    url: url,
                    container: '#save-check-ins-form',
                    type: "POST",
                    disableButton: true,
                    blockUI: true,
                    data: data,
                    success: function(response) {
                        if (response.status == "success") {
                            window.location.reload();
                        }
                    }
                });
            }
        });
    });
</script>
