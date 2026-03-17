<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\LeadSetting\StoreLeadPipeline;
use App\Http\Requests\LeadSetting\UpdateLeadPipeline;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use Illuminate\Support\Facades\DB;

class LeadPipelineSettingController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->middleware(function ($request, $next) {
            abort_403(!(user()->permission('manage_lead_setting') == 'all' && in_array('leads', $this->user->modules)));
            return $next($request);
        });
    }

    /**
     * @return \Illuminate\Contracts\Foundation\Application|\Illuminate\Contracts\View\Factory|\Illuminate\Contracts\View\View
     */
    public function create()
    {
        $this->pipelines = LeadPipeline::all();

        return view('lead-settings.create-pipeline-modal', $this->data);
    }

    /**
     * @param StoreLeadStatus $request
     * @return array
     * @throws \Froiden\RestAPI\Exceptions\RelatedResourceNotFoundException
     */
    public function store(StoreLeadPipeline $request)
    {
        $maxPriority = LeadPipeline::max('priority');

        $pipeline = new LeadPipeline();
        $pipeline->name = $request->name;
        $pipeline->label_color = $request->label_color;
        $pipeline->added_by = user()->id;
        $pipeline->save();

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
        $this->pipeline = LeadPipeline::with('customFieldCategories')
            ->where('company_id', company()->id)
            ->where('id', $id)
            ->firstOrFail();
          $this->maxPriority = LeadPipeline::max('priority');

        $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
        $this->customFieldCategories = collect();
        if ($dealCustomFieldGroup) {
            $this->customFieldCategories = CustomFieldCategory::where('custom_field_group_id', $dealCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->orderBy(DB::raw('`order`'), 'asc')
                ->orderBy('id', 'asc')
                ->get();
        }
        $this->pipelineCategoryIds = $this->pipeline->customFieldCategories->pluck('id')->toArray();

        return view('lead-settings.edit-pipeline-modal', $this->data);
    }

    /**
     * @param UpdateLeadStatus $request
     * @param int $id
     * @return array
     * @throws \Froiden\RestAPI\Exceptions\RelatedResourceNotFoundException
     */
    public function update(UpdateLeadPipeline $request, $id)
    {
        $pipeline = LeadPipeline::where('company_id', company()->id)
            ->where('id', $id)
            ->firstOrFail();
        $pipeline->name = $request->name;
        $pipeline->label_color = $request->label_color;
        $pipeline->save();

        $validated = $request->validated();
        $categoryIds = $validated['category_ids'] ?? [];

        $pipeline->customFieldCategories()->sync($categoryIds);

        return Reply::success(__('messages.updateSuccess'));
    }

    public function statusUpdate($id)
    {
        $allLeadSPipelines = LeadPipeline::select('id', 'default')->get();

        foreach($allLeadSPipelines as $pipeline){
            if($pipeline->id == $id){
                $pipeline->default = '1';
            }
            else{
                $pipeline->default = '0';
            }

            $pipeline->save();
        }

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
        Deal::where('lead_pipeline_id', $id)->delete();
        PipelineStage::where('lead_pipeline_id', $id)->delete();

        LeadPipeline::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }

}
