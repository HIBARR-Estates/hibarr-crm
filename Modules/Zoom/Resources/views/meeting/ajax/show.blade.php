<div id="task-detail-section">

    @php
        if ($zoomSetting->meeting_app == 'in_app') {
            $url = route('zoom-meetings.start_meeting', $event->id);
        } else {
            $url = user()->id == $event->created_by ? $event->start_link : $event->join_link;
        }

        $nowDate = now(company()->timezone)->toDateString();
    @endphp

    <div class="row">
        <div class="col-sm-12">
            <div class="card bg-white border-0 b-shadow-4">
                <div class="card-header bg-white  border-bottom-grey  justify-content-between p-20">
                    <div class="row">
                        <div class="col-lg-8 col-10">
                            <h3>{{ ($event->meeting_name) }}</h3>
                        </div>
                        <div class="col-lg-4 col-2 text-right">
                            <div class="dropdown">
                                <button
                                    class="btn btn-lg f-14 px-2 py-1 text-dark-grey  rounded  dropdown-toggle"
                                    type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                    <i class="fa fa-ellipsis-h"></i>
                                </button>

                                <div class="dropdown-menu dropdown-menu-right border-grey rounded b-shadow-4 p-0"
                                    aria-labelledby="dropdownMenuLink" tabindex="0">
                                    @if (user()->id == $event->created_by)
                                        @if ($event->status == 'waiting')
                                            @php
                                                $nowDate = now(company()->timezone)->toDateString();
                                                $meetingDate = $event->start_date_time->toDateString();
                                            @endphp

                                            @if (isset($url) && (is_null($event->occurrence_id) || $nowDate == $meetingDate))
                                                <a class="dropdown-item" target="_blank" href="{{ $url }}" >
                                                    <i class="fa fa-play mr-2"></i> @lang('zoom::modules.zoommeeting.startUrl')
                                                </a>

                                                <a class="dropdown-item btn-copy" href="javascript:;" data-clipboard-text= "{{ $url }}"><i class="fa fa-copy mr-2"></i> @lang('zoom::modules.zoommeeting.copyMeetingLink') </a>
                                            @endif

                                        @endif
                                    @else
                                        @if ($event->status == 'waiting' || $event->status == 'live')
                                        @php
                                            $nowDate = now(company()->timezone)->toDateString();
                                            $meetingDate = $event->start_date_time->toDateString();
                                        @endphp

                                        @if (isset($url) && (is_null($event->occurrence_id) || $nowDate == $meetingDate))
                                        <a class="dropdown-item" target="_blank" href="{{ $url }}" >
                                            <i class="fa fa-play mr-2"></i> @lang('zoom::modules.zoommeeting.joinUrl')
                                        </a>

                                        <a class="dropdown-item btn-copy" href="javascript:;" data-clipboard-text= "{{ $url }}"><i class="fa fa-copy mr-2"></i> @lang('zoom::modules.zoommeeting.copyMeetingLink') </a>
                                        @endif

                                        @endif
                                    @endif
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                <div class="card-body">
                    <x-cards.data-row :label="__('zoom::modules.zoommeeting.meetingName')"
                                      :value="($event->meeting_name)"/>

                    <div class="col-12 px-0 pb-3 d-flex">
                        <p class="mb-0 text-lightest f-14 w-30 d-inline-block ">
                            @lang('zoom::modules.zoommeeting.viewAttendees')</p>
                        <p class="mb-0 text-dark-grey f-14">
                        @foreach ($event->attendees as $item)
                            <div class="taskEmployeeImg rounded-circle mr-1">
                                <img data-toggle="tooltip" data-original-title="{{ ($item->name) }}"
                                     src="{{ $item->image_url }}">
                            </div>
                            @endforeach
                            </p>
                    </div>

                    <div class="col-12 px-0 pb-3 d-flex">
                        <p class="mb-0 text-lightest f-14 w-30 d-inline-block ">
                            @lang('zoom::modules.zoommeeting.meetingHost')</p>
                        <p class="mb-0 text-dark-grey f-14">
                        <div class="taskEmployeeImg rounded-circle mr-1">
                            <img data-toggle="tooltip" data-original-title="{{ ($event->host->name) }}"
                                 src="{{ $event->host->image_url }}">
                        </div>
                        </p>
                    </div>

                    <div class="col-12 px-0 pb-3 d-flex">
                        <p class="mb-0 text-lightest f-14 w-30 d-inline-block ">
                            @lang('app.status')</p>
                        <p class="mb-0 text-dark-grey f-14">
                            @if ($event->status == 'waiting')
                                <x-status :value="__('zoom::modules.zoommeeting.waiting')" color="yellow"/>
                            @elseif ($event->status == 'live')
                                <x-status :value="__('zoom::modules.zoommeeting.live')" color="red"/>
                            @elseif ($event->status == 'canceled')
                                <x-status :value="__('app.canceled')" color="red"/>
                            @elseif ($event->status == 'finished')
                                <x-status :value="__('app.finished')" color="dark-green"/>
                            @endif
                        </p>
                    </div>

                    <x-cards.data-row :label="__('zoom::modules.zoommeeting.hostVideoStatus')"
                                      :value="$event->host_video ? __('app.enabled') : __('app.disabled')"/>

                    <x-cards.data-row :label="__('zoom::modules.zoommeeting.participantVideoStatus')"
                                      :value="$event->participant_video ? __('app.enabled') : __('app.disabled')"/>

                    <x-cards.data-row :label="__('modules.tasks.category')"
                                      :value="$event->category == null ? '--' : $event->category->category_name"/>

                    <x-cards.data-row :label="__('app.project')"
                                      :value="$event->project == null ? '--' :  $event->project->project_name"/>

                    <x-cards.data-row :label="__('modules.employees.employeePassword')"
                                      :value="$event->password ?? '--'"/>

                    <x-cards.data-row :label="__('zoom::modules.zoommeeting.startOn')"
                                      :value="$event->start_date_time->format(company()->date_format. ' - ' . company()->time_format)"/>

                    <x-cards.data-row :label="__('zoom::modules.zoommeeting.endOn')"
                                      :value="$event->end_date_time->format(company()->date_format. ' - ' . company()->time_format)"/>

                    <x-cards.data-row :label="__('app.description')" :value="($event->description)"
                                      html="true"/>

                </div>
            </div>

            <!-- TASK TABS START -->
            <div class="bg-additional-grey rounded my-3">
                <div class="s-b-inner s-b-notifications bg-white b-shadow-4 rounded">
                    <x-tab-section class="task-tabs">
                                    <x-tab-item class="ajax-tab" :active="(request('view') === 'notes')"
                                    :link="route('tasks.show', $event->id).'?view=notes'">@lang('app.notes')</x-tab-item>

                    </x-tab-section>
                    <div class="s-b-n-content">
                        <div class="tab-content" id="nav-tabContent">
                            @include($tab)
                        </div>
                    </div>
                </div>


            </div>
            <!-- TASK TABS END -->
        </div>
    </div>
