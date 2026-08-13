<?php

namespace App\Http\Controllers;

use App\DataTables\LeadNotesDataTable;
use App\Helper\Reply;
use App\Http\Requests\Lead\StoreLeadNote;
use App\Http\Requests\StoreDealNote;
use App\Models\DealNote;
use App\Models\Deal;
use App\Models\User;
use App\Services\PermissionService;
use App\Services\Reminders\NoteReminderSync;
use App\Traits\RecordsCrmEvents;
use Illuminate\Http\Request;

class DealNoteController extends AccountBaseController
{
    use RecordsCrmEvents;

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.notes';
        $this->middleware(function ($request, $next) {
            return $next($request);
        });
    }

    public function index(LeadNotesDataTable $dataTable)
    {
        abort_403(!(in_array(user()->permission('view_deal_note'), ['all', 'added'])));

        return $dataTable->render('leads.notes.index', $this->data);
    }

    /**
     * JSON endpoint for the notes tab — fetched independently by the frontend
     * instead of riding the deal page's deferred-prop bundle. Logic relocated
     * verbatim from the former `notes` deferred prop on DealController::show().
     */
    public function dealNotes(Request $request, $dealId)
    {
        $deal = Deal::findOrFail($dealId);
        $dealRules = [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ];
        $access = PermissionService::checkAccess(user(), 'view_deals', $deal, $dealRules);
        abort_403(!$access['canAccess']);

        $notes = DealNote::with('addedBy')
            ->where('deal_id', $dealId)
            ->orderBy('created_at', 'desc')
            ->get();

        $viewNotesPermission = user()->permission('view_deal_note');

        if ($viewNotesPermission == 'none') {
            $notes = collect();
        } elseif ($viewNotesPermission == 'added') {
            $notes = $notes->where('added_by', user()->id)->values();
        } elseif ($viewNotesPermission == 'owned') {
            $notes = $notes->where('added_by', '!=', user()->id)->values();
        }

        return response()->json(['status' => 'success', 'data' => $notes]);
    }

    public function create()
    {
        abort_403(!in_array(user()->permission('add_deal_note'), ['all', 'added', 'both']));

        $this->employees = User::allEmployees();

        $this->pageTitle = __('modules.deal.addDealNote');
        $this->leadId = request('lead');

        $this->view = 'leads.notes.create';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('leads.create', $this->data);
    }

    public function show($id)
    {
        $this->note = DealNote::findOrFail($id);

        /** @phpstan-ignore-next-line */
        $this->noteMembers = $this->note->members->pluck('user_id')->toArray();
        $this->employees = User::whereIn('id', $this->noteMembers)->get();

        $viewClientNotePermission = user()->permission('view_deal_note');
        $memberIds = $this->note->members->pluck('user_id')->toArray(); /** @phpstan-ignore-line */

        abort_403(!($viewClientNotePermission == 'all'
            || ($viewClientNotePermission == 'added' && $this->note->added_by == user()->id)
            || ($viewClientNotePermission == 'owned' && in_array(user()->id, $memberIds) && in_array('employee', user_roles()))
            || ($viewClientNotePermission == 'both' && (in_array(user()->id, $memberIds) || $this->note->added_by == user()->id))
            )
        );

        $this->pageTitle = __('modules.deal.dealNote');

        if (request()->ajax()) {
            $html = view('leads.notes.show', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'leads.notes.show';
        return view('leads.create', $this->data);

    }

    public function store(StoreDealNote $request)
    {
        abort_403(!in_array(user()->permission('add_deal_note'), ['all', 'added', 'both']));

        // Watchers can see everything but never write — see Deal::hasTeamMemberAccess().
        // A generic 'add_deal_note' scope doesn't know about deal-specific watcher status,
        // so that has to be checked separately here. Admins and users with unrestricted
        // edit_deals keep write access even if they are also listed as watchers.
        $noteDeal = Deal::find($request->lead_id);
        $isUnrestrictedWriter = in_array('admin', user_roles())
            || user()->permission('edit_deals') === 'all';
        if (!$isUnrestrictedWriter
            && $noteDeal
            && $noteDeal->added_by != user()->id
            && !$noteDeal->hasTeamMemberAccess(user()->id)
            && $noteDeal->dealWatchers()->where('user_id', user()->id)->exists()
        ) {
            abort_403(true);
        }

        $note = new DealNote();
        $note->title = $request->filled('title') ? $request->title : null;
        $note->deal_id = $request->lead_id;
        $note->details = trim_editor($request->details);
        if ($request->filled('remind_at')) {
            $note->remind_at = $request->remind_at;
        }
        if ($request->exists('reminders')) {
            $note->reminders = $request->input('reminders');
        }
        $note->save();

        \Log::info('Deal Note Created: ', ['id' => $note->id, 'deal_id' => $note->deal_id,]);

        // ── CRM Event: deal_note_added ──
        $deal = Deal::withoutGlobalScopes()->find($note->deal_id);
        if ($deal) {
            $this->recordCrmEvent('deal_note_added', $deal, [
                'metadata' => [
                    'comment' => 'Note added: ' . ($note->title ?? 'Untitled'),
                    'note_id' => $note->id,
                    'note_title' => $note->title,
                ],
            ]);
        }

        app(NoteReminderSync::class)->syncFromDealNote($note->load('deal.leadAgent.user', 'addedBy'));

        return Reply::successWithData(__('messages.recordSaved'), ['redirectUrl' => route('deals.show', $note->deal_id) . '?tab=notes', 'data' => $note->load('addedBy')]);
    }

    public function edit($id)
    {
        $this->pageTitle = __('modules.deal.editDealNote');

        $this->note = DealNote::findOrFail($id);
        $editClientNotePermission = user()->permission('view_deal_note');
        $memberIds = $this->note->members->pluck('user_id')->toArray(); /** @phpstan-ignore-line */

        abort_403(!($editClientNotePermission == 'all'
            || ($editClientNotePermission == 'added' && user()->id == $this->note->added_by)
            || ($editClientNotePermission == 'owned' && in_array('employee', user_roles()))
            || ($editClientNotePermission == 'both' && ($this->note->added_by == user()->id ))
        ));

        /** @phpstan-ignore-next-line */
        $this->leadId = $this->note->deal_id;

        if (request()->ajax()) {
            $html = view('leads.notes.edit', $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        $this->view = 'leads.notes.edit';
        return view('leads.create', $this->data);

    }

    public function update(StoreDealNote $request, $id)
    {
        $note = DealNote::findOrFail($id);
        $note->title = $request->filled('title') ? $request->title : null;
        $note->details = trim_editor($request->details);
        if ($request->exists('remind_at')) {
            $note->remind_at = $request->filled('remind_at') ? $request->remind_at : null;
        }
        if ($request->exists('reminders')) {
            $note->reminders = $request->input('reminders');
        }
        $note->save();

        app(NoteReminderSync::class)->syncFromDealNote($note->load('deal.leadAgent.user', 'addedBy'));

        return Reply::successWithData(__('messages.updateSuccess'), ['redirectUrl' => route('deals.show', $note->deal_id) . '?tab=notes', 'data' => $note->load('addedBy')]);
    }

    public function destroy($id)
    {
        $this->note = DealNote::findOrFail($id);
        $this->deletePermission = user()->permission('delete_deal_note');

        abort_403(!($this->deletePermission == 'all'
            || ($this->deletePermission == 'added' && $this->note->added_by == user()->id))
            || ($this->deletePermission == 'owned' && in_array('employee', user_roles()))
            || ($this->deletePermission == 'both' && ($this->note->added_by == user()->id ))
        );
        app(NoteReminderSync::class)->cancelForDealNote($this->note);
        $this->note->delete();

        return Reply::successWithData(__('messages.deleteSuccess'), ['redirectUrl' => route('deals.show', $this->note->deal_id) . '?tab=notes']);
    }

    public function applyQuickAction(Request $request)
    {
        if ($request->action_type == 'delete') {
            $this->deleteRecords($request);
            return Reply::success(__('messages.deleteSuccess'));
        }

        return Reply::error(__('messages.selectAction'));
    }

    protected function deleteRecords($request)
    {
        abort_403(!(user()->permission('delete_deal_note') == 'all'));

        DealNote::whereIn('id', explode(',', $request->row_ids))->delete();
        return true;
    }

}
