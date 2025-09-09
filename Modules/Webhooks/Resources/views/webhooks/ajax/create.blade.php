<style>
    /* Add custom css here */
</style>

<div class="row">
    <div class="col-sm-12">
        <x-form id="save-webhook-form">

            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                    @lang('webhooks::app.webhooks')</h4>
                <div class="row p-20">
                    <div class="col-md-12">
                        <x-forms.text fieldId="name" :fieldLabel="__('webhooks::app.webhookName')" fieldName="name" :fieldRequired="true"
                            :popover="__('webhooks::modules.webhookName')" :fieldPlaceholder="__('webhooks::placeholders.webhookName')">
                        </x-forms.text>
                    </div>

                    <div class="col-md-6">
                        <x-forms.label class="my-3" fieldId="webhook_for" :fieldLabel="__('webhooks::app.webhookFor')" :popover="__('webhooks::app.webhookFor')">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="webhook_for" id="webhook_for"
                                data-live-search="true">
                                @foreach (\Modules\Webhooks\Entities\WebhooksSetting::WEBHOOK_FOR as $webhookFor)
                                    <option value="{{ $webhookFor }}">{{ $webhookFor }}</option>
                                @endforeach
                            </select>
                        </x-forms.input-group>
                    </div>

                    {{-- <div class="col-md-6">
                        <x-forms.label class="my-3" fieldId="webhook_action"
                                       :fieldLabel="__('webhooks::app.webhookAction')"
                                       :popover="__('webhooks::app.webhookAction')">
                        </x-forms.label>
                        <div class="form-group">
                            <div class="d-flex">
                                <x-forms.radio fieldId="create" class="webhook_action"
                                               :fieldLabel="__('webhooks::modules.create')"
                                               fieldName="action" fieldValue="0" checked>
                                </x-forms.radio>

                                <x-forms.radio class="webhook_action" fieldId="delete"
                                               :fieldLabel="__('webhooks::modules.delete')"
                                               fieldValue="1" fieldName="action">
                                </x-forms.radio>
                            </div>
                        </div>
                    </div> --}}
                </div>
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-top-grey">URL</h4>
                <div class="row p-20">

                    <div class="col-md-12">
                        <x-forms.text fieldId="request_url" :fieldLabel="__('webhooks::app.requestUrl')" fieldName="request_url" :fieldRequired="true"
                            :popover="__('webhooks::app.requestUrl')" :fieldPlaceholder="__('webhooks::app.requestUrl')">
                        </x-forms.text>
                    </div>

                    <div class="col-md-6">
                        <x-forms.label class="my-3" :popover="__('webhooks::app.requestMethod')" fieldId="request_method" :fieldLabel="__('webhooks::app.requestMethod')">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="request_method" id="request_method"
                                data-live-search="true">
                                @foreach (\Modules\Webhooks\Entities\WebhooksSetting::METHODS as $method)
                                    <option value="{{ $method }}">{{ $method }}</option>
                                @endforeach

                            </select>
                        </x-forms.input-group>
                    </div>

                    <div class="col-md-6">
                        <x-forms.label class="my-3" :popover="__('webhooks::app.requestFormat')" fieldId="request_format" :fieldLabel="__('webhooks::app.requestFormat')">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="request_format" id="request_format"
                                data-live-search="true">
                                <option value="json">@lang('webhooks::modules.json')</option>
                            </select>
                        </x-forms.input-group>
                    </div>
                </div>

                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-top-grey">
                    {{ __('webhooks::app.requestHeaders') }}</h4>
                <div class="row p-20">
                    <div class="col-md-12">
                        <div id="addMoreBox1" class="row">
                            <div class="col-md-3 form-group header">
                                <x-forms.label class="mt-3" fieldId="headers_name" :fieldLabel="__('webhooks::modules.name')">
                                </x-forms.label>
                                <select class="form-control select-picker" name="headers_name[]"
                                    data-live-search="true">
                                    @foreach (\Modules\Webhooks\Entities\WebhooksSetting::HEADERS as $header)
                                        <option value="{{ $header }}">{{ $header }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-7 form-group">
                                <x-forms.label class="mt-3" fieldId="headers_value" :fieldLabel="__('webhooks::modules.value')">
                                </x-forms.label>
                                <input class="form-control height-35 f-14" name="headers_value[]" type="text" />
                            </div>
                            <div class="col-md-2">&nbsp;</div>
                        </div>

                        <div id="insertBefore" class="row"></div>

                        <div class="col-md-12 mb-3">
                            <a class="f-15 f-w-500" href="javascript:;" data-repeater-create id="plusButton"><i
                                    class="icons icon-plus font-weight-bold mr-1"></i>@lang('webhooks::app.addMore')
                            </a>
                        </div>

                    </div>
                </div>
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-top-grey">
                    {{ __('webhooks::app.requestBody') }}</h4>
                <div class="row p-20">

                    <div class="col-md-12">
                        <div id="addMoreBodyBox1" class="row">
                            <div class="col-md-3">
                                <div class="form-group">
                                    <x-forms.label class="my-3" fieldId="body_key" :fieldLabel="__('webhooks::modules.key')">
                                    </x-forms.label>
                                    <div class="form-group">
                                        <input class="form-control height-35 f-14" name="body_key[]" type="text"
                                            value="" placeholder="" />
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-7">
                                <div class="form-group">
                                    <div class="form-group my-3">
                                        <label class="f-14 text-dark-grey mb-12" data-label=""
                                            for="body_value">@lang('webhooks::modules.value')</label>

                                        <input list="bodyValues" type="text" class="form-control height-35 f-14"
                                            placeholder="" value="" name="body_value[]" autocomplete="off">
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-2">&nbsp;</div>
                        </div>

                        <div id="insertBodyBefore" class="row"></div>
                        <datalist id="bodyValues">
                        </datalist>
                        <div class="col-md-12 mb-3">
                            <a class="f-15 f-w-500" href="javascript:;" data-repeater-create id="plusBodyButton"><i
                                    class="icons icon-plus font-weight-bold mr-1"></i>@lang('webhooks::app.addMore')
                            </a>
                        </div>

                    </div>

                </div>

                <x-forms.custom-field :fields="$fields"></x-forms.custom-field>

                <x-form-actions>
                    <x-forms.button-primary id="save-webhook" class="mr-3" icon="check">@lang('app.save')
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="route('webhooks.index')" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </x-form-actions>
            </div>
        </x-form>

    </div>
</div>

<script>
    function dataListUpdate() {
        let webhookFor = $('#webhook_for').val();
        let url = "{{ route('webhooks.webhooks_for_variable', ':webhookFor') }}";
        url = url.replace(':webhookFor', webhookFor);

        $.easyAjax({
            type: 'GET',
            url: url,
            blockUI: false,
            success: function(response) {
                let dataList = $('#bodyValues');
                dataList.empty();
                $.each(response.options, function(index, value) {
                    dataList.append(`<option value="${value}">`);
                });
            }
        });
    }
    $(document).ready(function() {

        const $insertBefore = $('#insertBefore');

       // Add More Inputs
        let i = 0; // Initialize the variable i outside the click function

        $('#plusButton').click(function() {
            i++; // Increment the value of i inside the click function
            const index = i + 1; // Update the index variable

           // Create the HTML template using backticks and template literals for improved readability
            const template = `<div id="addMoreBox${index}" class="row mt-3 mb-3">
                    <div class="col-md-3 form-group header">
                        <select class="form-control select-picker" name="headers_name[]" data-live-search="true">
                            @foreach (\Modules\Webhooks\Entities\WebhooksSetting::HEADERS as $header) <option value="{{ $header }}">{{ $header }}</option>@endforeach
                        </select>
                    </div>
                    <div class="col-md-7 form-group">
                        <input class="form-control height-35 f-14" name="headers_value[]" type="text" value="" placeholder=""/>
                    </div>
                    <div class="col-md-2 mt-0">
                        <div class="task_view">
                            <a href="javascript:;" class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" onclick="removeBox(${index})">
                                <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                            </a>
                        </div>
                    </div>
                </div>`;

            $(template).insertBefore($insertBefore);
            $(".select-picker").selectpicker(); // Moved this line to be executed after insertion
        });


        let insertBodyBefore = $('#insertBodyBefore');
        let x = 1;

        $('#plusBodyButton').click(function() {
            x++;
            let indexNum = x + 1;
            let template = `
                    <div id="addMoreBodyBox${indexNum}" class="row mt-3 mb-3">
                        <div class="col-md-3">
                            <input class="form-control height-35 f-14" name="body_key[]" type="text" value="" placeholder=""/>
                        </div>
                        <div class="col-md-7">
                            <input list="bodyValues" class="form-control height-35 f-14" name="body_value[]" type="text" value="" placeholder=""/>
                        </div>
                        <div class="col-md-2 mt-0">
                            <div class="task_view">
                                <a href="javascript:;" class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" onclick="removeBodyBox(${indexNum})">
                                    <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                                </a>
                            </div>
                        </div>
                    </div>`;

            $(template).insertBefore(insertBodyBefore);
            $(".select-picker").selectpicker();
        });

        $('#save-webhook').click(function() {

            const url = "{{ route('webhooks.store') }}";
            var data = $('#save-webhook-form').serialize();

            if (url) {
                $.easyAjax({
                    url: url,
                    container: '#save-webhook-form',
                    type: "POST",
                    disableButton: true,
                    blockUI: true,
                    file: true,
                    data: data,
                    success: function(response) {
                        if (response.status == "success") {
                            const redirectUrl = "{{ route('webhooks.index') }}";
                            window.location.href = redirectUrl;
                        }
                    }
                });
            }
        });

        $('body').on('change', '#webhook_for', function() {
            dataListUpdate();
        });

        $('body').on('change', '.header select', function() {
            let value = $(this).val();
            if (value == 'custom') {
                $(this).selectpicker('destroy');
                let parent = $(this).parent();
                $(this).remove();
                let label = parent.html();
                let input = `<input class="form-control height-35 f-14" name="headers_name[]" type="text" value="" placeholder=""/>`;
                parent.html(label + input);
            }
        });
        init(RIGHT_MODAL);
        dataListUpdate();
    });

   // Remove fields
    function removeBox(index) {
        $('#addMoreBox' + index).remove();
    }

   // Remove fields
    function removeBodyBox(index) {
        $('#addMoreBodyBox' + index).remove();
    }
</script>
