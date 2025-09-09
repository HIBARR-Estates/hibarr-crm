<style>
    /* Gradient background for discussion points */

    /* Hover effect for discussion points and "Add More" link */
    #discussion .hover-effect:hover {
        /* transform: translateY(-3px);
        transition: transform 0.2s ease-in-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); */
    }

    /* Smooth shadow transition */
    #discussion .shadow-sm {
        transition: box-shadow 0.2s ease-in-out;
    }

    /* Add More link hover effect */
    #discussion .text-success:hover {
        color: #28a745 !important;
        /* Darker green on hover */
    }

    /* Badge styling */
    #discussion .badge-number {
        display: inline-block;
        width: 30px;
        height: 30px;
        min-width: 30px; /* Ensures the badge doesn't shrink on small screens */
        border-radius: 50%;
        text-align: center;
        line-height: 30px;
        margin-right: 10px;
    }

    #discussion .header-style {
        /* background-color: #f0f0f0; */
        padding: 10px;
        border-radius: 5px;
        gap: 10px;
    }
</style>

<!-- TAB CONTENT START -->
<div class="tab-pane fade show active" role="tabpanel" aria-labelledby="discussion">
    <div class="d-flex flex-wrap justify-content-between p-20" id="discussion">
        <div class="card w-100 rounded-0 border-0 note">
            <div class="card-horizontal">
                <div class="card-body border-0 pl-0 pb-1 pr-0 pt-0">
                    @forelse($meeting->agendas->groupBy('added_by') as $agendas)
                        <div class="user-group">
                            <h5 class="header-style d-flex align-items-center">
                                <i class="fas fa-list"></i> @lang('performance::messages.discussionPointsByUser')
                                @if ($agendas->first()->addedBy)
                                    <x-employee :user="$agendas->first()->addedBy" />
                                @else
                                    <span class="text-muted">--</span>
                                @endif
                            </h5>
                            @foreach ($agendas as $key => $agenda)
                                @if (
                                    ($agenda->keep_private == 'no') || // If agenda is private, don't show to everyone
                                    ($agenda->added_by == user()->id) || // If agenda is added by the current user
                                    in_array('admin', user_roles()) // If the user is an admin
                                )
                                    <div class="d-flex justify-content-between align-items-center m-2 p-2 bg-gradient-light rounded-lg hover-effect border">
                                        <div class="d-flex align-items-center">
                                            <!-- Badge with number -->
                                            <div class="badge-number rounded-circle border
                                                @if($agenda->is_discussed == 'yes') bg-success text-white @endif">
                                                {{ $key + 1 }}
                                            </div>

                                            <!-- Show more -->
                                            <div class="p-2">
                                                <span class="text-dark truncate">
                                                    {{ Str::limit($agenda->discussion_point, 200) }} <!-- Limit text to 50 characters -->
                                                </span>
                                                @if (strlen($agenda->discussion_point) > 200)
                                                    <a href="javascript:;" class="view-more" data-id="{{ $agenda->id }}"
                                                        data-content="{{ $agenda->discussion_point }}">@lang('performance::app.viewMore')</a>
                                                @endif
                                            </div>
                                        </div>

                                        <!-- Edit and Delete icons -->
                                        <div>
                                            @if ($agenda->keep_private == 'yes')
                                                <span class="mr-2 text-secondary" data-toggle="tooltip" data-original-title="{{ __('performance::messages.privateAgenda') }}">
                                                    <i class="fa fa-lock"></i>
                                                </span>
                                            @endif
                                            @if ($meeting->status == 'completed' && $agenda->is_discussed == 'yes')
                                                <a href="javascript:;" class="mr-2 text-success" data-id="{{ $agenda->id }}" data-toggle="tooltip" data-original-title="@if($agenda->is_discussed == 'no') @lang('performance::messages.markAsDiscussed') @else @lang('performance::messages.discussed') @endif">
                                                        <i class="fa fa-check"></i></a>
                                            @endif

                                            @if ($hasAccess)
                                                @if ($meeting->status == 'pending')
                                                    @if ($agenda->is_discussed == 'no')
                                                        <a href="javascript:;" class="mr-2 mark-as-discussed text-secondary" data-id="{{ $agenda->id }}" data-toggle="tooltip" data-original-title="@lang('performance::messages.markAsDiscussed')">
                                                            <i class="fa fa-check"></i></a>
                                                    @endif

                                                    @if($agenda->is_discussed == 'no' && ($user->id == user()->id || in_array('admin', user_roles())))
                                                        <a href="javascript:;" class="text-secondary mr-2 edit-agenda" data-id="{{ $agenda->id }}" data-toggle="tooltip" data-original-title="@lang('app.edit')"> <i class="fa fa-edit"></i>
                                                        </a>
                                                    @endif

                                                    <a href="javascript:;" class="text-danger delete-agenda" data-id="{{ $agenda->id }}" data-toggle="tooltip" data-original-title="@lang('app.delete')">
                                                        <i class="fa fa-trash"></i></a>
                                                @endif
                                            @endif
                                        </div>
                                    </div>
                                @endif
                            @endforeach
                        </div>
                    @empty
                        <x-cards.no-record-found-list/>
                    @endforelse

                    @if ($hasAccess && $meeting->status == 'pending')
                        <!-- Add More Link -->
                        <div class="m-3">
                            <a href="javascript:;" class="text-primary d-flex align-items-center hover-effect" id="add-agenda" data-meeting="{{ $meeting->id }}" data-tab="list">
                                <i class="fa fa-plus-circle fa-lg mr-2"></i>
                                @if (count($meeting->agendas) > 0)
                                    <span>@lang('performance::app.addMoreDiscussionPoint')</span>
                                @else
                                    <span>@lang('performance::app.addDiscussionPoint')</span>
                                @endif
                            </a>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>
<!-- TAB CONTENT END -->

<script>
    $(document).ready(function() {
        $('.view-more').on('click', function() {
            let id = $(this).data('id');
            var url = "{{ route('agenda.show', ':id') }}";
            url = url.replace(':id', id);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('#add-agenda').on('click', function() {
            let meetingId = $(this).data('meeting');
            let tab = $(this).data('tab');
            let page = 'modal';
            var url = "{{ route('agenda.create') }}?meetingId="+meetingId+"&tab="+tab+"&page="+page;

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('.edit-agenda').on('click', function() {
            let id = $(this).data('id');
            var url = "{{ route('agenda.edit', ':id') }}";
            url = url.replace(':id', id);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('.mark-as-discussed').on('click', function() {
            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('performance::messages.recoverRecord')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: "@lang('performance::messages.confirmDiscussion')",
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
                    var id = $(this).data('id');
                    var url = "{{ route('agenda.mark_as_discussed') }}";
                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                            'id': id
                        },
                        success: function(response) {
                            if (response.status == "success") {
                                $('#nav-tabContent').html('');
                                $('#nav-tabContent').html(response.html);

                                $.easyUnblockUI();
                                $(MODAL_LG).modal('hide');
                            }
                        }
                    });
                }
            });
        });

        $('.delete-agenda').click(function() {
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
                    var id = $(this).data('id');
                    var url = "{{ route('agenda.destroy', ':id') }}";
                    url = url.replace(':id', id);

                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        blockUI: true,
                        data: {
                            '_token': token,
                            '_method': 'DELETE'
                        },
                        success: function(response) {
                            if (response.status == "success") {
                                $('#nav-tabContent').html('');
                                $('#nav-tabContent').html(response.html);

                                $.easyUnblockUI();
                                $(MODAL_LG).modal('hide');
                            }
                        }
                    });
                }
            });
        });
    });
</script>
