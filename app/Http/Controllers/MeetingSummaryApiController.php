<?php

namespace App\Http\Controllers;

use App\Models\MeetingSummary;
use App\Models\DealFollowUp;
use App\Models\Deal;
use App\Models\User;
use App\Helper\Reply;
use App\Exceptions\MeetingSummaryException;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class MeetingSummaryApiController extends Controller
{
    /**
     * Get or create meeting summary
     */
    public function getMeetingSummary(Request $request): JsonResponse
    {
        $request->validate([
            'meeting_id' => 'required|string',
            'meeting_platform' => 'required|string',
            'meeting_summary' => 'required|array'
        ]);

        $meetingId = $request->meeting_id;
        $meetingPlatform = $request->meeting_platform;
        $meetingSummary = $request->meeting_summary;

        try {
            // Find meeting info - will throw exception if not found
            $meetingInfo = $this->findOrFailMeetingId($meetingId, $meetingPlatform);
            
            // Meeting found, proceed with create/update
            return $this->createOrUpdateSummary($meetingSummary, $meetingId, $meetingPlatform, $meetingInfo);
            
        } catch (MeetingSummaryException $e) {
            // Handle meeting summary specific errors
            return response()->json(
                Reply::error($e->getMessage(), $e->getErrorCode(), $e->getAdditionalData()),
                $e->getCode()
            );
        }
    }

    /**
     * Create or update meeting summary
     */
    private function createOrUpdateSummary(array $meetingSummary, string $meetingId, string $meetingPlatform, array $meetingInfo): JsonResponse
    {
        // Validate required meeting info fields
        if (!isset($meetingInfo['deal_id']) || !is_numeric($meetingInfo['deal_id'])) {
            throw new \InvalidArgumentException('Invalid or missing deal_id in meeting info');
        }
        
        if (!isset($meetingInfo['meeting_type_id']) || !is_numeric($meetingInfo['meeting_type_id'])) {
            throw new \InvalidArgumentException('Invalid or missing meeting_type_id in meeting info');
        }
        
        // Validate meeting summary is not empty
        if (empty($meetingSummary)) {
            throw new \InvalidArgumentException('Meeting summary cannot be empty');
        }
        
        [$summary, $leadFollowUp, $action] = DB::transaction(function () use ($meetingSummary, $meetingId, $meetingPlatform, $meetingInfo) {
            $leadFollowUp = DealFollowUp::where('meeting_id', $meetingId)
                ->whereRaw('LOWER(location) = ?', [mb_strtolower($meetingPlatform)])
                ->lockForUpdate()
                ->first();

            if ($leadFollowUp && $leadFollowUp->summary_id) {
                $summary = MeetingSummary::find($leadFollowUp->summary_id);
                if ($summary) {
                    $summary->update([
                        'summary_object' => $meetingSummary,
                        'meeting_type_id' => $meetingInfo['meeting_type_id'],
                        'deal_id' => $meetingInfo['deal_id'],
                    ]);

                    return [$summary, $leadFollowUp, 'updated'];
                }
            }

            $summary = MeetingSummary::create([
                'summary_object' => $meetingSummary,
                'meeting_type_id' => $meetingInfo['meeting_type_id'],
                'deal_id' => $meetingInfo['deal_id'],
            ]);

            if ($leadFollowUp) {
                $leadFollowUp->update(['summary_id' => $summary->id]);
            }

            return [$summary, $leadFollowUp, 'created'];
        });

        DB::afterCommit(fn () => $this->sendSummaryNotification($summary, $leadFollowUp, $action));

        $status = $action === 'updated' ? 200 : 201;
        $messageKey = $action === 'updated'
            ? 'modules.meeting.messages.updated'
            : 'modules.meeting.messages.created';

        return response()->json(
            Reply::successWithData($messageKey, [
                'data' => $summary,
                'action' => $action
            ]),
            $status
        );
    }

    /**
     * Find meeting by ID and platform
     * 
     * @throws MeetingSummaryException
     */
    private function findOrFailMeetingId(string $meetingId, string $meetingPlatform): array
    {
        // Validate input parameters
        if (empty($meetingId)) {
            throw new MeetingSummaryException(
                trans('modules.meeting.messages.meetingIdRequired'),
                'meeting_id_required',
                [],
                400
            );
        }
        
        if (empty($meetingPlatform)) {
            throw new MeetingSummaryException(
                trans('modules.meeting.messages.meetingPlatformRequired'),
                'meeting_platform_required',
                [],
                400
            );
        }
        
        // Get all DealFollowUp records with the same meeting_id
        $meetings = DealFollowUp::where('meeting_id', $meetingId)->get();
        
        if ($meetings->isEmpty()) {
            throw new MeetingSummaryException(
                trans('modules.meeting.messages.meetingNotFound'),
                'meeting_not_found',
                [],
                404
            );
        }
        
        // Find the DealFollowUp record that matches the platform/location (case-insensitive)
        $meetingInfo = $meetings->first(function ($meeting) use ($meetingPlatform) {
            return strtolower($meeting->location) === strtolower($meetingPlatform);
        });
        
        if (!$meetingInfo) {
            // If no exact match, provide available platforms for this meeting_id
            $availablePlatforms = $meetings->pluck('location')->unique()->values()->toArray();
            throw new MeetingSummaryException(
                trans('modules.meeting.messages.platformMismatchMessage') . " '{$meetingPlatform}'",
                'platform_mismatch',
                [
                    'available_platforms' => $availablePlatforms,
                    'meeting_id' => $meetingId
                ],
                400
            );
        }
        
        // Return structured meeting data
        return [
            'deal_id' => $meetingInfo->deal_id,
            'meeting_type_id' => $meetingInfo->meeting_type_id,
            'location' => $meetingInfo->location
        ];
    }

    /**
     * Send email notification for meeting summary
     */
    private function sendSummaryNotification(MeetingSummary $summary, DealFollowUp $leadFollowUp, string $action): void
    {
        try {
            // Get the deal information
            $deal = Deal::find($summary->deal_id);
            if (!$deal) {
                return;
            }

            // Get the responsible person (deal agent)
            $responsiblePerson = null;
            if ($deal->agent_id) {
                $responsiblePerson = User::find($deal->agent_id);
            }

            // If no agent, try to get the deal creator
            if (!$responsiblePerson && $deal->added_by) {
                $responsiblePerson = User::find($deal->added_by);
            }

            // If still no responsible person, get the follow-up creator
            if (!$responsiblePerson && $leadFollowUp->added_by) {
                $responsiblePerson = User::find($leadFollowUp->added_by);
            }

            if (!$responsiblePerson) {
                return;
            }

            // Send the notification
            $responsiblePerson->notify(new \App\Notifications\MeetingSummaryNotification(
                $summary, 
                $leadFollowUp, 
                $deal, 
                $action
            ));

        } catch (\Exception $e) {
            // Log the exception for debugging and monitoring
            Log::error('Failed to send meeting summary notification', [
                'summary_id' => $summary->id ?? null,
                'deal_id' => $summary->deal_id ?? null,
                'action' => $action,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Don't throw the exception to avoid breaking the main flow
        }
    }
}
