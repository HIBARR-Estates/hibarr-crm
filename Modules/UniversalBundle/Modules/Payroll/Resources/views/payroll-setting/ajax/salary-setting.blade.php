<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    <h5>@lang('payroll::modules.payroll.fieldToShow')<i class="f-14 text-dark-grey mb-10 ml-1 fa fa-question-circle" data-toggle="popover" data-placement="top" data-content="@lang('payroll::modules.payroll.fieldToShowMessage')" data-html="true" data-trigger="hover"></i></h5>
    @if (isset($fields) && sizeof($fields) > 0)

        <div class="my-4 d-flex">
            <x-forms.checkbox :checked="$fields->count() == sizeof($extraFields)"
                              :fieldLabel="__('modules.permission.selectAll')" fieldName="select_all_field"
                              class="select_all_permission" fieldId="select_all_field"/>
        </div>
        <div class="d-flex">
            @foreach ($fields as $field)
                <x-forms.checkbox :checked="in_array($field->id,$extraFields)" :fieldLabel="ucwords($field->label)"
                                  :fieldName="$field->name" class="module_checkbox"
                                  :fieldId="$field->name.'-'.$field->label"/>
            @endforeach
        </div>
    @else
        <x-cards.no-record icon="list" :message="__('payroll::modules.payroll.noRecord')"/>
    @endif

</div>

@if (isset($fields) && sizeof($fields) > 0)
    <div class="w-100 border-top-grey set-btns">
        <x-setting-form-actions>
            <x-forms.button-primary id="save-form" class="mr-3" icon="check">@lang('app.save')
            </x-forms.button-primary>
        </x-setting-form-actions>
    </div>
@endif

<script type="text/javascript">
    var selectAllCheckbox = document.querySelector('.select_all_permission');
    var checkboxes = document.querySelectorAll('.module_checkbox');

    // Listen for changes on each checkbox
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // If no checkboxes are checked, uncheck the select all checkbox
            selectAllCheckbox.checked = false;
        });
    });

    $('.select_all_permission').change(function () {
        if ($(this).is(':checked')) {
            $('.module_checkbox').prop('checked', true);
        } else {
            $('.module_checkbox').prop('checked', false);
        }
    });

    $('#save-form').click(function () {
        var url = "{{ route('salary-settings.update', $payrollSetting->id) }}";
        $.easyAjax({
            url: url,
            container: '#editSettings',
            type: "POST",
            redirect: true,
            disableButton: true,
            blockUI: true,
            data: $('#editSettings').serialize(),
            buttonSelector: "#save-form",
        })
    });

    setTimeout(function () {
        $(document).ready(function () {
            $('[data-toggle="popover"]').popover();
        });
    }, 100);
</script>
