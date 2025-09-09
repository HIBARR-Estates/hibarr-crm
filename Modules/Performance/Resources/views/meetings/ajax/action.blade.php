<style>
    /* Gradient background for action points */

    /* Add More link hover effect */
    #action .text-success:hover {
        color: #28a745 !important;
        /* Darker green on hover */
    }

    /* Badge styling */
    #action .badge-number {
        display: inline-block;
        width: 30px;
        height: 30px;
        min-width: 30px; /* Ensures the badge doesn't shrink on small screens */
        border-radius: 50%;
        text-align: center;
        line-height: 30px;
        margin-right: 10px;
    }


    #action .header-style {
        /* background-color: #f0f0f0; */
        padding: 10px;
        border-radius: 5px;
        gap: 10px;
    }
</style>

<!-- TAB CONTENT START -->
<div class="tab-pane fade show active" role="tabpanel" aria-labelledby="action">
    <div class="d-flex flex-wrap justify-content-between p-20" id="action">
        <div class="card w-100 rounded-0 border-0 note">
            <div class="card-horizontal">
                <div class="card-body border-0 pl-0 pb-1 pr-0 pt-0">
                    @forelse($meeting->actions->groupBy('added_by') as $actions)
                        <div class="user-group">
                            <h5 class="header-style d-flex align-items-center">
                                <i class="fas fa-list"></i> @lang('performance::messages.actionPointsByUser')
                                @if ($actions->first()->addedBy)
                                    <x-employee :user="$actions->first()->addedBy" />
                                @else
                                    <span class="text-muted">--</span>
                                @endif
                            </h5>
                            @foreach ($actions as $key => $action)
                                <div class="d-flex justify-content-between align-items-center mb-3 p-2 bg-gradient-light rounded-lg hover-effect border">
                                    <!-- Badge with number -->
                                    <div class="d-flex align-items-center ">
                                        <div class="badge-number rounded-circle border">
                                            {{ $key + 1 }}
                                        </div>
                                        <!-- Content wrapper with centered content -->
                                        <div class="p-2">
                                            <!-- Truncated content -->
                                            <span class="text-dark truncate">
                                                {{ Str::limit($action->action_point, 200) }} <!-- Limit text to 200 characters -->
                                            </span>
                                            <!-- Conditionally show View More link -->
                                            @if (strlen($action->action_point) > 200)
                                                <a href="javascript:;" class="view-more" data-id="{{ $action->id }}"
                                                    data-content="{{ $action->action_point }}">@lang('performance::app.viewMore')</a>
                                            @endif
                                        </div>
                                    </div>
                                    <!-- Edit and Delete icons -->
                                    @if ($hasAccess && $meeting->status == 'pending')
                                        <div>
                                            <a href="javascript:;" class="text-primary mr-2 edit-action" data-id="{{ $action->id }}" data-toggle="tooltip" data-original-title="@lang('app.edit')">
                                                <i class="fa fa-edit"></i></a>
                                            <a href="javascript:;" class="text-danger delete-action" data-id="{{ $action->id }}" data-toggle="tooltip" data-original-title="@lang('app.delete')">
                                                <i class="fa fa-trash"></i></a>
                                        </div>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                    @empty
                        <x-cards.no-record-found-list/>
                    @endforelse

                    <!-- Add More Link -->
                    @if ($hasAccess && $meeting->status == 'pending')
                        <div class="mt-4">
                            <a href="javascript:;" class="text-primary d-flex align-items-center hover-effect" id="add-action" data-meeting="{{ $meeting->id }}" data-tab="list">
                                <i class="fa fa-plus-circle fa-lg mr-2"></i>
                                @if (count($meeting->actions) > 0)
                                    <span>@lang('performance::app.addMoreActionPoint')</span>
                                @else
                                    <span>@lang('performance::app.addActionPoint')</span>
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
            var url = "{{ route('action.show', ':id') }}";
            url = url.replace(':id', id);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('#add-action').on('click', function() {
            let meetingId = $(this).data('meeting');
            let tab = $(this).data('tab');
            let page = 'modal';
            var url = "{{ route('action.create') }}?meetingId="+meetingId+"&tab="+tab+"&page="+page;

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('.edit-action').on('click', function() {
            let id = $(this).data('id');
            var url = "{{ route('action.edit', ':id') }}";
            url = url.replace(':id', id);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('.mark-as-actioned').on('click', function() {
            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('performance::messages.recoverActionRecord')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                @if ($meeting->parent_id)
                    input: 'radio',
                    inputValue: 'this',
                    inputOptions: {
                        'this': `@lang('app.thisEvent')`,
                        'all': `@lang('app.allEvent')`
                    },
                @endif
                confirmButtonText: "@lang('performance::messages.confirmActioned')",
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
                    var url = "{{ route('action.mark_as_actioned') }}";
                    url = url.replace(':id', id);

                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                            'id': id,
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

        $('.delete-action').click(function() {
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
                    var url = "{{ route('action.destroy', ':id') }}";
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
