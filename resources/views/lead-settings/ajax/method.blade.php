<div class="table-responsive p-20">

    <x-form id="save-lead-status" method="POST">
        <input type="hidden" name="company_id" id="company_id" value="{{$company->id}}" />
        <input type="hidden" name="user_id" id="user_id" value="{{$user->id}}" />
        <div class="col-lg-4">
            <x-forms.toggle-switch class="mr-0 mr-lg-12" :checked="$leadSettings != null ? $leadSettings->status : false"
                :fieldLabel="__('modules.deal.dealMethod')" fieldName="lead_setting_status"
                fieldId="lead_setting_status"/>
        </div>
    </x-form>
    <x-alert type="warning">
    <div><br><b>Information:</b><br><br>@lang('modules.deal.roundrobinNote')<br>
        <br>&bull;@lang('modules.deal.equalDistribution')
        <br>&bull;@lang('modules.deal.sequentialAssignment')
        <br>&bull;@lang('modules.deal.fairRotation')
        <br>@lang('modules.deal.roundrobinExLead')
    </div>
</x-alert>

    <hr>

    <x-form id="save-first-contact-sla" method="PUT">
        <div class="col-lg-4 p-0">
            <x-forms.number :fieldLabel="__('modules.deal.firstContactSla')"
                fieldName="first_contact_sla_hours" fieldId="first_contact_sla_hours"
                :fieldValue="$leadSettings->first_contact_sla_hours ?? $slaHoursDefault"
                :fieldRequired="true" :minValue="$slaHoursMin" :maxValue="$slaHoursMax"
                :fieldHelp="__('modules.deal.firstContactSlaHelp')" />
        </div>
        <div class="col-lg-12 p-0 mt-3">
            <x-forms.button-primary id="save-first-contact-sla-btn" icon="check">
                @lang('app.save')
            </x-forms.button-primary>
        </div>
    </x-form>
</div>

<script>
$(document).ready(function () {
    $('#lead_setting_status').click(function () {
        var status = document.getElementById('lead_setting_status').checked ? 1 : 0;
        var companyID = document.getElementById('company_id').value;
        var userID = document.getElementById('user_id').value;
        var token = '{{ csrf_token() }}';

        var url = "{{ route('lead-setting.update_status', ':id') }}";
        url = url.replace(':id', companyID);

        $.easyAjax({
            type: 'POST',
            url: url,
            container: '#save-lead-status',
            blockUI: true,
            data: {
                '_token': token,
                lead_setting_status: status,
                id: companyID,
                userId: userID,
                requestFromTicket: 'no',
            },
            success: function (response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        })
    });

    // No reload on success: the value the user just typed is already on screen,
    // and reloading this tab throws away their place in the settings screen.
    $('#save-first-contact-sla-btn').click(function () {
        $.easyAjax({
            type: 'PUT',
            url: "{{ route('lead-settings.first-contact-sla') }}",
            container: '#save-first-contact-sla',
            blockUI: true,
            data: $('#save-first-contact-sla').serialize(),
        })
    });
});
</script>