</div>
<script src="{{ asset('vendor/jquery/clipboard.min.js') }}"></script>

<script>
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
                            $('#nav-tabContent').html(response.html);
                        }
                    }
                });
            });
            $('body').on('click', '.delete-note', function() {
                var id = $(this).data('row-id');
                Swal.fire({
                    title: "@lang('messages.sweetAlertTitle')",
                    text: "@lang('messages.recoverRecord')",
                    icon: 'warning',
                    showCancelButton: true,
                    focusConfirm: false,
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
                        var url = "{{ route('meeting-note.destroy', ':id') }}";
                        url = url.replace(':id', id);

                        var token = "{{ csrf_token() }}";

                        $.easyAjax({
                            type: 'POST',
                            url: url,
                            data: {
                                '_token': token,
                                '_method': 'DELETE'
                            },
                            success: function(response) {
                                if (response.status == "success") {
                                    $('#note-list').html(response.view);
                                }
                            }
                        });
                    }
                });
            });

            $('body').on('click', '.edit-note', function() {
                var id = $(this).data('row-id');
                var url = "{{ route('meeting-note.edit', ':id') }}";
                url = url.replace(':id', id);
                $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
                $.ajaxModal(MODAL_LG, url);
            });
            var clipboard = new ClipboardJS('.btn-copy');

            clipboard.on('success', function(e) {
                Swal.fire({
                    icon: 'success',
                    text: '@lang("app.copied")',
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    customClass: {
                        confirmButton: 'btn btn-primary',
                    },
                    showClass: {
                        popup: 'swal2-noanimation',
                        backdrop: 'swal2-noanimation'
                    },
                })
            });
</script>
