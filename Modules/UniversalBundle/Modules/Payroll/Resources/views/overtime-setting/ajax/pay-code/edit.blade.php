<div class="modal-header">
    <h5 class="modal-title">@lang('payroll::modules.payroll.editPayCode')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="editPayCode" method="PUT" class="ajax-form">
            <div class="form-body">
                <div class="row">
                    <div class="col-lg-6">
                        <x-forms.text fieldId="name" :fieldLabel="__('payroll::modules.payroll.payCodeName')"
                            fieldName="name" fieldRequired="true" :fieldValue="$payCode->name" :fieldPlaceholder="__('payroll::modules.payroll.payCodeName')">
                        </x-forms.text>
                    </div>

                    <div class="col-lg-6">
                        <x-forms.text fieldId="code" :fieldLabel="__('payroll::modules.payroll.payCode')"
                            fieldName="code" fieldRequired="true" :fieldValue="$payCode->code" :fieldPlaceholder="__('payroll::modules.payroll.payCode')">
                        </x-forms.text>
                    </div>

                    <div class="col-lg-4">
                        <div class="form-group my-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <x-forms.label fieldId="rate_type" :fieldLabel="__('payroll::modules.payroll.rateType')" fieldRequired="true">
                                </x-forms.label>
                                <div class="d-flex align-items-center">
                                    <div class="custom-control custom-switch">
                                        <input type="checkbox" class="custom-control-input" id="rate_type_switch" name="rate_type" value="time" {{ $payCode->fixed == 0 ? 'checked' : '' }}>
                                        <label class="custom-control-label" for="rate_type_switch">
                                            <span class="fixed-text {{ $payCode->fixed == 0 ? 'd-none' : '' }}">@lang('payroll::modules.payroll.fixed')</span>
                                            <span class="time-text {{ $payCode->fixed == 0 ? '' : 'd-none' }}">@lang('payroll::modules.payroll.times')</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-12">
                        <h4 class="mt-3 mb-0 f-21 text-capitalize font-weight-bold">@lang('payroll::modules.payroll.overtimeRates')</h4>
                        <p class="mb-3 f-12 text-dark-grey">@lang('payroll::modules.payroll.overtimeCalculationWillbe')</p>
                    </div>

                    <!-- Regular Rate -->
                    <div class="col-lg-4">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="regular_rate" class="rate-label" :fieldLabel="__('payroll::modules.payroll.regularRate')" fieldRequired="true">
                            </x-forms.label>
                            <div class="input-group">
                                <div class="fixed-rate w-100 {{ $payCode->fixed == 0 ? 'd-none' : '' }}">
                                    <div class="input-group">
                                        <div class="input-group-prepend">
                                            <span class="input-group-text height-35">
                                                {{ company()->currency->currency_symbol }}
                                            </span>
                                        </div>
                                        <input type="number" class="form-control height-35 f-14" id="regular_fixed_amount"
                                            name="regular_fixed_amount" value="{{ $payCode->regular_fixed_amount }}" placeholder="@lang('payroll::modules.payroll.amount')" />
                                    </div>
                                </div>
                                <div class="time-rate w-100 {{ $payCode->rate_type == 0 ? '' : 'd-none' }}">
                                    <div class="input-group">
                                        <input type="number" class="form-control height-35 f-14" id="regular_time_rate"
                                            name="regular_time_rate" value="{{ $payCode->regular_time_rate }}" placeholder="@lang('payroll::modules.payroll.timeRate')" />
                                        <div class="input-group-append">
                                            <span class="input-group-text height-35">
                                                @lang('payroll::modules.payroll.times')
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Holiday Rate -->
                    <div class="col-lg-4">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="holiday_rate" class="rate-label" :fieldLabel="__('payroll::modules.payroll.holidayAmount')" fieldRequired="true">
                            </x-forms.label>
                            <div class="input-group">
                                <div class="fixed-rate w-100 {{ $payCode->fixed == 0 ? 'd-none' : '' }}">
                                    <div class="input-group">
                                        <div class="input-group-prepend">
                                            <span class="input-group-text height-35">
                                                {{ company()->currency->currency_symbol }}
                                            </span>
                                        </div>
                                        <input type="number" class="form-control height-35 f-14" id="holiday_fixed_amount"
                                            name="holiday_fixed_amount" value="{{ $payCode->holiday_fixed_amount }}" placeholder="@lang('payroll::modules.payroll.amount')" />
                                    </div>
                                </div>
                                <div class="time-rate w-100 {{ $payCode->fixed == 0 ? '' : 'd-none' }}">
                                    <div class="input-group">
                                        <input type="number" class="form-control height-35 f-14" id="holiday_time_rate"
                                            name="holiday_time_rate" value="{{ $payCode->holiday_time_rate }}" placeholder="@lang('payroll::modules.payroll.timeRate')" />
                                        <div class="input-group-append">
                                            <span class="input-group-text height-35">
                                                @lang('payroll::modules.payroll.times')
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Day Off Rate -->
                    <div class="col-lg-4">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="day_off_rate" class="rate-label" :fieldLabel="__('payroll::modules.payroll.dayOffAmount')" fieldRequired="true">
                            </x-forms.label>
                            <div class="input-group">
                                <div class="fixed-rate w-100 {{ $payCode->fixed == 0 ? 'd-none' : '' }}">
                                    <div class="input-group">
                                        <div class="input-group-prepend">
                                            <span class="input-group-text height-35">
                                                {{ company()->currency->currency_symbol }}
                                            </span>
                                        </div>
                                        <input type="number" class="form-control height-35 f-14" id="day_off_fixed_amount"
                                            name="day_off_fixed_amount" value="{{ $payCode->day_off_fixed_amount }}" placeholder="@lang('payroll::modules.payroll.amount')" />
                                    </div>
                                </div>
                                <div class="time-rate w-100 {{ $payCode->rate_type == 0 ? '' : 'd-none' }}">
                                    <div class="input-group">
                                        <input type="number" class="form-control height-35 f-14" id="day_off_time_rate"
                                            name="day_off_time_rate" value="{{ $payCode->day_off_time_rate }}" placeholder="@lang('payroll::modules.payroll.timeRate')" />
                                        <div class="input-group-append">
                                            <span class="input-group-text height-35">
                                                @lang('payroll::modules.payroll.times')
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-12">
                        <x-forms.textarea fieldId="description" :fieldLabel="__('app.description')" fieldName="description" :fieldValue="$payCode->description">
                        </x-forms.textarea>
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
    <x-forms.button-primary id="update-pay-code" icon="check">@lang('app.update')</x-forms.button-primary>
