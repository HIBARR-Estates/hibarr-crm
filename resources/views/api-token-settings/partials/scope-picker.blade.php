@php
    $inputPrefix = $inputPrefix ?? '';
    $selectedScopes = $selectedScopes ?? [];
    $unrestricted = $unrestricted ?? true;
    $idPrefix = $inputPrefix !== '' ? $inputPrefix . '-' : '';
@endphp

<div class="form-group mb-0">
    <div class="custom-control custom-checkbox mb-3">
        <input type="checkbox"
               class="custom-control-input api-token-unrestricted-toggle"
               id="{{ $idPrefix }}api-token-unrestricted"
               name="unrestricted"
               value="1"
               data-prefix="{{ $inputPrefix }}"
               @checked($unrestricted)>
        <label class="custom-control-label" for="{{ $idPrefix }}api-token-unrestricted">
            @lang('messages.apiTokenUnrestrictedAccess')
        </label>
    </div>

    <div class="api-token-scopes-panel {{ $unrestricted ? 'd-none' : '' }}"
         id="{{ $idPrefix }}api-token-scopes-panel">
        <p class="text-muted f-13">@lang('messages.apiTokenScopesHelp')</p>

        @foreach ($scopeGroups as $groupKey => $group)
            <div class="border rounded p-3 mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <strong>{{ $group['label'] }}</strong>
                    <button type="button"
                            class="btn btn-link btn-sm p-0 select-scope-group"
                            data-prefix="{{ $inputPrefix }}"
                            data-group="{{ $groupKey }}">
                        @lang('app.selectAll')
                    </button>
                </div>
                <div class="row">
                    @foreach ($group['scopes'] as $scopeKey => $scopeLabel)
                        <div class="col-md-6 mb-2">
                            <div class="custom-control custom-checkbox">
                                <input type="checkbox"
                                       class="custom-control-input api-token-scope-checkbox"
                                       id="{{ $idPrefix }}scope-{{ md5($scopeKey) }}"
                                       name="scopes[]"
                                       value="{{ $scopeKey }}"
                                       data-prefix="{{ $inputPrefix }}"
                                       data-group="{{ $groupKey }}"
                                       @checked(in_array($scopeKey, $selectedScopes, true))>
                                <label class="custom-control-label f-13"
                                       for="{{ $idPrefix }}scope-{{ md5($scopeKey) }}">
                                    {{ $scopeLabel }}
                                </label>
                            </div>
                        </div>
                    @endforeach
                </div>
            </div>
        @endforeach
    </div>
</div>
