<div class="modal-header">
    <h5 class="modal-title">{{ $pageTitle }}</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>

<x-form id="save-check-ins-form" method="POST" class="ajax-form">
    @csrf
    @method('PUT')
    <div class="modal-body">
        <div class="portlet-body">
            <div class="row">
                <div class="col-md-6">
                    <x-forms.label class="my-3" fieldId="key_result_id" :fieldLabel="__('performance::app.keyResult')" fieldRequired="true">
                    </x-forms.label>
                    <x-forms.input-group>
                        <select class="form-control select-picker" name="key_result_id" id="key_result_id"
                            data-live-search="true">
                            @foreach ($keyResults as $keyResult)
                            <option value="{{ $keyResult->id }}" @if ($keyResult->id == $checkIn->key_result_id) selected @endif>
                                {{ $keyResult->title }}
                            </option>
                            @endforeach
                        </select>
                    </x-forms.input-group>
                </div>

                <div class="col-md-6">
                    <x-forms.number fieldName="current_value" fieldId="current_value" fieldLabel="{{ __('performance::app.currentValue') }}" fieldRequired="true" :fieldValue="$checkIn->current_value" />
                </div>

                <div class="col-md-12">
                    <x-forms.textarea :fieldLabel="__('performance::app.progressUpdate')" :fieldPlaceholder="__('performance::placeholders.progressUpdate')" fieldName="progress_update" fieldId="progress_update" :fieldValue="$checkIn->progress_update" />
                </div>

                <div class="col-md-12">
                    <x-forms.textarea :fieldLabel="__('performance::app.barriers')" :fieldPlaceholder="__('performance::placeholders.barriersUpdate')" fieldName="barriers" fieldId="barriers" :fieldValue="$checkIn->barriers" />
                </div>

                <div class="col-md-4">
                    <x-forms.label class="my-3" fieldId="confidence_level" :fieldLabel="__('performance::app.confidenceLevel')" fieldRequired="true">
                    </x-forms.label>
                    <x-forms.input-group>
                        <select class="form-control select-picker" name="confidence_level"
                            id="confidence_level" data-live-search="true" data-size="5">
                            @foreach ($confidenceLevels as $key => $level)
                            <option value="{{ $key }}" @if ($key==$checkIn->confidence_level) selected @endif>
                                {{ $level }}
                            </option>
                            @endforeach
                        </select>
                    </x-forms.input-group>
                </div>

                <div class="col-md-4">
                    <x-forms.datepicker fieldId="check_in_date" fieldRequired="true" :fieldLabel="__('performance::app.checkInDate')" fieldName="check_in_date"
                    :fieldValue="\Carbon\Carbon::parse($checkIn->check_in_date)->format($company->date_format)" :fieldPlaceholder="__('performance::app.checkInDate')" />
                </div>

                <div class="col-md-4">
                    <div class="bootstrap-timepicker timepicker">
                        <x-forms.text :fieldLabel="__('app.time')"
                            :fieldPlaceholder="__('placeholders.hours')" fieldName="time" fieldId="time"
                            :fieldValue="\Carbon\Carbon::parse($checkIn->check_in_date)->format(company()->time_format)" />
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
                <x-forms.button-primary id="save-check-ins" icon="check">@lang('app.save')</x-forms.button-primary>
            </div>
        </div>
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
            const url = "{{ route('check-ins.update', $checkIn->id) }}";
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
