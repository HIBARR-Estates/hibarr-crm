<style>
    #event-status2 {
        border-radius: 0 5px 5px 0;
    }

    #event-status {
        border-radius: 5px 0 0 5px;
    }

    .meeting-status-container {
        display: flex;
        justify-content: flex-end;
        margin-right: 1.5rem;
    }

    .status-badge {
        padding: 0.25rem 0;
    }

    .status-indicator {
        display: inline-flex;
        align-items: center;
        padding: 0.4rem 0.8rem;
        border-radius: 4px;
        font-size: 0.875rem;
        font-weight: 500;
        color: #666;
        background-color: #f8f9fa;
        border: 1px solid #e9ecef;
    }

    .status-success {
        color: #0a875a;
        background-color: #e6f4ef;
        border-color: #d1e7df;
    }

    .status-danger {
        color: #dc3545;
        background-color: #fbe9eb;
        border-color: #f5d1d5;
    }
</style>

<div id="task-detail-section">
    <div class="row">
        <div class="col-md-12">
            <div class="card bg-white border-0 b-shadow-4">
                @if ($hasAccess)
                <div class="card-header bg-white  border-bottom-grey  justify-content-between p-20">
                    <div class="row">
                        <div class="col-lg-8 col-10">
                            <!-- Meeting-Detail Tab Link -->
                            <x-forms.button-primary icon="check" data-status="completed"
                                class="mr-2 mb-2 mb-lg-0 mb-md-0 float-left d-none actionBtn detail-btn" id="markAsComplete">
                                @lang('modules.tasks.markComplete')
                            </x-forms.button-primary>
                            <x-forms.button-secondary icon="times" data-status="cancelled"
                                class="mr-2 mb-2 mb-lg-0 mb-md-0 float-left d-none actionBtn detail-btn text-danger" id="markAsCancel">
                                @lang('performance::messages.markAsCancel')
                            </x-forms.button-secondary>
                            @if ($meeting->status == 'pending' && (user()->id == $meeting->meeting_for || in_array('client', user_roles()) || user()->id == $meeting->added_by))
                                <x-forms.button-secondary icon="paper-plane sendReminder" data-status="send-reminder"
                                    class="mr-2 mb-2 mb-lg-0 mb-md-0 float-left d-none actionBtn detail-btn text-danger" id="sendReminder">
                                    @lang('modules.accountSettings.sendReminder')
                                </x-forms.button-secondary>
                            @endif

                            <!-- Action Tab Link -->
                            @if ($meeting->goal)
                                <x-forms.link-secondary :link="route('objectives.show', $meeting->goal->id)"  class="mr-3 openRightModal float-left mb-2 mb-lg-0 mb-md-0 actionBtn d-none action-btn" icon="eye" data-status="add-goal">
                                @lang('performance::app.viewGoal')
                                </x-forms.link-secondary>
                            @else
                                <x-forms.link-primary :link="route('objectives.create') . '?requestFrom=meeting&meetingId=' . $meeting->id" class="mr-3 openRightModal float-left mb-2 mb-lg-0 mb-md-0 actionBtn d-none action-btn" icon="plus" data-status="add-goal">
                                @lang('performance::app.addGoal')
                                </x-forms.link-primary>
                            @endif
                        </div>
                        <div class="col-4 col-lg-4 d-flex justify-content-end text-right">
                            <div class="meeting-status-container">
                                <div class="status-badge @if ($meeting->status != 'completed') d-none @endif text-center" id="completeStatusDiv">
                                    <span class="status-indicator status-success">
                                        <i class="fa fa-check-circle mr-1"></i>
                                        {{ __('performance::app.markedAscompleted') }}
                                    </span>
                                    <br>
                                    <small class="text-muted @if ($meeting->status != 'completed') d-none @endif" id="completedOn">@lang('app.completedOn'):
                                        {{ $meeting->completed_on ? \Carbon\Carbon::parse($meeting->completed_on)->translatedFormat($company->date_format) : '' }}
                                    </small>
                                </div>

                                <div class="status-badge @if ($meeting->status != 'cancelled') d-none @endif" id="cancelStatusDiv">
                                    <span class="status-indicator status-danger">
                                        <i class="fa fa-times-circle mr-1"></i>
                                        {{ __('performance::app.markedAsCancelled') }}
                                    </span>
                                </div>
                            </div>

                            <div class="dropdown">
                                <button class="btn btn-lg f-14 px-2 py-1 text-dark-grey  rounded  dropdown-toggle"
                                    type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                    <i class="fa fa-ellipsis-h"></i>
                                </button>
                                <div class="dropdown-menu dropdown-menu-right border-grey rounded b-shadow-4 p-0"
                                    aria-labelledby="dropdownMenuLink" tabindex="0">

                                    <a class="dropdown-item openRightModal" href="{{ route('meetings.edit', $meeting->id) }}?tab={{ $indexView }}">
                                        <i class="fa fa-edit mr-2"></i> @lang('app.edit') @lang('performance::app.meeting')</a>

                                    <a class="dropdown-item delete-meeting"><i class="fa fa-trash mr-2"></i>
                                        @lang('app.delete') @lang('performance::app.meeting')</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                @endif

                <!-- TASK TABS START -->
                <x-tab-section class="task-tabs">
                    <x-tab-item class="ajax-tab" :active="request('view') == 'detail' || !request('view')"
                        :link="route('meetings.show', $meeting->id) . '?view=detail'">@lang('performance::app.meetingDetails')</x-tab-item>

                    <x-tab-item class="ajax-tab" :active="request('view') == 'discussion'" :link="route('meetings.show', $meeting->id) . '?view=discussion'">
                        @lang('performance::app.discussionPoint')</x-tab-item>

                    <x-tab-item class="ajax-tab" :active="request('view') == 'action'" :link="route('meetings.show', $meeting->id) . '?view=action'">
                        @lang('performance::app.actionItems')</x-tab-item>
                </x-tab-section>

                <div class="s-b-n-content">
                    <div class="tab-content" id="nav-tabContent">
                        @include($tab)
                    </div>
                </div>
                <!-- TASK TABS END -->
            </div>
        </div>
    </div>
