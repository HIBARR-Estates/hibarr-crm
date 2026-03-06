{{-- Retention Policy Tab Content --}}
@php
    $policy = $retentionPolicy ?? null;
@endphp

<div class="alert alert-info mb-4">
    <h5 class="alert-heading f-14 font-weight-bold"><i class="fa fa-info-circle"></i> Retention & Archival</h5>
    <p class="mb-0 f-13">
        Configure how long CRM events are kept before being archived. Events older than the maximum age
        or exceeding the row count will be moved to the archive table daily at 03:00 AM.
    </p>
</div>

@if($policy && $policy->last_archived_at)
    <div class="alert alert-secondary mb-4">
        <i class="fa fa-clock mr-1"></i>
        <strong>Last archived:</strong> {{ $policy->last_archived_at->format('M d, Y H:i') }}
        ({{ $policy->last_archived_at->diffForHumans() }})
    </div>
@endif

<form id="retention-form">
    <div class="row">
        <div class="col-md-6">
            <x-forms.number fieldId="max_age_days"
                            fieldLabel="Maximum Age (days)"
                            fieldName="max_age_days"
                            fieldRequired="true"
                            :fieldValue="$policy->max_age_days ?? 365"
                            fieldHelp="Events older than this will be archived" />
        </div>
        <div class="col-md-6">
            <x-forms.number fieldId="max_row_count"
                            fieldLabel="Maximum Row Count"
                            fieldName="max_row_count"
                            fieldRequired="true"
                            :fieldValue="$policy->max_row_count ?? 5000000"
                            fieldHelp="Oldest events archived when count exceeds this" />
        </div>
    </div>

    <div class="row">
        <div class="col-md-6">
            <x-forms.select fieldId="archive_storage"
                            fieldLabel="Archive Storage"
                            fieldName="archive_storage"
                            fieldRequired="true">
                <option value="database" {{ ($policy->archive_storage ?? 'database') === 'database' ? 'selected' : '' }}>
                    Database (Archive Table)
                </option>
                <option value="filesystem" {{ ($policy->archive_storage ?? '') === 'filesystem' ? 'selected' : '' }}>
                    Filesystem (JSON Files)
                </option>
            </x-forms.select>
        </div>
        <div class="col-md-6">
            <x-forms.text fieldId="archive_table"
                          fieldLabel="Archive Table Name"
                          fieldName="archive_table"
                          :fieldValue="$policy->archive_table ?? 'crm_events_archive'"
                          fieldHelp="Only used when storage is Database" />
        </div>
    </div>

    <div class="row">
        <div class="col-md-6">
            <div class="form-group my-3">
                <x-forms.checkbox fieldId="retention_is_active"
                                  fieldLabel="Enable Automatic Archival"
                                  fieldName="is_active"
                                  :checked="$policy->is_active ?? true" />
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-md-12">
            <x-forms.button-primary id="save-retention" icon="check">
                @lang('app.save')
            </x-forms.button-primary>
        </div>
    </div>
</form>
