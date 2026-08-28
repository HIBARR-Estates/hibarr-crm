@extends('layouts.app')

@section('content')

    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        @lang($pageTitle)
                    </h2>
                </div>
            </x-slot>

            <x-slot name="action">
                <div class="row">
                    <div class="col-md-12 text-right">
                        <x-forms.link-primary link="javascript:;" icon="plus" class="mb-2 mr-3 open-email-template-create">
                            @lang('app.addNew')
                        </x-forms.link-primary>
                    </div>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
                <p class="f-13 text-lightest mb-3">
                    Reusable email templates for deal automation “Send Email” actions. Use merge tags like
                    <code>@{{value}}</code>, <code>@{{lead_field_client_name}}</code>, or
                    <code>@{{lead_field_client_email}}</code> in the subject or body — they are filled from the
                    deal and its lead when the email is sent.
                </p>
                <div class="table-responsive">
                    <table class="table table-bordered table-hover">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Subject</th>
                                <th class="text-right">@lang('app.action')</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($templates as $template)
                                <tr id="template-row-{{ $template->id }}">
                                    <td>
                                        <h5 class="mb-0 f-14 text-darkest-grey">
                                            {{ $template->name }}
                                            @if($template->plunk_template_id)
                                                <span class="badge badge-light ml-1" title="Sends via Plunk template {{ $template->plunk_template_id }}">Plunk</span>
                                            @endif
                                        </h5>
                                    </td>
                                    <td>{{ $template->subject }}</td>
                                    <td class="text-right">
                                        <div class="task_view">
                                            <a href="javascript:;" class="task_view_more d-flex align-items-center justify-content-center preview-email-template"
                                                data-template-id="{{ $template->id }}"
                                                data-subject="{{ $template->subject }}">
                                                <i class="fa fa-eye icons mr-2"></i> Preview
                                            </a>
                                            <a href="{{ route('email-templates.edit', $template->id) }}" class="task_view_more d-flex align-items-center justify-content-center">
                                                <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                                            </a>
                                            <a href="javascript:;" class="task_view_more d-flex align-items-center justify-content-center delete-email-template"
                                                data-url="{{ route('email-templates.destroy', $template->id) }}">
                                                <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="3">
                                        <x-cards.no-record icon="envelope" :message="__('messages.noRecordFound')" />
                                    </td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>

        </x-setting-card>

    </div>

    @include('company-settings.email-template.partials.preview-modal')

@endsection

@push('scripts')
    <script>
        $('body').on('click', '.open-email-template-create', function () {
            $.ajaxModal(MODAL_XL, "{{ route('email-templates.create-modal') }}");
        });

        $('body').on('click', '.preview-email-template', function () {
            var templateId = $(this).data('template-id');
            var subjectText = $(this).data('subject') || '';

            $.ajax({
                url: '{{ route('email-templates.preview') }}',
                type: 'POST',
                dataType: 'json',
                data: {
                    _token: '{{ csrf_token() }}',
                    template_id: templateId
                }
            }).done(function (response) {
                if (window.openEmailTemplatePreviewModal) {
                    window.openEmailTemplatePreviewModal(response.subject || subjectText, response.html || '');
                }
            }).fail(function (xhr) {
                var message = (xhr.responseJSON && xhr.responseJSON.message) ? xhr.responseJSON.message : 'Could not build the preview.';
                alert(message);
            });
        });

        $('body').on('click', '.delete-email-template', function () {
            var url = $(this).data('url');
            var row = $(this).closest('tr');

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
                showClass: { popup: 'swal2-noanimation', backdrop: 'swal2-noanimation' },
                buttonsStyling: false
            }).then(function (result) {
                if (result.isConfirmed) {
                    $.easyAjax({
                        url: url,
                        type: "DELETE",
                        data: { '_token': "{{ csrf_token() }}" },
                        success: function (response) {
                            if (response.status === 'success') {
                                row.fadeOut(300, function () { $(this).remove(); });
                            }
                        }
                    });
                }
            });
        });
    </script>
    @include('company-settings.email-template.partials.preview-modal-scripts')
@endpush
