@extends('layouts.app')

@section('content')

    <!-- SETTINGS START -->
    <div class="w-100 d-flex">
        <x-setting-sidebar :activeMenu="$activeSettingMenu" />
        <x-setting-card>
            <x-slot name="buttons">
                <div class="row">
                    <div class="col-md-12 mb-2">
                        <button type="button" class="btn btn-primary" id="open-create-api-token">
                            <i class="fa fa-plus"></i> @lang('app.createApiToken')
                        </button>
                    </div>
                </div>
            </x-slot>

            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <nav class="tabs px-4 border-bottom-grey">
                        <div class="nav" id="nav-tab" role="tablist">
                            <a class="nav-item nav-link f-15 active" href="{{ route('api-token-settings.index') }}"
                               role="tab" aria-selected="true">
                                @lang('app.menu.apiTokenSettings')
                            </a>
                        </div>
                    </nav>
                </div>
            </x-slot>

            <div class="alert alert-info">
                @lang('messages.apiTokenSettingsHelp')
            </div>

            <div class="table-responsive">
                <table class="table table-bordered w-100">
                    <thead>
                        <tr>
                            <th>@lang('app.name')</th>
                            <th>@lang('app.token')</th>
                            <th>@lang('app.apiTokenEndpoints')</th>
                            <th>@lang('app.status')</th>
                            <th>@lang('app.createdAt')</th>
                            <th class="text-right">@lang('app.action')</th>
                        </tr>
                    </thead>
                    <tbody id="api-token-table-body">
                        @forelse($apiTokens as $apiToken)
                            <tr data-token-id="{{ $apiToken->id }}">
                                <td class="token-name">{{ $apiToken->name }}</td>
                                <td><code class="token-mask">{{ $apiToken->maskedToken() }}</code></td>
                                <td class="token-scopes">
                                    @if ($apiToken->isUnrestricted())
                                        <span class="badge badge-secondary">@lang('messages.apiTokenFullAccess')</span>
                                    @else
                                        <span class="badge badge-info">{{ count($apiToken->scopeKeys()) }} @lang('app.apiTokenEndpoints')</span>
                                        <div class="f-12 text-muted mt-1">
                                            {{ implode(', ', array_slice($apiToken->scopeLabels(), 0, 3)) }}
                                            @if (count($apiToken->scopeLabels()) > 3)
                                                …
                                            @endif
                                        </div>
                                    @endif
                                </td>
                                <td class="token-status">
                                    @if ($apiToken->revoked)
                                        <span class="badge badge-danger">@lang('app.revoked')</span>
                                    @else
                                        <span class="badge badge-success">@lang('app.active')</span>
                                    @endif
                                </td>
                                <td>{{ $apiToken->created_at?->timezone(company()->timezone)->translatedFormat(company()->date_format . ' ' . company()->time_format) }}</td>
                                <td class="text-right">
                                    <div class="btn-group">
                                        <button type="button" class="btn btn-sm btn-secondary edit-api-token"
                                                data-id="{{ $apiToken->id }}"
                                                data-name="{{ $apiToken->name }}"
                                                data-unrestricted="{{ $apiToken->isUnrestricted() ? '1' : '0' }}"
                                                data-scopes='@json($apiToken->scopeKeys())'>
                                            <i class="fa fa-edit"></i>
                                        </button>
                                        <button type="button" class="btn btn-sm btn-warning regenerate-api-token"
                                                data-id="{{ $apiToken->id }}"
                                                data-name="{{ $apiToken->name }}">
                                            <i class="fa fa-refresh"></i>
                                        </button>
                                        @if ($apiToken->revoked)
                                            <button type="button" class="btn btn-sm btn-success toggle-api-token"
                                                    data-id="{{ $apiToken->id }}"
                                                    data-revoked="0">
                                                <i class="fa fa-check"></i>
                                            </button>
                                        @else
                                            <button type="button" class="btn btn-sm btn-warning toggle-api-token"
                                                    data-id="{{ $apiToken->id }}"
                                                    data-revoked="1">
                                                <i class="fa fa-ban"></i>
                                            </button>
                                        @endif
                                        <button type="button" class="btn btn-sm btn-danger delete-api-token"
                                                data-id="{{ $apiToken->id }}"
                                                data-name="{{ $apiToken->name }}">
                                            <i class="fa fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        @empty
                            <tr id="api-token-empty-row">
                                <td colspan="6" class="text-center">@lang('messages.noApiTokensFound')</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </x-setting-card>
    </div>
    <!-- SETTINGS END -->

    {{-- Create token modal --}}
    <div class="modal fade" id="create-api-token-modal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-xl" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">@lang('app.createApiToken')</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <form id="create-api-token-form">
                    @csrf
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="api-token-name">@lang('app.name')</label>
                            <input type="text" class="form-control" id="api-token-name" name="name"
                                   placeholder="@lang('placeholders.apiTokenName')" required maxlength="255">
                            <small class="form-text text-muted">@lang('messages.apiTokenNameHelp')</small>
                        </div>

                        @include('api-token-settings.partials.scope-picker', [
                            'inputPrefix' => 'create',
                            'selectedScopes' => [],
                            'unrestricted' => true,
                        ])
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">@lang('app.cancel')</button>
                        <button type="submit" class="btn btn-primary">@lang('app.create')</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    {{-- Edit token modal --}}
    <div class="modal fade" id="edit-api-token-modal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-xl" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">@lang('app.editApiToken')</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <form id="edit-api-token-form">
                    @csrf
                    @method('PUT')
                    <input type="hidden" id="edit-api-token-id" name="id">
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="edit-api-token-name">@lang('app.name')</label>
                            <input type="text" class="form-control" id="edit-api-token-name" name="name"
                                   required maxlength="255">
                        </div>

                        @include('api-token-settings.partials.scope-picker', [
                            'inputPrefix' => 'edit',
                            'selectedScopes' => [],
                            'unrestricted' => true,
                        ])
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">@lang('app.cancel')</button>
                        <button type="submit" class="btn btn-primary">@lang('app.save')</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    {{-- Token reveal modal (shown once after create/regenerate) --}}
    <div class="modal fade" id="reveal-api-token-modal" tabindex="-1" role="dialog" aria-hidden="true"
         data-backdrop="static" data-keyboard="false">
        <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">@lang('messages.apiTokenCopyNowTitle')</h5>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        @lang('messages.apiTokenCopyNowWarning')
                    </div>
                    <div class="form-group">
                        <label>@lang('app.token')</label>
                        <div class="input-group">
                            <input type="text" class="form-control" id="revealed-api-token" readonly>
                            <div class="input-group-append">
                                <button type="button" class="btn btn-outline-secondary" id="copy-api-token">
                                    <i class="fa fa-copy"></i> @lang('app.copy')
                                </button>
                            </div>
                        </div>
                    </div>
                    <p class="text-muted mb-0">@lang('messages.apiTokenUsageHint')</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-dismiss="modal">@lang('app.close')</button>
                </div>
            </div>
        </div>
    </div>

