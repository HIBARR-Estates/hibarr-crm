<div class="row">
    <div class="col-md-12">
        <x-form id="save-key-results-form">
            <input type="hidden" name="currentUrl" id="currentUrl" value="{{ $currentUrl }}">
            <div class="add-client bg-white rounded">
                <div class="form-header p-20">
                    <h4 class="mb-0 f-21 font-weight-normal text-capitalize">
                        @lang('performance::app.addKeyResults')
                    </h4>

                    @if ($objectiveId)
                        <div class="mt-3">
                            <div class="d-flex align-items-center">
                                <i class="fa fa-bullseye text-primary mr-2 f-16"></i>
                                <span class="text-muted f-14">@lang('performance::app.objective')</span>
                            </div>
                            <div class="d-flex align-items-center mt-1">
                                <h5 class="mb-0 f-18 text-dark">{{ $objectiveId->title }}</h5>
                            </div>
                        </div>
                    @endif
                </div>

                <div class="row p-20">
                    <div class="col-md-6 d-none">
                        <x-forms.label class="my-3" fieldId="objective_id" :fieldLabel="__('performance::app.objective')" fieldRequired="true">
                        </x-forms.label>
                        @if ($objectiveId)
                            <span class="input-group-text" id="objective_id">{{ $objectiveId->title }}</span>
                            <input type="hidden" name="objective_id" id="objective_id" value="{{ $objectiveId->id }}">
                        @else
                            <x-forms.input-group>
                                <select class="form-control select-picker" name="objective_id" id="objective_id" data-live-search="true">
                                    @foreach ($objectives as $objective)
                                        <option value="{{ $objective->id }}" @if ($objectiveId && $objectiveId->id == $objective->id) selected @endif>{{ $objective->title }}</option>
                                    @endforeach
                                </select>
                            </x-forms.input-group>
                        @endif
                    </div>

                    <div class="col-md-12">
                        <x-forms.text fieldId="title" :fieldLabel="__('performance::app.keyResultsTitle')" fieldName="title" :fieldRequired="true" :fieldPlaceholder="__('performance::placeholders.keyResultsTitle')">
                        </x-forms.text>
                    </div>

                    <div class="col-md-12">
                        <x-forms.textarea :fieldLabel="__('app.description')" :fieldPlaceholder="__('app.description')" fieldName="description" fieldId="description"/>
                    </div>

                    <div class="col-md-4">
                        <x-forms.label class="my-3" fieldId="metrics_id" :fieldLabel="__('performance::app.metrics')" fieldRequired="true">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="metrics_id" id="metrics_id"
                                data-live-search="true">
                                @foreach ($metrics as $metric)
                                    <option value="{{ $metric->id }}">{{ $metric->name }}</option>
                                @endforeach
                            </select>
                        </x-forms.input-group>
                    </div>

                    <div class="col-md-4">
                        <x-forms.number fieldName="current_value" fieldId="current_value" fieldLabel="{{ __('performance::app.currentValue') }}" fieldRequired="true"/>
                    </div>

                    <div class="col-md-4">
                        <x-forms.number fieldName="target_value" fieldId="target_value" fieldLabel="{{ __('performance::app.targetValue') }}" fieldRequired="true"/>
                    </div>
                </div>

                <x-form-actions>
                    <x-forms.button-primary id="save-key-results" class="mr-3" icon="check">@lang('app.save')
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

        let performanceTitle = @json(__('performance::app.performance'));
        let objectiveTitle = @json(__('performance::app.objective'));

        $('li .accordionItemHeading[title="' + performanceTitle + '"]').closest('li').removeClass('closeIt').addClass('openIt');
        $('a[title="'+ performanceTitle +'"], a[title="'+ objectiveTitle +'"]').addClass('active');

        $('.select-picker').selectpicker();

        $('#save-key-results').click(function() {
            const url = "{{ route('key-results.store') }}";
            var data = $('#save-key-results-form').serialize();

            if (url) {
                $.easyAjax({
                    url: url,
                    container: '#save-key-results-form',
                    type: "POST",
                    disableButton: true,
                    blockUI: true,
                    file: true,
                    data: data,
                    success: function(response) {
                        if (response.status == "success") {
                            window.location.href = "{{ $currentUrl }}";
                        }
                    }
                });
            }
        });

        init(RIGHT_MODAL);
    });
</script>

<style>
.form-header {
    background: #fff;
    border-bottom: 1px solid #e8eef3;
}

.form-header h4 {
    color: #1d1d1d;
}
</style>
