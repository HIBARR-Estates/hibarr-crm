<div class="row">
    <div class="col-md-12">
        <x-form id="save-action-data-form">
            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                    {{ __('performance::app.addActionPoints') }}</h4>
                <div class="row p-20">
                    <input type="hidden" name="meeting_id" value="{{ $meeting->id }}">
                    <input type="hidden" name="tab" value="{{ $tab }}">

                    <!-- Add Action Points -->
                    <div class="col-md-12">
                        <div id="addMoreBox1" class="row">
                            <div class="col-md-10 form-group">
                                <x-forms.label class="mt-3" fieldId="action_points" :fieldLabel="__('performance::modules.actionPoints')"
                                    fieldRequired="true">
                                </x-forms.label>
                                <input class="form-control height-35 f-14" id="action_points"
                                    name="action_points[]" type="text" />
                            </div>
                            <div class="col-md-2">&nbsp;</div>
                        </div>

                        <div id="insertBefore" class="row"></div>

                        <div class="col-md-12 mb-2">
                            <a class="f-15 f-w-500" href="javascript:;" data-repeater-create id="plusButton"><i
                                    class="icons icon-plus font-weight-bold mr-1"></i>@lang('webhooks::app.addMore')
                            </a>
                        </div>
                    </div>
                </div>

                <x-form-actions>
                    <x-forms.button-primary id="save-action-form" class="mr-3 openRightModal"
                        icon="check">@lang('app.save')
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="route('meetings.index')" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </x-form-actions>
            </div>
        </x-form>
    </div>
</div>

<script>
    $(document).ready(function() {
        // Add More Inputs
        const $insertBefore = $('#insertBefore');
        let i = 0;

        $('#plusButton').click(function() {
            i++;
            const index = i + 1;

            const template = `<div id="addMoreBox${index}" class="row mt-3 mb-3">
                    <div class="col-md-10 form-group">
                        <input class="form-control height-35 f-14" id="action_points" name="action_points[]" type="text"/>
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
        });

        // Submit Meeting Form
        $('#save-action-form').click(function() {
            $.easyAjax({
                url: "{{ route('action.store') }}",
                container: '#save-action-data-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-action-form",
                data: $('#save-action-data-form').serialize(),
                success: function(response) {
                    if (response.status == 'success') {
                        let tab = response.tab;

                        if (tab == 'list') {
                            window.location.href = "{{ route('meetings.index') }}";
                        }
                        else {
                            window.location.href = "{{ route('meetings.calendar_view') }}";
                        }
                    }
                }
            });
        });
    });

    // Remove fields
    function removeBox(index) {
        $('#addMoreBox' + index).remove();
    }
</script>
