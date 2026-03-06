<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\LeadSetting\StoreLeadAgent;
use App\Http\Requests\LeadSetting\UpdateLeadAgent;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\User;
use Illuminate\Http\Request;

class LeadAgentSettingController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->middleware(function ($request, $next) {
            abort_403(!in_array('leads', $this->user->modules));
            return $next($request);
        });
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        $this->addPermission = user()->permission('add_lead_agent');

        abort_403(!in_array($this->addPermission, ['all', 'added']));

        $this->employees = User::
            join('role_user', 'role_user.user_id', '=', 'users.id')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->select('users.id', 'users.name', 'users.email', 'users.created_at', 'users.image')
            ->where('roles.name', 'employee')
            ->get();

            $this->leadCategories = LeadCategory::get();

        return view('lead-settings.create-agent-modal', $this->data);
    }

    public function store(StoreLeadAgent $request)
    {
        $this->addPermission = user()->permission('add_lead_agent');
        abort_403(!in_array($this->addPermission, ['all', 'added']));

        $categoryIds = $request->input('category_id', []);
        if (! is_array($categoryIds)) {
            $categoryIds = $categoryIds ? [ $categoryIds ] : [];
        }
        $categoryIds = array_values(array_filter($categoryIds));

        if (empty($categoryIds)) {
            // Create lead agent without a category
            LeadAgent::create([
                'company_id' => company()->id,
                'user_id' => $request->agent_id,
                'lead_category_id' => null,
                'added_by' => user()->id,
                'status' => 'enabled',
            ]);
        } else {
            foreach ($categoryIds as $categoryId) {
                $agentCategory = new LeadAgent();
                $agentCategory->company_id = company()->id;
                $agentCategory->user_id = $request->agent_id;
                $agentCategory->lead_category_id = $categoryId;
                $agentCategory->added_by = user()->id;
                $agentCategory->status = 'enabled';
                $agentCategory->save();
            }
        }

        if($request->deal_category_id)
        {
            $data = LeadAgent::with('user')->where('lead_category_id', $request->deal_category_id)->get();

            $option = '';

            foreach($data->pluck('user') as $item)
            {
                $option .= '<option data-content="' . $item->name . '" value="' . $item->id . '"> ' . $item->name . '</option>';
            }

            return Reply::successWithData(__('messages.recordSaved'), ['data' => $option]);
        }
        return Reply::success(__('messages.recordSaved'));


    }

    /**
     * Remove the specified resource from storage.
     *
     * @param int $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        $leadAgent = LeadAgent::where('user_id', $id)->first();
        $this->deletePermission = user()->permission('delete_lead_agent');

        abort_403(!($this->deletePermission == 'all' || ($this->editPermission == 'added' && $leadAgent->added_by == user()->id)));

        LeadAgent::where('user_id', $id)->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function updateCategory($id, UpdateLeadAgent $request)
    {
        // $id is the user_id (from User model in the agent table)
        LeadAgent::where('user_id', $id)->delete();

        $categoryIds = $request->input('categoryId', []);
        if (! is_array($categoryIds)) {
            $categoryIds = $categoryIds ? [ $categoryIds ] : [];
        }
        $categoryIds = array_values(array_filter($categoryIds));

        if (empty($categoryIds)) {
            // Keep the user as a lead agent but without a category (one row with lead_category_id = null)
            LeadAgent::create([
                'user_id' => $id,
                'lead_category_id' => null,
                'company_id' => company()->id,
                'added_by' => $request->user()->id,
                'last_updated_by' => user()->id,
                'status' => 'enabled',
            ]);
        } else {
            foreach ($categoryIds as $categoryId) {
                LeadAgent::firstOrCreate([
                    'user_id' => $id,
                    'lead_category_id' => $categoryId,
                    'last_updated_by' => user()->id,
                    'company_id' => company()->id
                ], [
                    'added_by' => $request->user()->id,
                    'status' => 'enabled',
                ]);
            }
        }

        return Reply::success(__('messages.updateSuccess'));
    }

    public function updateStatus($id, Request $request)
    {
        LeadAgent::where('user_id', $id)->update(['status' => $request->status]);

        return reply::success(__('messages.updateSuccess'));
    }

    public function agentCategories()
    {
        $leadAgentCategory = LeadAgent::where('user_id', request()->agent_id)->pluck('lead_category_id')->toArray();
        // Filter out nulls: agents with no category have lead_category_id = null; whereNotIn('id', [null]) returns no rows in SQL
        $leadAgentCategory = array_values(array_filter($leadAgentCategory, fn ($id) => $id !== null));

        if (!empty($leadAgentCategory)) {
            $leadCategory = LeadCategory::whereNotIn('id', $leadAgentCategory)->get();
        } else {
            $leadCategory = LeadCategory::all();
        }

        return Reply::dataOnly(['data' => $leadCategory]);
    }

}