</div>

<script>
    $(document).ready(function() {

        const activeTab = "{{ $activeTab }}";
        $('.' + activeTab).addClass('active');

        showBtn(activeTab);

        function showBtn(activeTab) {
            $('.actionBtn').addClass('d-none');

            let button = activeTab + '-btn';
            let status = "{{ $meeting->status }}";

            if (button == 'detail-btn') {
                if (status == 'pending' && button == 'detail-btn') {
                    $('.' + activeTab + '-btn').removeClass('d-none');
                }
            }
            else {
                $('.' + activeTab + '-btn').removeClass('d-none');
            }
        }

        $(".ajax-tab").click(function(event) {
            event.preventDefault();

            $('.task-tabs .ajax-tab').removeClass('active');
            $(this).addClass('active');

            const requestUrl = this.href;

            $.easyAjax({
                url: requestUrl,
                blockUI: true,
                container: "#nav-tabContent",
                historyPush: ($(RIGHT_MODAL).hasClass('in') ? false : true),
                data: {
                    'json': true
                },
                success: function(response) {
                    if (response.status == "success") {
                        showBtn(response.activeTab);
                        $('#nav-tabContent').html(response.html);
                    }
                }
            });
        });

        $('body').on('click', '#markAsComplete', function() {
            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('performance::messages.completeRecord')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: "@lang('performance::messages.confirmComplete')",
                cancelButtonText: "@lang('app.cancel')",
                customClass: {
                    confirmButton: 'btn btn-primary mr-3',
                    cancelButton: 'btn btn-secondary'
                },
                showClass: {
                    popup: 'swal2-noanimation',
                    backdrop: 'swal2-noanimation'
                },
                buttonsStyling: false
            }).then((result) => {
                if (result.isConfirmed) {
                    var url = "{{ route('meetings.mark_as_complete', $meeting->id) }}";
                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                        },
                        success: function(response) {
                            if (response.status == "success") {
                                $('#nav-tabContent').html('');
                                $('#markAsComplete').addClass('d-none');
                                $('#markAsCancel').addClass('d-none');
                                $('#sendReminder').addClass('d-none');

                                // Update the badge class to 'success'
                                var successLabel = @json(__('performance::app.markedAscompleted'));
                                $('#completeStatusDiv .card-text .badge').removeClass('badge-warning')
                                .addClass('badge-success').text(successLabel);

                                $('#completeStatusDiv').removeClass('d-none');
                                $('#completedOn').html(response.completedOn);
                                $('#completedOn').removeClass('d-none');
                                $('#nav-tabContent').html(response.html);

                                $.easyUnblockUI();
                                $(MODAL_LG).modal('hide');
                            }
                        }
                    });
                }
            });
        });

        $('body').on('click', '#markAsCancel', function() {
            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('performance::messages.completeRecord')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: "@lang('performance::messages.confirmCancelled')",
                cancelButtonText: "@lang('app.cancel')",
                customClass: {
                    confirmButton: 'btn btn-primary mr-3',
                    cancelButton: 'btn btn-secondary'
                },
                showClass: {
                    popup: 'swal2-noanimation',
                    backdrop: 'swal2-noanimation'
                },
                buttonsStyling: false
            }).then((result) => {
                if (result.isConfirmed) {
                    var url = "{{ route('meetings.mark_as_cancelled', $meeting->id) }}";
                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                        },
                        success: function(response) {
                            if (response.status == "success") {
                                $('#nav-tabContent').html('');
                                $('#markAsCancel').addClass('d-none');
                                $('#markAsComplete').addClass('d-none');
                                $('#sendReminder').addClass('d-none');

                                // Update the badge class to 'success'
                                var successLabel = @json(__('performance::app.markedAsCancelled'));
                                $('#cancelStatusDiv .card-text .badge').removeClass('badge-warning')
                                .addClass('badge-danger').text(successLabel);

                                $('#cancelStatusDiv').removeClass('d-none');
                                $('#nav-tabContent').html(response.html);

                                $.easyUnblockUI();
                                $(MODAL_LG).modal('hide');
                            }
                        }
                    });
                }
            });
        });

        $('#sendReminder').click(function() {
            var url = "{{ route('meetings.send_reminder', $meeting->id) }}";

            if (url) {
                $.easyAjax({
                    url: url,
                    type: "GET",
                    buttonSelector: "#sendReminder",
                    blockUI: true,
                    disableButton: true,
                    success: function(response) {
                        if (response.status == "success") {
                            $.easyUnblockUI();
                        }
                    }
                });
            }
        });

        $('body').on('click', '.delete-meeting', function() {
            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('messages.recoverRecord')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                @if ($meeting->parent_id)
                    input: 'radio',
                    inputValue: 'this',
                    inputOptions: {
                        'this': `@lang('performance::app.thisMeeting')`,
                        'all': `@lang('performance::app.allMeetings')`
                    },
                @endif
                confirmButtonText: "@lang('messages.confirmDelete')",
                cancelButtonText: "@lang('app.cancel')",
                customClass: {
                    confirmButton: 'btn btn-primary mr-3',
                    cancelButton: 'btn btn-secondary'
                },
                showClass: {
                    popup: 'swal2-noanimation',
                    backdrop: 'swal2-noanimation'
                },
                buttonsStyling: false
            }).then((result) => {
                if (result.isConfirmed) {
                    var url = "{{ route('meetings.destroy', $meeting->id) }}";

                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                            '_method': 'DELETE',
                            @if ($meeting->parent_id)
                                'delete': result.value,
                            @endif
                        },
                        success: function(response) {
                            if (response.status == "success") {
                                window.location.href = response.redirectUrl;
                            }
                        }
                    });
                }
            });
        });

        init(RIGHT_MODAL);
    });
</script>
