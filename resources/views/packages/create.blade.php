<div class="modal-header">
    <h5 class="modal-title">@lang('app.add') @lang('app.menu.packages')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>
<x-form id="createPackage" method="POST" class="ajax-form">
    <div class="modal-body">
        <div class="portlet-body">
            <div class="row">
                <div class="col-sm-12">
                    <x-forms.text fieldId="name" :fieldLabel="__('app.name')" fieldName="name"
                        fieldRequired="true" :fieldPlaceholder="__('placeholders.name')">
                    </x-forms.text>
                </div>

                <div class="col-sm-12">
                    <x-forms.number class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('app.value')"
                        fieldName="value" fieldId="value" :fieldPlaceholder="__('placeholders.price')" 
                        fieldRequired="true" :fieldValue="0" />
                </div>

                <div class="col-sm-12">
                    <x-forms.textarea :fieldLabel="__('app.description')" 
                        :fieldPlaceholder="__('placeholders.description')"
                        fieldName="description" fieldId="description" />
                </div>

                <div class="col-sm-12">
                    <x-forms.text fieldId="customer_type_name" :fieldLabel="__('app.customerTypeName')" 
                        fieldName="customer_type_name" :fieldPlaceholder="__('app.customerTypeName')">
                    </x-forms.text>
                </div>

                <div class="col-sm-12">
                    <x-forms.textarea :fieldLabel="__('app.customerTypeDescription')" 
                        :fieldPlaceholder="__('app.customerTypeDescription')"
                        fieldName="customer_type_description" fieldId="customer_type_description" />
                </div>
            </div>
        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
        <x-forms.button-primary id="save-package-setting" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>

<script>
    $('#save-package-setting').click(function () {
        $.easyAjax({
            container: '#createPackage',
            type: "POST",
            disableButton: true,
            blockUI: true,
            buttonSelector: "#save-package-setting",
            url: "{{ route('packages.store') }}",
            data: $('#createPackage').serialize(),
            success: function (response) {
                if (response.status == 'success') {
                    window.location.reload();
                }
            }
        })
    });
</script>