</div>

<script>
    $(document).ready(function() {
        // Style the switch label text
        $('.custom-control-label').css({
            'padding-right': '80px',
            'cursor': 'pointer'
        });

        // Set initial state for labels
        updateLabels($('#rate_type_switch').is(':checked'));
    });

    function updateLabels(isTime) {
        $('.rate-label').each(function() {
            var labelText = $(this).text();
            var amount = "{{ __('app.amount') }}";
            var rate = "{{ __('payroll::app.rate') }}";
            if(isTime) {
                labelText = labelText.replace(amount, rate);
            } else {
                labelText = labelText.replace(rate, amount);
            }
            $(this).text(labelText);
        });
    }

    $('#rate_type_switch').change(function() {
        var isTime = $(this).is(':checked');

        // Toggle text in switch label
        $('.fixed-text').toggleClass('d-none', isTime);
        $('.time-text').toggleClass('d-none', !isTime);

        // Toggle input visibility
        $('.fixed-rate').toggleClass('d-none', isTime);
        $('.time-rate').toggleClass('d-none', !isTime);

        // Update labels
        updateLabels(isTime);
    });

    $('#update-pay-code').click(function() {
        var url = "{{ route('pay-codes.update', $payCode->id) }}";
        $.easyAjax({
            url: url,
            container: '#editPayCode',
            type: "PUT",
            data: $('#editPayCode').serialize(),
            success: function(response) {
                if (response.status == 'success') {
                    window.location.reload();
                }
            }
        })
    });
</script>
