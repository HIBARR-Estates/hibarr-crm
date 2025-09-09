<?php

namespace Modules\Zoom\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Http\Requests\Tasks\StoreTaskNote;
use Modules\Zoom\Entities\ZoomMeeting;
use Modules\Zoom\Entities\ZoomMeetingNote;
use Modules\Zoom\Entities\ZoomSetting;
use Modules\Zoom\Http\Requests\ZoomMeeting\StoreMeetingNote;

class ZoomMeetingNoteController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = __('zoom::app.menu.zoomMeeting');

        $this->middleware(
            function ($request, $next) {
                abort_403(! in_array(ZoomSetting::MODULE_NAME, $this->user->modules));

                return $next($request);
            }
        );
    }

    /**
     * @param  StoreTaskNote  $request
     * @return void
     */
    public function store(StoreMeetingNote $request)
    {
        $meeting = ZoomMeeting::with('attendees', 'host', 'notes')->findOrFail($request->meetingID);
        $note = new ZoomMeetingNote;
        $note->note = trim_editor($request->note);
        $note->zoom_meeting_id = $request->meetingID;
        $note->user_id = user()->id;
        $note->save();

        $this->notes = ZoomMeetingNote::where('zoom_meeting_id', $request->meetingID)->orderByDesc('id')->get();
        $view = view('zoom::meeting.notes.show', $this->data)->render();

        return Reply::dataOnly(['status' => 'success', 'view' => $view]);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        $note = ZoomMeetingNote::findOrFail($id);
        $zoom_meeting_id = $note->zoom_meeting_id;
        $note->delete();
        $this->notes = ZoomMeetingNote::with('meeting')->where('zoom_meeting_id', $zoom_meeting_id)->orderByDesc('id')->get();
        $view = view('tasks.notes.show', $this->data)->render();

        return Reply::dataOnly(['status' => 'success', 'view' => $view]);
    }

    /**
     * XXXXXXXXXXX
     *
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        $this->note = ZoomMeetingNote::with('user', 'meeting')->findOrFail($id);

        return view('zoom::meeting.notes.edit', $this->data);

    }

    public function update(StoreTaskNote $request, $id)
    {
        $note = ZoomMeetingNote::findOrFail($id);

        $note->note = trim_editor($request->note);
        $note->save();

        $this->notes = ZoomMeetingNote::with('meeting')->where('zoom_meeting_id', $note->zoom_meeting_id)->orderByDesc('id')->get();
        $view = view('tasks.notes.show', $this->data)->render();

        return Reply::dataOnly(['status' => 'success', 'view' => $view]);

    }
}
