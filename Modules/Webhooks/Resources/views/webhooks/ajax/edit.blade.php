<style>
    /* Add custom css here */
</style>

<div class="row">
    <div class="col-sm-12">
        <x-form id="save-webhook-form" method="PUT">
            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                    @lang('webhooks::app.webhooks')</h4>
                <div class="row p-20">
                    <div class="col-md-12">
                        <x-forms.text fieldId="name" :fieldLabel="__('webhooks::app.webhookName')" fieldName="name" :fieldRequired="true"
                            :popover="__('webhooks::modules.webhookName')" :fieldValue="$webhook->name">
                        </x-forms.text>
                    </div>

                    <div class="col-md-6">
                        <x-forms.label class="my-3" fieldId="webhook_for" :fieldLabel="__('webhooks::app.webhookFor')" :popover="__('webhooks::app.webhookFor')">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="webhook_for" id="webhook_for"
                                data-live-search="true">
                                @foreach (\Modules\Webhooks\Entities\WebhooksSetting::WEBHOOK_FOR as $webhookFor)
                                    <option value="{{ $webhookFor }}"
                                        @if ($webhookFor == $webhook->webhook_for) selected @endif>{{ $webhookFor }}</option>
                                @endforeach
                            </select>
                        </x-forms.input-group>
                    </div>
                    {{--
                    <div class="col-md-6">
                        <x-forms.label class="my-3" fieldId="create" :fieldLabel="__('webhooks::app.webhookAction')" :popover="__('webhooks::app.webhookAction')">
                        </x-forms.label>
                        <sup class="text-red f-14 mr-1">*</sup>

                        <div class="form-group">
                            <div class="d-flex">
                                <x-forms.radio fieldId="create" class="webhook_action"
                                    :fieldLabel="__('webhooks::modules.create')" fieldName="action"
                                    fieldValue="0" checked="true" :checked="$webhook->type == 0">
                                </x-forms.radio>

                                <x-forms.radio class="webhook_action" fieldId="service_type" :fieldLabel="__('webhooks::modules.delete')"
                                fieldValue="1" fieldName="action" :checked="$webhook->type == 1"></x-forms.radio>
                            </div>
                        </div>
                    </div> --}}
                </div>
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-top-grey">@lang('app.url')</h4>
                <div class="row p-20">

                    <div class="col-md-12">
                        <x-forms.text fieldId="request_url" :fieldLabel="__('webhooks::app.requestUrl')" fieldName="request_url" :fieldRequired="true"
                            :popover="__('webhooks::app.requestUrl')" :fieldValue="$webhook->url">
                        </x-forms.text>
                    </div>

                    <div class="col-md-6">
                        <x-forms.label class="my-3" :popover="__('webhooks::app.requestMethod')" fieldId="request_method" :fieldLabel="__('webhooks::app.requestMethod')">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="request_method" id="request_method"
                                data-live-search="true">
                                @foreach (\Modules\Webhooks\Entities\WebhooksSetting::METHODS as $method)
                                    <option value="{{ $method }}"
                                        @if ($method == $webhook->request_method) selected @endif>{{ $method }}</option>
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
                                <option value="json" @if ($webhook->request_format == 'JSON') selected @endif>
                                    @lang('webhooks::modules.json')</option>
                            </select>
                        </x-forms.input-group>
                    </div>
                </div>

                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-top-grey">
                    {{ __('webhooks::app.requestHeaders') }}</h4>
                <div class="row p-20">
                    <div class="col-md-12">
                        @forelse ($webhook->webhooksHeadersRequests as $item)
                            <div id="addMoreBox{{ $loop->iteration }}" class="row">
                                <div class="col-md-3 form-group header">
                                    @if ($loop->first)
                                    <x-forms.label class="mt-3" fieldId="headers_name" :fieldLabel="__('webhooks::modules.name')">
                                    </x-forms.label>
                                    @endif

                                    @if (in_array($item->headers_key, \Modules\Webhooks\Entities\WebhooksSetting::HEADERS))
                                        <select class="form-control select-picker" name="headers_name[]"
                                            id="headers_name" data-live-search="true">
                                            @foreach (\Modules\Webhooks\Entities\WebhooksSetting::HEADERS as $header)
                                                <option value="{{ $header }}"
                                                    @if ($header == $item->headers_key) selected @endif>
                                                    {{ $header }}</option>
                                            @endforeach
                                        </select>
                                    @else
                                        <input class="form-control height-35 f-14" name="headers_name[]" type="text"
                                            value="{{ $item->headers_key }}" />
                                    @endif

                                </div>
                                <div class="col-md-7 form-group">
                                    @if ($loop->first)
                                        <x-forms.label class="mt-3" fieldId="headers_value" :fieldLabel="__('webhooks::modules.value')">
                                        </x-forms.label>
                                    @endif

                                    <input class="form-control height-35 f-14" name="headers_value[]" type="text" value="{{ $item->headers_value }}" />
                                </div>
                                @if (!$loop->first)
                                    <div class="col-md-2">
                                        <div class="task_view"> <a href="javascript:;"
                                                class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle"
                                                onclick="removeBox({{ $loop->iteration }})"> <i
                                                    class="fa fa-trash icons mr-2"></i> @lang('app.delete')</a> </div>
                                    </div>
                                @endif
                            </div>
                        @empty
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
                        @endforelse

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
                        @forelse ($webhook->webhooksBodyRequests as $item)
                            <div id="addMoreBodyBox{{ $loop->iteration }}" class="row">
                                <div class="col-md-3">
                                    <div class="form-group">
                                        @if ($loop->first)
                                            <x-forms.label class="my-3" fieldId="body_key" :fieldLabel="__('webhooks::modules.key')">
                                            </x-forms.label>
                                        @endif
                                        <div class="form-group">
                                            <input class="form-control height-35 f-14" name="body_key[]" type="text"
                                                value="{{ $item->body_key }}" />
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-7">
                                    <div class="form-group">
                                        @if ($loop->first)
                                            <label class="f-14 text-dark-grey mb-12 my-3" data-label=""
                                                for="body_value">@lang('webhooks::modules.value')</label>
                                        @endif

                                        <input list="bodyValues" type="text" class="form-control height-35 f-14"
                                             value="{{ $item->body_value }}" name="body_value[]"
                                            id="body_value" autocomplete="off">
                                    </div>
                                </div>
                                @if ($loop->iteration !== 1)
                                    <div class="col-md-2 mt-0">
                                        <div class="task_view mt-1"> <a href="javascript:;"
                                                class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle"
                                                onclick="removeBodyBox({{ $loop->iteration }})"> <i
                                                    class="fa fa-trash icons mr-2"></i> @lang('app.delete')</a> </div>
                                    </div>
                                @endif
                            </div>
                        @empty
                            <div id="addMoreBodyBox1" class="row">
                                <div class="col-md-3">
                                    <div class="form-group">
                                        <x-forms.label class="my-3" fieldId="body_key" :fieldLabel="__('webhooks::modules.key')">
                                        </x-forms.label>
                                        <div class="form-group">
                                            <input class="form-control height-35 f-14" name="body_key[]"
                                                type="text" />
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-7">
                                    <div class="form-group">
                                        <div class="form-group my-3">
                                            <label class="f-14 text-dark-grey mb-12" data-label=""
                                                for="body_value">@lang('webhooks::modules.value')</label>

                                            <input list="bodyValues" type="text"
                                                class="form-control height-35 f-14"
                                                name="body_value[]" id="body_value" autocomplete="off">
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-2">&nbsp;</div>
                            </div>
                        @endforelse
                        <datalist id="bodyValues">
                        </datalist>
                        <div id="insertBodyBefore" class="row"></div>

                        <div class="col-md-12 mb-3">
                            <a class="f-15 f-w-500" href="javascript:;" data-repeater-create id="plusBodyButton"><i
                                    class="icons icon-plus font-weight-bold mr-1"></i>@lang('webhooks::app.addMore')
                            </a>
                        </div>

                    </div>

                </div>

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
                        <select class="form-control select-picker" name="headers_name[]" id="headers_name" data-live-search="true">
                            @foreach (\Modules\Webhooks\Entities\WebhooksSetting::HEADERS as $header) <option value="{{ $header }}">{{ $header }}</option>@endforeach
                        </select>
                    </div>
                    <div class="col-md-7 form-group">
                        <input class="form-control height-35 f-14" name="headers_value[]" type="text" />
                    </div>
                    <div class="col-md-2">
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
                                <input class="form-control height-35 f-14" name="body_key[]" type="text"  placeholder=""/>
                            </div>
                            <div class="col-md-7">
                                <input list="bodyValues" class="form-control height-35 f-14" name="body_value[]" type="text"  placeholder=""/>
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
            const url = "{{ route('webhooks.update', [$webhook->id]) }}";

            $.easyAjax({
                url: url,
                container: '#save-webhook-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-webhook-form",
                file: true,
                data: $('#save-webhook-form').serialize(),
                success: function(response) {
                    const redirectUrl = "{{ route('webhooks.index') }}";
                    window.location.href = redirectUrl;
                }
            });
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
                let input = `<input class="form-control height-35 f-14" name="headers_name[]" type="text"  placeholder=""/>`;
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
