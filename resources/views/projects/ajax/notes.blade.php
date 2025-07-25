@php
    $addProjectNotePermission = user()->permission('add_project_note');
@endphp

<!-- ROW START -->
<div class="row pb-5">
    <div class="col-lg-12 col-md-12 mb-4 mb-xl-0 mb-lg-4 mt-3 mt-lg-5 mt-md-5">
        <!-- Add Task Export Buttons Start -->
        <div class="d-flex" id="table-actions">
            @if (($addProjectNotePermission == 'all' || $addProjectNotePermission == 'added' || $project->project_admin == user()->id) && !$project->trashed())
                <x-forms.link-primary :link="route('project-notes.create').'?project='.$project->id"
                    class="mr-3 openRightModal" icon="plus" data-redirect-url="{{ url()->full() }}">
                    @lang('modules.client.createNote')
                </x-forms.link-primary>
            @endif

        </div>
        <!-- Add Task Export Buttons End -->
        <!-- Task Box Start -->
        <div class="d-flex flex-column w-tables rounded mt-3 bg-white">

            {!! $dataTable->table(['class' => 'table table-hover border-0 w-100']) !!}

            <x-datatable.actions>
                <div class="select-status mr-3 pl-3">
                    <select name="action_type" class="form-control select-picker" id="quick-action-type" disabled>
                        <option value="">@lang('app.selectAction')</option>
                        <option value="delete">@lang('app.delete')</option>
                    </select>
                </div>
            </x-datatable.actions>

        </div>
        <!-- Task Box End -->
    </div>
</div>

@include('sections.datatable_js')

<script>
    $('#project-notes-table').on('preXhr.dt', function(e, settings, data) {
        var projectID = "{{ $project->id }}";
        data['projectID'] = projectID;
    });
    const showTable = () => {
        window.LaravelDataTables["project-notes-table"].draw(true);
    }

    $('#quick-action-type').change(function() {
        const actionValue = $(this).val();
        if (actionValue != '') {
            $('#quick-action-apply').removeAttr('disabled');

            if (actionValue == 'change-status') {
                $('.quick-action-field').addClass('d-none');
                $('#change-status-action').removeClass('d-none');
            } else {
                $('.quick-action-field').addClass('d-none');
            }
        } else {
            $('#quick-action-apply').attr('disabled', true);
            $('.quick-action-field').addClass('d-none');
        }
    });

    $('#quick-action-apply').click(function() {
        const actionValue = $('#quick-action-type').val();
        if (actionValue == 'delete') {
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
                    applyQuickAction();
                }
            });

        } else {
            applyQuickAction();
        }
    });


    $('body').on('click', '.delete-table-row', function() {
        var id = $(this).data('user-id');
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
                var url = "{{ route('project-notes.destroy', ':id') }}";
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
                            showTable();
                        }
                    }
                });
            }
        });
    });

    const applyQuickAction = () => {
        var rowdIds = $("#project-notes-table input:checkbox:checked").map(function() {
            return $(this).val();
        }).get();

        var url = "{{ route('project_notes.apply_quick_action') }}?row_ids=" + rowdIds;

        $.easyAjax({
            url: url,
            container: '#quick-action-form',
            type: "POST",
            disableButton: true,
            buttonSelector: "#quick-action-apply",
            data: $('#quick-action-form').serialize(),
            success: function(response) {
                if (response.status == 'success') {
                    showTable();
                    resetActionButtons();
                    deSelectAll();
                }
            }
        })
    };

    $('body').on('click', '.ask-for-password', function() {
        let projectNoteId = $(this).data('project-note-id');
        let formType = $(this).data('form-type');

        var url = "{{ route('project_notes.ask_for_password', ':id') }}?form_type=" + formType;
        url = url.replace(':id', projectNoteId);

        $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
        $.ajaxModal(MODAL_LG, url);

    });

    // show note detail in right modal
    var getNoteDetail = function(id, formType) {
        openTaskDetail();

        if(formType == 'view') {
            var url = "{{ route('project-notes.show', ':id') }}";
        } else {
            var url = "{{ route('project-notes.edit', ':id') }}";
        }

        url = url.replace(':id', id);

        $.easyAjax({
            url: url,
            blockUI: true,
            container: RIGHT_MODAL,
            historyPush: true,
            success: function(response) {
                if (response.status == "success") {
                    $(RIGHT_MODAL_CONTENT).html(response.html);
                    $(RIGHT_MODAL_TITLE).html(response.title);
                }
            },
            error: function(request, status, error) {
                if (request.status == 403) {
                    $(RIGHT_MODAL_CONTENT).html(
                        '<div class="align-content-between d-flex justify-content-center mt-105 f-21">403 | Permission Denied</div>'
                    );
                } else if (request.status == 404) {
                    $(RIGHT_MODAL_CONTENT).html(
                        '<div class="align-content-between d-flex justify-content-center mt-105 f-21">404 | Not Found</div>'
                    );
                } else if (request.status == 500) {
                    $(RIGHT_MODAL_CONTENT).html(
                        '<div class="align-content-between d-flex justify-content-center mt-105 f-21">500 | Something Went Wrong</div>'
                    );
                }
            }
        });
    }

</script>
