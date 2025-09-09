<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('app.edit') @lang('payroll::app.menu.overtimePolicy')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="updateOvertimePolicy" method="POST" class="ajax-form">
            @method('PUT')
            <div class="form-body">
                <div class="row">
                    <div class="col-lg-12">
                        <x-forms.text fieldId="name"
                                      :fieldLabel="__('app.name')" :fieldValue="$policy->name"
                                      fieldName="name" fieldRequired="true">
                        </x-forms.text>
                    </div>
                    <div class="col-lg-12">
                        <div class="form-group">
                            <x-forms.label fieldId="pay_code" :fieldLabel="__('payroll::app.menu.payCode')" fieldRequired="true" >
                            </x-forms.label>
                            <select class="form-control select-picker" name="pay_code"
                                id="pay_code" data-live-search="true" data-size="8">
                                @foreach($payCodes as $payCode)
                                    <option value="{{$payCode->id}}" @if($policy->pay_code_id == $payCode->id) selected @endif>{{ $payCode->name }} ({{$payCode->code}})</option>
                                @endforeach
                            </select>
                        </div>
                    </div>

                    <div class="col-lg-12 my-2">
                        <x-forms.checkbox :fieldLabel="__('payroll::modules.payroll.policyWorkingDays')" fieldName="working_days" fieldValue="yes"
                                            fieldId="working_days" fieldRequired="true" :checked="$policy ? $policy->working_days : ''"/>

                        <x-forms.checkbox :fieldLabel="__('payroll::modules.payroll.policyWeekOffDays')" fieldName="week_end" fieldValue="yes"
                                            fieldId="week_end" fieldRequired="true" :checked="$policy ? $policy->week_end : ''"/>

                        <x-forms.checkbox :fieldLabel="__('payroll::modules.payroll.policyHolidayDays')" fieldName="holiday" fieldValue="yes"
                                            fieldId="holiday"  :checked="$policy ? $policy->holiday : ''"/>
                    </div>

                    <div class="col-lg-12 my-2 d-flex">
                        <div class="form-description text-dark-grey">
                            <p> {{__('payroll::modules.payroll.before')}} </p>
                        </div>
                    <div class="input-radio-button mr-2 ml-2">
                             <select class="form-control" name="request_before_days" style="width:53px;">
                                @for ($i = 1; $i <= 31; $i++)
                                    <option value="{{ $i }}"  {{ $policy?->request_before_days == $i ? 'selected' : '' }}>{{ $i }}</option>
                                @endfor
                            </select>
                        </div>
                        <div class="form-description text-dark-grey">
                            <p>{{__('payroll::modules.payroll.dayCurrentMonth')}}
                                <i class="fa fa-question-circle" data-toggle="tooltip" data-original-title="{{__('payroll::messages.beforeDaysPopover')}}"></i>
                            </p>
                        </div>
                    </div>

                    <div class="col-lg-12 my-2">
                        <x-forms.checkbox :fieldLabel="__('payroll::modules.payroll.allowReportingManager')" fieldName="allow_reporting_manager" fieldValue="yes"
                                            fieldId="allow_reporting_manager" :checked="$policy ? $policy->allow_reporting_manager : ''"/>
                    </div>

                    <div class="col-lg-12">
                        <div class="form-group my-3">
                            @php
                            $storedRoles = $policy->allow_roles ? $policy->allow_roles : [];
                        @endphp
                            <x-forms.label fieldId="allow_roles" :fieldLabel="__('payroll::modules.payroll.allowRoles')">
                            </x-forms.label>
                            <select name="allow_roles[]" id="allow_roles" multiple class="form-control select-picker" data-size="8" >
                                @foreach($roles as $role)

                                    <option @if(in_array($role->id, $storedRoles))  selected @endif value="{{ $role->id }}">{{ $role->display_name }}</option>
                                @endforeach
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="updatePolicy" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>
    $('#pay_code').selectpicker();
    $('#allow_roles').selectpicker();
    // save source
    $('#updatePolicy').click(function (e) {
        e.preventDefault();

        $.easyAjax({
            url: "{{ route('overtime-policies.update', $policy->id) }}",
            container: '#updateOvertimePolicy',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#updatePolicy",
            data: $('#updateOvertimePolicy').serialize(),
            success: function (response) {
                console.log();
                $('#savePayCode').prop("disabled", false);
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        })
    });
</script>
