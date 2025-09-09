<div class="row">
    <div class="col-md-12">
        <x-form id="save-agenda-data-form">
            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                    {{ __('performance::app.addDiscussionPoint') }}</h4>
                <div class="row p-20">
                    <input type="hidden" name="meeting_id" value="{{ $meeting->id }}">
                    <input type="hidden" name="tab" value="{{ $tab }}">

                    @if ($meeting)
                        <div class="col-md-6 mt-2">
                            <x-cards.data-row :label="__('performance::modules.startOn')" :value="$meeting->start_date_time->translatedFormat(
                                company()->date_format . ' - ' . company()->time_format,
                            )" html="true" />

                            <div class="col-12 px-0 pb-3 d-flex mt-3">
                                <p class="mb-0 text-lightest f-14 w-30 d-inline-block ">
                                @lang('performance::app.meetingBy')</p>
                                <p class="mb-0 text-dark-grey f-14">
                                    <x-employee :user="$meeting->meetingBy" />
                                </p>
                            </div>
                        </div>

                        <div class="col-md-6 mt-2">
                            <x-cards.data-row :label="__('performance::modules.endOn')" :value="$meeting->end_date_time->translatedFormat(
                                company()->date_format . ' - ' . company()->time_format,
                            )" html="true" />

                            <div class="col-12 px-0 pb-3 d-flex mt-3">
                                <p class="mb-0 text-lightest f-14 w-30 d-inline-block ">
                                @lang('performance::app.meetingFor')</p>
                                <p class="mb-0 text-dark-grey f-14">
                                    <x-employee :user="$meeting->meetingFor" />
                                </p>
                            </div>
                        </div>
                    @endif

                    <!-- Add Discussion Points -->
                    <div class="col-md-12">
                        <div id="addMoreBox1" class="row">
                            <div class="col-md-8 form-group">
                                <x-forms.label class="mt-3" fieldId="discussion_points" :fieldLabel="__('performance::modules.discussionPoints')"
                                    fieldRequired="true">
                                </x-forms.label>
                                <input class="form-control height-35 f-14" id="discussion_points"
                                    name="discussion_points[1]" type="text" />
                            </div>
                            <div class="col-md-2 mt-5">
                                <x-forms.checkbox class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('performance::app.keepPrivate')"
                                    fieldName="keep_private[1]" fieldId="keep_private" fieldValue="yes"
                                    fieldRequired="true" />
                            </div>
                            <div class="col-md-2">&nbsp;</div>
                        </div>

                        <div id="insertBefore" class="row"></div>

                        <div class="col-md-12 mb-2">
                            <a class="f-15 f-w-500" href="javascript:;" data-repeater-create id="plusButton"><i
                                    class="icons icon-plus font-weight-bold mr-1"></i>@lang('performance::app.addMore')
                            </a>
                        </div>
                    </div>
                </div>

                <x-form-actions>
                    <x-forms.button-primary id="save-agenda-form" class="mr-3 openRightModal"
                        icon="check">@lang('app.save')
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="route('meetings.calendar_view')" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </x-form-actions>
            </div>
        </x-form>
    </div>
</div>

<script>

    $(document).ready(function() {
        let performanceTitle = @json(__('performance::app.performance'));
        let meetingTitle = @json(__('performance::app.oneOnOnemeetings'));

        $('a[title="'+ meetingTitle +'"], a[title="'+ performanceTitle +'"]').addClass('active');
        $('li .accordionItemHeading[title="'+ performanceTitle +'"]').closest('li').removeClass('closeIt').addClass('openIt');

        // Add More Inputs
        const $insertBefore = $('#insertBefore');
        let i = 0;

        $('#plusButton').click(function() {
            i++;
            const index = i + 1;

            const template = `<div id="addMoreBox${index}" class="row mt-3 mb-3">
                <div class="col-md-8 form-group">
                    <input class="form-control height-35 f-14" id="discussion_points_${index}" name="discussion_points[${index}]" type="text"/>
                </div>
                <div class="col-md-2 mt-0">
                    <x-forms.checkbox class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('performance::app.keepPrivate')"
                        fieldName="keep_private[${index}]" fieldId="keep_private_${index}" fieldValue="yes"
                        fieldRequired="true" />
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
        $('#save-agenda-form').click(function() {
            $.easyAjax({
                url: "{{ route('agenda.store') }}",
                container: '#save-agenda-data-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-agenda-form",
                data: $('#save-agenda-data-form').serialize(),
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
