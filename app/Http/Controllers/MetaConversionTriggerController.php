<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\LeadPipeline;
use App\Models\MetaConversionTrigger;
use App\Models\PipelineStage;
use Illuminate\Http\Request;

class MetaConversionTriggerController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'Meta Conversion Triggers';
        $this->activeSettingMenu = 'meta_conversion_triggers';
    }

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        $this->triggers = MetaConversionTrigger::with(['pipeline', 'stage', 'company'])
            ->where('company_id', company()->id)
            ->orderBy('created_at', 'desc')
            ->get();

        $this->pipelines = LeadPipeline::where('company_id', company()->id)
            ->orderBy('name')
            ->get();

        $this->stages = PipelineStage::where('company_id', company()->id)
            ->orderBy('name')
            ->get();

        return view('meta-conversion-triggers.index', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        $this->pipelines = LeadPipeline::where('company_id', company()->id)
            ->orderBy('name')
            ->get();

        $this->stages = PipelineStage::where('company_id', company()->id)
            ->orderBy('name')
            ->get();

        return view('meta-conversion-triggers.create-modal', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        $validated = $request->validate(MetaConversionTrigger::validationRules());
        $validated['company_id'] = company()->id;

        // Check for duplicate trigger (same pipeline + stage)
        $existing = MetaConversionTrigger::where('lead_pipeline_id', $validated['lead_pipeline_id'])
            ->where('lead_pipeline_stage_id', $validated['lead_pipeline_stage_id'])
            ->where('company_id', company()->id)
            ->first();

        if ($existing) {
            return Reply::error('A trigger already exists for this pipeline and stage combination.');
        }

        MetaConversionTrigger::create($validated);

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        $this->trigger = MetaConversionTrigger::with(['pipeline', 'stage'])
            ->where('company_id', company()->id)
            ->findOrFail($id);

        $this->pipelines = LeadPipeline::where('company_id', company()->id)
            ->orderBy('name')
            ->get();

        $this->stages = PipelineStage::where('company_id', company()->id)
            ->orderBy('name')
            ->get();

        return view('meta-conversion-triggers.edit-modal', $this->data);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        $trigger = MetaConversionTrigger::where('company_id', company()->id)
            ->findOrFail($id);

        // If only updating active status, use simpler validation
        $requestKeys = array_keys($request->all());
        $onlyStatusUpdate = count($requestKeys) <= 3 && 
                           in_array('active', $requestKeys) && 
                           in_array('_method', $requestKeys) && 
                           in_array('_token', $requestKeys);

        if ($onlyStatusUpdate && $request->has('active')) {
            $trigger->active = $request->boolean('active');
            $trigger->save();
            return Reply::success(__('messages.updateSuccess'));
        }

        // Full update with all fields
        $validated = $request->validate(MetaConversionTrigger::validationRules());

        // Check for duplicate trigger (same pipeline + stage) excluding current trigger
        $existing = MetaConversionTrigger::where('lead_pipeline_id', $validated['lead_pipeline_id'])
            ->where('lead_pipeline_stage_id', $validated['lead_pipeline_stage_id'])
            ->where('company_id', company()->id)
            ->where('id', '!=', $id)
            ->first();

        if ($existing) {
            return Reply::error('A trigger already exists for this pipeline and stage combination.');
        }

        $trigger->update($validated);

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        MetaConversionTrigger::where('company_id', company()->id)
            ->findOrFail($id)
            ->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }
}

