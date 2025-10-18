<?php

namespace App\Http\Controllers;

use App\Models\MeetingSummary;
use App\Models\DealFollowUp;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MeetingSummaryController extends Controller
{
    /**
     * Store a new meeting summary
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'summary_object' => 'required|array',
            'meeting_type_id' => 'nullable|integer|exists:meeting_types,id',
            'deal_id' => 'nullable|integer|exists:deals,id',
            'meeting_id' => 'nullable|string',
            'meeting_platform' => 'nullable|string'
        ]);

        $meetingSummary = DB::transaction(function () use ($request) {
            $meetingSummary = MeetingSummary::create([
                'summary_object' => $request->summary_object,
                'meeting_type_id' => $request->meeting_type_id,
                'deal_id' => $request->deal_id,
            ]);

            if ($request->filled('meeting_id')) {
                $leadFollowUp = DealFollowUp::where('meeting_id', $request->meeting_id)
                    ->when($request->filled('meeting_platform'), function ($q) use ($request) {
                        $q->whereRaw('LOWER(location) = LOWER(?)', [$request->meeting_platform]);
                    })
                    ->lockForUpdate()
                    ->first();

                if ($leadFollowUp) {
                    $leadFollowUp->summary_id = $meetingSummary->id;
                    $leadFollowUp->save();
                }
            }

            return $meetingSummary;
        });

        return response()->json(
            Reply::successWithData('modules.meeting.messages.created', [
                'data' => $meetingSummary
            ]), 201
        );
    }

    /**
     * Display the specified meeting summary
     */
    public function show($summaryId)
    {
        try {
            // Find the meeting summary by ID
            $meetingSummary = MeetingSummary::find($summaryId);
            
            if (!$meetingSummary) {
                if (request()->ajax()) {
                    return view('leads.ajax.meeting-summary-modal', ['summary' => []])->withErrors(['error' => 'Meeting summary not found']);
                }
                return response()->json([
                    'success' => false,
                    'message' => 'Meeting summary not found'
                ], 404);
            }
            
            // Load relationships
            $meetingSummary->load(['deal']);
            
            // Load meetingType only if it exists
            if ($meetingSummary->meeting_type_id) {
                $meetingSummary->load(['meetingType']);
            }

            // Process sections with proper ordering and provide structured data
            $summaryData = $meetingSummary->toArray();
            $summaryData['processed_sections'] = $this->processSummarySections($summaryData['summary_object']);

            if (request()->ajax()) {
                return view('leads.ajax.meeting-summary-modal', ['summary' => $summaryData]);
            }
            
            return response()->json([
                'success' => true,
                'data' => $meetingSummary
            ]);
        } catch (\Exception $e) {
            \Log::error('MeetingSummary show error: ' . $e->getMessage());
            
            if (request()->ajax()) {
                return view('leads.ajax.meeting-summary-modal', ['summary' => []])->withErrors(['error' => $e->getMessage()]);
            }
            
            return response()->json([
                'success' => false,
                'message' => 'Error loading meeting summary'
            ], 500);
        }
    }

    /**
     * Update meeting summary
     */
    public function update(Request $request, $id): JsonResponse
    {
        $request->validate([
            'summary_object' => 'sometimes|array',
            'meeting_type_id' => 'sometimes|integer|exists:meeting_types,id',
            'deal_id' => 'sometimes|integer|exists:deals,id',
        ]);

        $meetingSummary = MeetingSummary::findOrFail($id);
        $meetingSummary->update($request->only(['summary_object', 'meeting_type_id', 'deal_id']));

        return response()->json(
            Reply::successWithData('modules.meeting.messages.updated', [
                'data' => $meetingSummary
            ])
        );
    }

    /**
     * Delete meeting summary
     */
    public function destroy($id): JsonResponse
    {
        $meetingSummary = DB::transaction(function () use ($id) {
            $meetingSummary = MeetingSummary::findOrFail($id);
            
            // Nullify orphaned references
            DealFollowUp::where('summary_id', $id)->update(['summary_id' => null]);
            
            $meetingSummary->delete();

            return $meetingSummary;
        });

        return response()->json(
            Reply::success('modules.meeting.messages.deleted')
        );
    }

    /**
     * Get meeting summary by meeting ID
     */
    public function getByMeetingId($meetingId, Request $request): JsonResponse
    {
        $query = DealFollowUp::where('meeting_id', $meetingId);
        
        if ($request->filled('meeting_platform')) {
            $query->whereRaw('LOWER(location) = LOWER(?)', [$request->meeting_platform]);
        }
        
        $leadFollowUp = $query->first();
        
        if (!$leadFollowUp || !$leadFollowUp->summary_id) {
            return response()->json([
                'success' => false,
                'message' => 'Meeting summary not found'
            ], 404);
        }

        $meetingSummary = MeetingSummary::with(['meetingType', 'deal'])->find($leadFollowUp->summary_id);
        if (!$meetingSummary) {
            return response()->json([
                'success' => false,
                'message' => 'Meeting summary not found'
            ], 404);
        }
        return response()->json([
            'success' => true,
            'data' => $meetingSummary
        ]);
    }

    /**
     * Process summary sections with proper ordering and provide structured data
     */
    private function processSummarySections($summaryObject)
    {
        if (empty($summaryObject)) {
            return [];
        }

        if (!is_array($summaryObject) && !is_object($summaryObject)) {
            return [
                [
                    'title' => __('modules.meeting.summary'),
                    'content' => $summaryObject,
                    'is_simple' => true
                ]
            ];
        }

        $orderedSections = [
            'executive_summary' => __('modules.meeting.sections.executive_summary'),
            'key_points_discussed' => __('modules.meeting.sections.key_points_discussed'),
            'action_points' => __('modules.meeting.sections.action_points'),
            'sales_objections' => __('modules.meeting.sections.sales_objections'),
            'recommendations' => __('modules.meeting.sections.recommendations')
        ];
        
        $processedSections = [];
        
        // Helper function to find section key regardless of format (underscore vs space)
        $findSectionKey = function($targetKey, $data) {
            $variations = [
                $targetKey,
                str_replace('_', ' ', $targetKey),
                str_replace(' ', '_', $targetKey)
            ];
            foreach ($variations as $variation) {
                if (isset($data[$variation])) {
                    return $variation;
                }
            }
            return null;
        };

        // First, process sections in the desired order
        foreach($orderedSections as $sectionKey => $sectionTitle) {
            $actualKey = $findSectionKey($sectionKey, $summaryObject);
            if($actualKey) {
                $processedSections[] = [
                    'title' => $sectionTitle,
                    'content' => $this->processSectionContent($summaryObject[$actualKey])
                ];
            }
        }
        
        // Then process any remaining sections not in the ordered list
        foreach($summaryObject as $key => $value) {
            $alreadyProcessed = false;
            foreach($processedSections as $processed) {
                if ($processed['title'] === ucwords(str_replace('_', ' ', $key))) {
                    $alreadyProcessed = true;
                    break;
                }
            }
            
            if (!$alreadyProcessed) {
                $displayTitle = ucwords(str_replace('_', ' ', $key));
                
                // Check if this key has a translation
                $translationKey = 'modules.meeting.sections.' . $key;
                if (__($translationKey) !== $translationKey) {
                    $displayTitle = __($translationKey);
                } else {
                    // Fallback to checking against ordered sections
                    foreach($orderedSections as $sectionKey => $sectionTitle) {
                        if ($key === $sectionKey || $key === str_replace('_', ' ', $sectionKey) || $key === str_replace(' ', '_', $sectionKey)) {
                            $displayTitle = $sectionTitle;
                            break;
                        }
                    }
                }
                
                $processedSections[] = [
                    'title' => $displayTitle,
                    'content' => $this->processSectionContent($value)
                ];
            }
        }

        return $processedSections;
    }

    /**
     * Process section content and return structured data
     */
    private function processSectionContent($content)
    {
        // If content is not an array/object, return as simple content
        if (!is_array($content) && !is_object($content)) {
            return [
                'type' => 'simple',
                'value' => $content ?? __('modules.meeting.content.notSpecified')
            ];
        }

        $items = [];
        $counter = 1;

        foreach ($content as $subKey => $subValue) {
            // Clean the sub-key
            $cleanSubKey = $this->cleanSubKey($subKey, $subValue);
            
            $items[] = [
                'number' => $counter,
                'text' => $cleanSubKey
            ];
            
            $counter++;
        }

        return [
            'type' => 'list',
            'items' => $items
        ];
    }

    /**
     * Clean sub-key by removing numeric prefixes, colons, and formatting
     */
    private function cleanSubKey($subKey, $subValue)
    {
        $cleanSubKey = $subKey;
        
        // Remove numeric prefixes like "0: ", "1: ", "2: ", etc.
        $cleanSubKey = preg_replace('/^\d+\s*:\s*/', '', $cleanSubKey);
        
        // Remove just leading colon and space
        $cleanSubKey = preg_replace('/^:\s*/', '', $cleanSubKey);
        
        // Remove leading spaces
        $cleanSubKey = ltrim($cleanSubKey);
        
        // If the key is empty or just whitespace after cleaning, use the value
        if (empty(trim($cleanSubKey))) {
            $cleanSubKey = (is_scalar($subValue) ? $subValue : null) ?? __('modules.meeting.content.item');
        }
        
        // Also handle cases where the key might be just a number
        if (is_numeric(trim($cleanSubKey))) {
            // If the key is just a number, use the value as the key
            $cleanSubKey = (is_scalar($subValue) ? $subValue : null) ?? __('modules.meeting.content.item');
        }
        
        return ucwords(str_replace('_', ' ', $cleanSubKey));
    }
}
