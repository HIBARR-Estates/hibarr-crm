<div class="row">
    <div class="col-md-12">
        <x-form id="update-key-results-form" method="POST" class="ajax-form">
            @csrf
            @method('PUT')

            <input type="hidden" name="key_results_id" id="key_results_id" value="{{ $keyResult->id }}">
            <input type="hidden" name="currentUrl" id="currentUrl" value="{{ $currentUrl }}">

            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal text-capitalize border-bottom-grey">
                    @lang('performance::app.editKeyResults')</h4>
                <div class="row p-20">
                    <div class="col-md-6">
                        <x-forms.label class="my-3" fieldId="objective_id" :fieldLabel="__('performance::app.objective')" fieldRequired="true">
                        </x-forms.label>
                        <span class="input-group-text" id="objective_id">{{ $keyResult->objective->title }}</span>
                        <input type="hidden" name="objective_id" id="objective_id" value="{{ $keyResult->objective->id }}">
                    </div>

                    <div class="col-md-6">
                        <x-forms.text fieldId="title" :fieldLabel="__('performance::app.keyResultsTitle')"
                            fieldName="title" :fieldRequired="true"
                            :fieldPlaceholder="__('performance::placeholders.keyResultsTitle')"
                            :fieldValue="$keyResult->title">
                        </x-forms.text>
                    </div>

                    <div class="col-md-12">
                        <x-forms.textarea
                            :fieldLabel="__('app.description')"
                            :fieldPlaceholder="__('app.description')"
                            fieldName="description"
                            fieldId="description"
                            :fieldValue="$keyResult->description" />
                    </div>

                    <div class="col-md-4">
                        <x-forms.label class="my-3" fieldId="metrics_id"
                            :fieldLabel="__('performance::app.metrics')"
                            fieldRequired="true">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="metrics_id" id="metrics_id"
                                data-live-search="true">
                                @foreach ($metrics as $metric)
                                <option value="{{ $metric->id }}"
                                    @if($keyResult->metrics_id == $metric->id) selected @endif>
                                    {{ $metric->name }}
                                </option>
                                @endforeach
                            </select>
                        </x-forms.input-group>
                    </div>

                    <div class="col-md-4">
                        <x-forms.number fieldName="current_value"
                            fieldId="current_value"
                            fieldLabel="{{ __('performance::app.currentValue') }}"
                            fieldRequired="true"
                            :fieldValue="$keyResult->original_current_value" />
                    </div>

                    <div class="col-md-4">
                        <x-forms.number fieldName="target_value"
                            fieldId="target_value"
                            fieldLabel="{{ __('performance::app.targetValue') }}"
                            fieldRequired="true"
                            :fieldValue="$keyResult->target_value" />
                    </div>

                </div>

                <x-form-actions>
                    <x-forms.button-primary id="update-key-results" class="mr-3" icon="check">@lang('app.update')
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="$currentUrl" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </x-form-actions>
            </div>
        </x-form>

    </div>
</div>

<script>
    $(document).ready(function() {
        $('.page-heading a[href]').contents().unwrap();

        $('.select-picker').selectpicker();

        $('#update-key-results').click(function() {
            const url = "{{ route('key-results.update', $keyResult->id) }}";
            var data = $('#update-key-results-form').serialize();

            if (url) {
                $.easyAjax({
                    url: url,
                    container: '#update-key-results-form',
                    type: "POST",
                    disableButton: true,
                    blockUI: true,
                    file: true,
                    data: data,
                    success: function(response) {
                        if (response.status == "success") {
                            let redirectUrl = response.redirectUrl;
                            window.location.href = redirectUrl;
                        }
                    }
                });
            }
        });

        init(RIGHT_MODAL);
    });
</script>