@endsection

@push('scripts')
<script>
    const apiTokenRoutes = {
        store: @json(route('api-token-settings.store')),
        update: @json(url('account/settings/api-token-settings')),
        regenerate: @json(url('account/settings/api-token-settings')),
    };

    function revealApiToken(token, shouldReload) {
        $('#revealed-api-token').val(token);
        $('#reveal-api-token-modal').data('should-reload', shouldReload ? '1' : '0');
        $('#reveal-api-token-modal').modal('show');
    }

    $('#reveal-api-token-modal').on('hidden.bs.modal', function () {
        if ($(this).data('should-reload') === '1') {
            window.location.reload();
        }
    });

    function confirmAction(title, text, confirmText, onConfirm) {
        Swal.fire({
            title: title,
            text: text,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: "@lang('app.cancel')",
            customClass: {
                confirmButton: 'btn btn-danger mr-3',
                cancelButton: 'btn btn-secondary'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                onConfirm();
            }
        });
    }

    $('#open-create-api-token').on('click', function () {
        $('#api-token-name').val('');
        $('#create-api-token-unrestricted').prop('checked', true);
        $('#create-api-token-scopes-panel').addClass('d-none');
        $('#create-api-token-form .api-token-scope-checkbox').prop('checked', false);
        $('#create-api-token-modal').modal('show');
    });

    function toggleScopePanel(prefix) {
        const unrestricted = $(`#${prefix}-api-token-unrestricted`).is(':checked');
        $(`#${prefix}-api-token-scopes-panel`).toggleClass('d-none', unrestricted);
    }

    $('.api-token-unrestricted-toggle').on('change', function () {
        toggleScopePanel($(this).data('prefix'));
    });

    $('.select-scope-group').on('click', function () {
        const prefix = $(this).data('prefix');
        const group = $(this).data('group');
        $(`.api-token-scope-checkbox[data-prefix="${prefix}"][data-group="${group}"]`).prop('checked', true);
    });

    function validateScopeSelection(formSelector, prefix) {
        const unrestricted = $(`#${prefix}-api-token-unrestricted`).is(':checked');
        if (unrestricted) {
            return true;
        }

        const checked = $(`${formSelector} .api-token-scope-checkbox[data-prefix="${prefix}"]:checked`).length;
        if (checked === 0) {
            Swal.fire({
                icon: 'error',
                title: "@lang('app.error')",
                text: "@lang('messages.apiTokenScopesRequired')",
            });
            return false;
        }

        return true;
    }

    $('#create-api-token-form').on('submit', function (e) {
        e.preventDefault();

        if (!validateScopeSelection('#create-api-token-form', 'create')) {
            return;
        }

        $.easyAjax({
            url: apiTokenRoutes.store,
            type: 'POST',
            container: '#create-api-token-form',
            data: $(this).serialize(),
            success: function (response) {
                if (response.status === 'success') {
                    $('#create-api-token-modal').modal('hide');
                    revealApiToken(response.api_token.token, true);
                }
            }
        });
    });

    $('.edit-api-token').on('click', function () {
        const scopes = $(this).data('scopes') || [];
        const unrestricted = $(this).data('unrestricted') === 1;

        $('#edit-api-token-id').val($(this).data('id'));
        $('#edit-api-token-name').val($(this).data('name'));
        $('#edit-api-token-unrestricted').prop('checked', unrestricted);
        $('#edit-api-token-form .api-token-scope-checkbox').each(function () {
            $(this).prop('checked', scopes.includes($(this).val()));
        });
        toggleScopePanel('edit');
        $('#edit-api-token-modal').modal('show');
    });

    $('#edit-api-token-form').on('submit', function (e) {
        e.preventDefault();

        if (!validateScopeSelection('#edit-api-token-form', 'edit')) {
            return;
        }

        const id = $('#edit-api-token-id').val();

        $.easyAjax({
            url: `${apiTokenRoutes.update}/${id}`,
            type: 'PUT',
            container: '#edit-api-token-form',
            data: $(this).serialize(),
            success: function (response) {
                if (response.status === 'success') {
                    $('#edit-api-token-modal').modal('hide');
                    window.location.reload();
                }
            }
        });
    });

    $('.toggle-api-token').on('click', function () {
        const id = $(this).data('id');
        const revoked = $(this).data('revoked') === 1;
        const actionText = revoked ? "@lang('app.revoke')" : "@lang('app.activate')";

        confirmAction(
            actionText + '?',
            revoked ? "@lang('messages.apiTokenRevokeConfirm')" : "@lang('messages.apiTokenActivateConfirm')",
            actionText,
            function () {
                $.easyAjax({
                    url: `${apiTokenRoutes.update}/${id}`,
                    type: 'PUT',
                    data: {
                        _token: '{{ csrf_token() }}',
                        revoked: revoked ? 1 : 0
                    },
                    success: function (response) {
                        if (response.status === 'success') {
                            window.location.reload();
                        }
                    }
                });
            }
        );
    });

    $('.regenerate-api-token').on('click', function () {
        const id = $(this).data('id');
        const name = $(this).data('name');

        confirmAction(
            "@lang('app.regenerate')?",
            @json(__('messages.apiTokenRegenerateConfirm', ['name' => ':name'])).replace(':name', name),
            "@lang('app.regenerate')",
            function () {
                $.easyAjax({
                    url: `${apiTokenRoutes.regenerate}/${id}/regenerate`,
                    type: 'POST',
                    data: {
                        _token: '{{ csrf_token() }}'
                    },
                    success: function (response) {
                        if (response.status === 'success') {
                            revealApiToken(response.api_token.token, true);
                        }
                    }
                });
            }
        );
    });

    $('.delete-api-token').on('click', function () {
        const id = $(this).data('id');
        const name = $(this).data('name');

        confirmAction(
            "@lang('app.delete')?",
            @json(__('messages.apiTokenDeleteConfirm', ['name' => ':name'])).replace(':name', name),
            "@lang('app.delete')",
            function () {
                $.easyAjax({
                    url: `${apiTokenRoutes.update}/${id}`,
                    type: 'DELETE',
                    data: {
                        _token: '{{ csrf_token() }}'
                    },
                    success: function (response) {
                        if (response.status === 'success') {
                            window.location.reload();
                        }
                    }
                });
            }
        );
    });

    $('#copy-api-token').on('click', function () {
        const tokenInput = document.getElementById('revealed-api-token');
        tokenInput.select();
        tokenInput.setSelectionRange(0, 99999);
        document.execCommand('copy');

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: "@lang('messages.copiedToClipboard')",
            showConfirmButton: false,
            timer: 2000
        });
    });
</script>
@endpush
