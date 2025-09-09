<div class="modal-header">
    <h5 class="modal-title">@lang('cybersecurity::app.addUser')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>
<x-form id="login-expiry-form" method="POST" class="ajax-form">
    <div class="modal-body">
        <div class="row d-flex align-items-baseline">
            <div class="form-group my-3 col-md-6 col-lg-6">
                <x-forms.label class="my-3" fieldId="selectEmployee" fieldRequired="true"
                               :fieldLabel="__('cybersecurity::app.user')">
                </x-forms.label>

                <x-forms.input-group>
                    <select class="form-control multiple-users" name="user_id"
                            id="selectEmployee" data-live-search="true" data-size="8">
                        <option value="none">@lang('cybersecurity::app.nothingSelected')</option>
                        @foreach ($employees as $item)
                            <x-user-option
                                :user="$item"
                                :pill="true"
                            />
                        @endforeach
                    </select>
                </x-forms.input-group>
            </div>
            <div class="col-md-6 col-lg-4">
                <x-forms.datepicker fieldId="expiry_date" fieldRequired="true"
                                    :fieldLabel="__('cybersecurity::app.expiryDate')" fieldName="expiry_date"
                                    :fieldPlaceholder="__('placeholders.date')"
                                     />
            </div>

        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
        <x-forms.button-primary id="save-login-expiry" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>


<script>
    $(document).ready(function () {
        const dp1 = datepicker('#expiry_date', {
            position: 'bl',
            onSelect: (instance, date) => {
                dp1.setMax(date);
            },
            ...datepickerConfig
        });

        $("#selectEmployee").selectpicker({
            actionsBox: true,
            selectedTextFormat: "count > 8",
            countSelectedText: function (selected, total) {
                return selected + " {{ __('app.membersSelected') }} ";
            }
        });
    });

    $('#save-login-expiry').click(function () {
        $.easyAjax({
            container: '#login-expiry-form',
            type: "POST",
            disableButton: true,
            blockUI: true,
            buttonSelector: "#save-login-expiry",
            url: "{{ route('cybersecurity.login-expiry.store') }}",
            data: $('#login-expiry-form').serialize(),
            success: function (response) {
                if (response.status === 'success') {
                    window.location.reload();
                }
            }
        })
    });
</script>
