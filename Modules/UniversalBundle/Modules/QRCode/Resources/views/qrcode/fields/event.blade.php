<div class="col-md-6">
    <x-forms.text :fieldLabel="__('qrcode::app.fields.eventTitle')" fieldName="title" fieldId="title" :fieldRequired="true" :fieldValue="$formFields['title'] ?? ''"/>
</div>
<div class="col-md-6">
    <x-forms.text :fieldLabel="__('qrcode::app.fields.location')" fieldName="location" fieldId="location" :fieldValue="$formFields['location'] ?? ''"/>
</div>
<div class="col-lg-3 col-md-6">
    <x-forms.datepicker fieldId="start_date" fieldRequired="true" :fieldLabel="__('modules.events.startOnDate')" fieldName="start_date"
        :fieldValue="isset($formFields['start_date']) ? \Carbon\Carbon::parse($formFields['start_date'])->format(company()->date_format) : now(company()->timezone)->format(company()->date_format)" :fieldPlaceholder="__('placeholders.date')" />
</div>

<div class="col-lg-3 col-md-6">
    <div class="bootstrap-timepicker timepicker">
        <x-forms.text :fieldLabel="__('modules.events.startOnTime')" :fieldPlaceholder="__('placeholders.hours')" fieldName="start_time" fieldId="start_time" :fieldValue="$formFields['start_time'] ?? ''"
        fieldRequired="true" />
    </div>
</div>

<div class="col-lg-3 col-md-6">
    <x-forms.datepicker fieldId="end_date" fieldRequired="true" :fieldLabel="__('modules.events.endOnDate')" fieldName="end_date" :fieldValue="isset($formFields['end_date']) ? \Carbon\Carbon::parse($formFields['end_date'])->format(company()->date_format) : now(company()->timezone)->format(company()->date_format)"
        :fieldPlaceholder="__('placeholders.date')" />
</div>

<div class="col-lg-3 col-md-6">
    <div class="bootstrap-timepicker timepicker">
        <x-forms.text :fieldLabel="__('modules.events.endOnTime')" :fieldPlaceholder="__('placeholders.hours')" fieldName="end_time" fieldId="end_time"
            :fieldValue="$formFields['end_time'] ?? ''" fieldRequired="true" />
    </div>
</div>
<div class="col-md-6">
    <x-forms.select fieldId="reminder" :fieldLabel="__('qrcode::app.fields.reminder')" fieldName="reminder">
        <option value="">--</option>
        <option @selected('PT0M' == ($formFields['reminder'] ?? '')) value="PT0M">@lang('qrcode::app.event.reminder.start')</option>
        <option @selected('-PT5M' == ($formFields['reminder'] ?? '')) value="-PT5M">@lang('qrcode::app.event.reminder.5m')</option>
        <option @selected('-PT10M' == ($formFields['reminder'] ?? '')) value="-PT10M">@lang('qrcode::app.event.reminder.10m')</option>
        <option @selected('-PT15M' == ($formFields['reminder'] ?? '')) value="-PT15M">@lang('qrcode::app.event.reminder.15m')</option>
        <option @selected('-PT30M' == ($formFields['reminder'] ?? '')) value="-PT30M">@lang('qrcode::app.event.reminder.30m')</option>
        <option @selected('-PT1H' == ($formFields['reminder'] ?? '')) value="-PT1H">@lang('qrcode::app.event.reminder.1h')</option>
        <option @selected('-PT2H' == ($formFields['reminder'] ?? '')) value="-PT2H">@lang('qrcode::app.event.reminder.2h')</option>
        <option @selected('-PT3H' == ($formFields['reminder'] ?? '')) value="-PT3H">@lang('qrcode::app.event.reminder.3h')</option>
        <option @selected('-PT4H' == ($formFields['reminder'] ?? '')) value="-PT4H">@lang('qrcode::app.event.reminder.4h')</option>
        <option @selected('-PT5H' == ($formFields['reminder'] ?? '')) value="-PT5H">@lang('qrcode::app.event.reminder.5h')</option>
        <option @selected('-PT6H' == ($formFields['reminder'] ?? '')) value="-PT6H">@lang('qrcode::app.event.reminder.6h')</option>
        <option @selected('-PT12H' == ($formFields['reminder'] ?? '')) value="-PT12H">@lang('qrcode::app.event.reminder.12h')</option>
        <option @selected('-PT24H' == ($formFields['reminder'] ?? '')) value="-PT24H">@lang('qrcode::app.event.reminder.24h')</option>
        <option @selected('-PT48H' == ($formFields['reminder'] ?? '')) value="-PT48H">@lang('qrcode::app.event.reminder.48h')</option>
        <option @selected('-PT168H' == ($formFields['reminder'] ?? '')) value="-PT168H">@lang('qrcode::app.event.reminder.1w')</option>
    </x-forms.select>
</div>
<div class="col-md-6">
    <div class="form-group my-3">
        <x-forms.label fieldId="link" :fieldLabel="__('qrcode::app.fields.link')"/>
        <input type="url" class="form-control height-35 f-14" placeholder="http://" name="link" id="link" value="{{ $formFields['link'] ?? '' }}">
    </div>
</div>
<div class="col-md-12">
    <x-forms.textarea class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('app.note')" fieldName="note" fieldId="note" :fieldValue="$formFields['note'] ?? ''">
    </x-forms.textarea>
</div>

<script>
    $(document).ready(function() {
        const dp1 = datepicker('#start_date', {
            position: 'bl',
            onSelect: (instance, date) => {
                if (typeof dp2.dateSelected !== 'undefined' && dp2.dateSelected.getTime() < date
                    .getTime()) {
                    dp2.setDate(date, true)
                }
                if (typeof dp2.dateSelected === 'undefined') {
                    dp2.setDate(date, true)
                }
                dp2.setMin(date);
            },
            ...datepickerConfig
        });


        const dp2 = datepicker('#end_date', {
            position: 'bl',
            onSelect: (instance, date) => {
                dp1.setMax(date);
            },
            ...datepickerConfig
        });

        $('#start_time, #end_time').timepicker({
            @if (company()->time_format == 'H:i')
                showMeridian: false,
            @endif
        });
    });
</script>
