<?php

namespace App\Services;

use App\Enums\IntegrationOrigin;
use App\Models\DealNote;
use App\Models\LeadNote;
use App\Models\SallyMeetingInsight;
use App\Models\SallySuggestionLog;
use App\Models\User;
use App\Services\Reminders\NoteReminderSync;
use App\Scopes\CompanyScope;
use App\Traits\RecordsCrmEvents;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Turns a Sally suggested note into a normal CRM note, authored by the agent
 * who logged it and carrying the existing Sally integration-origin badge.
 *
 * The suggestion keeps its card state via the sally_suggestion_logs row —
 * its unique key on (insight, suggestion id) is what makes logging twice
 * impossible, even across the two workspaces and concurrent requests.
 */
class SallySuggestionLogService
{
    use RecordsCrmEvents;

    /**
     * @param  string|null  $text  Null logs the suggestion's working text as-is;
     *                             a provided text is the agent's edited version.
     */
    public function log(SallyMeetingInsight $insight, string $suggestionId, ?string $text, User $user): SallySuggestionLog
    {
        $working = $this->findSuggestion($insight, $suggestionId);

        return DB::transaction(function () use ($insight, $suggestionId, $text, $user, $working) {
            // Re-read under a lock: a concurrent log for the same suggestion
            // must lose here rather than double-create the note.
            $existingLog = SallySuggestionLog::withoutGlobalScope(CompanyScope::class)
                ->where('sally_meeting_insight_id', $insight->id)
                ->where('suggestion_id', $suggestionId)
                ->lockForUpdate()
                ->first();

            if ($existingLog) {
                throw ValidationException::withMessages([
                    'suggestion' => ['This suggestion was already logged as a note.'],
                ]);
            }

            $mode = $text === null ? SallySuggestionLog::MODE_AS_IS : SallySuggestionLog::MODE_AFTER_EDIT;
            $loggedText = SallyMeetingInsightService::sanitizePlainText($text ?? $working['text']);

            if ($loggedText === null) {
                throw ValidationException::withMessages([
                    'text' => ['Suggestion text is required.'],
                ]);
            }

            $note = $this->createNote($insight, $loggedText, $user);

            $log = SallySuggestionLog::create([
                'company_id' => $insight->company_id,
                'sally_meeting_insight_id' => $insight->id,
                'suggestion_id' => $suggestionId,
                'lead_id' => $note instanceof LeadNote ? $note->lead_id : null,
                'deal_id' => $note instanceof DealNote ? $note->deal_id : null,
                'note_id' => $note->id,
                'logged_mode' => $mode,
                'logged_text' => $loggedText,
                'logged_by' => $user->id,
                'logged_at' => now(),
            ]);

            // The card always shows what was actually logged, so the working
            // copy adopts the logged text (and counts as agent-edited when
            // the agent changed it before logging).
            $items = array_values($insight->suggested_notes ?? []);
            foreach ($items as $index => $item) {
                if ((string) ($item['id'] ?? '') === $suggestionId) {
                    $items[$index]['text'] = $loggedText;
                    $items[$index]['edited'] = $mode === SallySuggestionLog::MODE_AFTER_EDIT;
                    break;
                }
            }
            $insight->suggested_notes = $items;
            $insight->save();

            return $log;
        });
    }

    /**
     * @return array{id: string, type: string, text: string, edited: bool}
     */
    public function findSuggestion(SallyMeetingInsight $insight, string $suggestionId): array
    {
        foreach ($insight->suggested_notes ?? [] as $item) {
            if ((string) ($item['id'] ?? '') === $suggestionId) {
                return $item;
            }
        }

        throw new \Illuminate\Database\Eloquent\ModelNotFoundException;
    }

    private function createNote(SallyMeetingInsight $insight, string $text, User $user): LeadNote|DealNote
    {
        $details = SallyMeetingInsightService::suggestionTextToEditorHtml($text);

        if ($insight->lead_id) {
            $note = new LeadNote;
            $note->lead_id = $insight->lead_id;
            $note->title = null;
            $note->details = $details;
            $note->type = 0;
            $note->integration_origin = IntegrationOrigin::SALLY;
            $note->added_by = $user->id;
            $note->last_updated_by = $user->id;
            $note->save();

            // The observer notifies; the CRM event mirrors the manual note
            // form (LeadNoteController::store), which records it explicitly.
            $this->recordCrmEvent('lead_note_added', $note->lead, [
                'metadata' => [
                    'comment' => 'Note added: '.($note->title ?? 'Untitled'),
                    'note_id' => $note->id,
                    'note_title' => $note->title,
                    'note_type' => $note->type == 1 ? 'private' : 'public',
                ],
            ]);

            app(NoteReminderSync::class)->syncFromLeadNote($note->load(['lead', 'addedBy', 'members']));

            return $note;
        }

        if ($insight->deal_id) {
            $note = new DealNote;
            $note->deal_id = $insight->deal_id;
            $note->title = null;
            $note->details = $details;
            $note->integration_origin = IntegrationOrigin::SALLY;
            $note->added_by = $user->id;
            $note->last_updated_by = $user->id;
            $note->save();
            $note->setRelation('deal', $insight->deal);

            // deal_note_added is recorded by DealNoteObserver; do not log it
            // again here (see DealNoteController::store).
            app(NoteReminderSync::class)->syncFromDealNote($note);

            return $note;
        }

        throw ValidationException::withMessages([
            'insight' => ['The insight is not attached to a lead or a deal.'],
        ]);
    }
}
