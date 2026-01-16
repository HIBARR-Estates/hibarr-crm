<div class="row mb-2 action-row border-bottom pb-2">
    <div class="col-md-4">
        <label class="f-14 text-dark-grey mb-12">Target Pipeline (Optional)</label>
        <select name="actions[{{ $index }}][target_pipeline_id]" class="form-control height-35 f-14 action-pipeline-select">
            <option value="">-- Same as Source --</option>
            @foreach($pipelines as $pipeline)
                <option value="{{ $pipeline->id }}" {{ ($action->target_pipeline_id ?? '') == $pipeline->id ? 'selected' : '' }}>{{ $pipeline->name }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-md-4">
        <label class="f-14 text-dark-grey mb-12">Target Stage</label>
        <select name="actions[{{ $index }}][target_stage_id]" class="form-control height-35 f-14 action-stage-select">
            <option value="">-- Select Target Stage --</option>
            @foreach($stages as $stage)
                <option value="{{ $stage->id }}" data-pipeline-id="{{ $stage->lead_pipeline_id }}" {{ ($action->target_stage_id ?? '') == $stage->id ? 'selected' : '' }}>{{ $stage->name }}</option>
            @endforeach
        </select>
    </div>
    <div class="col-md-3">
        <label class="f-14 text-dark-grey mb-12">&nbsp;</label>
        <div class="custom-control custom-checkbox mt-2">
            <input type="checkbox" class="custom-control-input forward-only-check" id="forward_only_{{ $index }}" name="actions[{{ $index }}][forward_only]" {{ ($action->forward_only ?? true) ? 'checked' : '' }}>
            <label class="custom-control-label" for="forward_only_{{ $index }}">Forward Only</label>
        </div>
        <p class="f-11 text-lightest mt-1 forward-only-help">Prevents moving the deal back to a previous stage.</p>
        <p class="f-11 text-danger mt-1 forward-only-warning" style="display: none;"><i class="fa fa-exclamation-triangle"></i> May overwrite manual progress.</p>
    </div>
    <div class="col-md-1 d-flex align-items-center justify-content-center">
        <button type="button" class="btn btn-sm btn-danger remove-row mt-4"><i class="fa fa-times"></i></button>
    </div>
</div>
