<?php

namespace App\Http\Controllers;

use App\Models\MeetingType;
use Illuminate\Http\Request;
use App\Helper\Reply;
use Illuminate\Support\Facades\Validator;

class MeetingTypeController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'Meeting Types';
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $meetingTypes = MeetingType::where('company_id', company()->id)
            ->where('is_active', true)
            ->get();
        
        // If it's an API request, return JSON
        if ($request->wantsJson() || $request->expectsJson()) {
            return Reply::dataOnly([
                'meeting_types' => $meetingTypes->map(function ($type) {
                    return [
                        'id' => $type->id,
                        'name' => $type->name,
                        'description' => $type->description,
                        'color' => $type->color,
                        'is_active' => $type->is_active,
                    ];
                })
            ]);
        }
        
        // Otherwise, return the view for web interface
        $this->meetingTypes = $meetingTypes;
        $this->activeSettingMenu = 'meeting_types';
        return view('meeting-types.index', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('meeting-types.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'required|string|max:7|regex:/^#[0-9A-F]{6}$/i',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $meetingType = new MeetingType();
        $meetingType->name = $request->name;
        $meetingType->description = $request->description;
        $meetingType->color = $request->color;
        $meetingType->company_id = company()->id;
        $meetingType->save();

        return Reply::successWithData('Meeting type created successfully.', [
            'meeting_type' => [
                'id' => $meetingType->id,
                'name' => $meetingType->name,
                'description' => $meetingType->description,
                'color' => $meetingType->color,
                'is_active' => $meetingType->is_active,
            ]
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $this->meetingType = MeetingType::where('company_id', company()->id)->findOrFail($id);
        return view('meeting-types.edit', $this->data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'required|string|max:7|regex:/^#[0-9A-F]{6}$/i',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $meetingType = MeetingType::where('company_id', company()->id)->findOrFail($id);
        $meetingType->name = $request->name;
        $meetingType->description = $request->description;
        $meetingType->color = $request->color;
        $meetingType->save();

        return Reply::success('Meeting type updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $meetingType = MeetingType::where('company_id', company()->id)->findOrFail($id);
        
        // Check if meeting type is being used
        if ($meetingType->followUps()->count() > 0) {
            return Reply::error('Cannot delete meeting type as it is being used by follow-ups.');
        }

        $meetingType->delete();
        return Reply::success('Meeting type deleted successfully.');
    }
}
