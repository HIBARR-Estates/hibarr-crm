<?php

namespace App\Services;

use App\Models\DealFollowUp;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CalendarSyncService
{
    public const PLATFORM_ZOHO = 'zoho';

    public function enqueueEvent(DealFollowUp $followUp, string $platform = self::PLATFORM_ZOHO): ?string
    {
        $payload = $this->buildPayload($followUp);

        $response = $this->olRequest('POST', "/crm/events/{$platform}", $payload);
        if (!$response) {
            return null;
        }

        return $this->extractJobIdFromCreateLikeResponse($response, $followUp->id);
    }

    public function retryEvent(string $jobId): ?string
    {
        $response = $this->olRequest(
            'POST',
            "/crm/events/jobs/{$jobId}/retry",
            []
        );

        if (!$response) {
            return null;
        }

        return $this->extractJobIdFromCreateLikeResponse($response, $jobId);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getJobStatus(string $jobId): ?array
    {
        $response = $this->olRequest(
            'GET',
            "/crm/events/jobs/{$jobId}/status",
            []
        );

        if (!$response) {
            return null;
        }

        if (!$response->successful()) {
            Log::error('CalendarSyncService: OL status returned non-2xx', [
                'jobId' => $jobId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [
                '_httpStatus' => $response->status(),
                'error' => $response->json('data.error')
                    ?? ['code' => (string) $response->status(), 'message' => $response->json('message') ?? 'Status request failed'],
            ];
        }

        $data = $response->json('data');

        return is_array($data) ? $data : null;
    }

    public function deleteEvent(string $eventUid, int $creatorUserId): bool
    {
        $response = $this->olRequest(
            'DELETE',
            "/crm/events/{$eventUid}",
            ['creatorUserId' => $creatorUserId]
        );

        if (!$response) {
            return false;
        }

        // 204 No Content or any 2xx
        if ($response->successful() || $response->status() === 204) {
            return true;
        }

        Log::error('CalendarSyncService: OL delete returned non-2xx', [
            'eventUid' => $eventUid,
            'creatorUserId' => $creatorUserId,
            'status' => $response->status(),
            'body' => $response->body(),
        ]);

        return false;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function olRequest(string $method, string $path, array $payload): ?Response
    {
        $baseUrl = (string) config('services.ol.base_url', '');
        $apiKey = (string) config('services.ol.api_key', '');
        $timeout = (int) config('services.ol.timeout', 15);

        if ($baseUrl === '' || $apiKey === '') {
            Log::error('CalendarSyncService: OL config missing', [
                'base_url_set' => $baseUrl !== '',
                'api_key_set' => $apiKey !== '',
            ]);

            return null;
        }

        $url = rtrim($baseUrl, '/') . $path;
        $method = strtoupper($method);

        try {
            $pending = Http::timeout($timeout)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'X-Api-Key' => $apiKey,
                    'Accept' => 'application/json',
                ]);

            return match ($method) {
                'GET' => $pending->get($url, $payload),
                'DELETE' => $pending->delete($url, $payload),
                'POST' => $pending->post($url, $payload),
                'PUT' => $pending->put($url, $payload),
                default => throw new \InvalidArgumentException("Unsupported HTTP method: {$method}"),
            };
        } catch (\Throwable $e) {
            Log::error('CalendarSyncService: OL request failed', [
                'method' => $method,
                'url' => $url,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function extractJobIdFromCreateLikeResponse(Response $response, string|int $context): ?string
    {
        if (!$response->successful()) {
            Log::error('CalendarSyncService: OL returned non-2xx', [
                'context' => $context,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return null;
        }

        $data = $response->json('data');
        $jobId = $data['jobId'] ?? null;

        if (!is_string($jobId) || trim($jobId) === '') {
            Log::warning('CalendarSyncService: OL response missing jobId', [
                'context' => $context,
                'data' => $data,
            ]);
            return null;
        }

        return $jobId;
    }

    /**
     * OL payload contract for:
     * POST /v1/crm/events/{platform}
     *
     * @return array<string, mixed>
     */
    private function buildPayload(DealFollowUp $followUp): array
    {
        $followUp->loadMissing([
            'meetingType',
            'deal',
        ]);

        $creatorUserId = $followUp->added_by;
        $participants = is_array($followUp->participants) ? $followUp->participants : [];

        $attendeeEmails = [];
        if ($participants !== []) {
            $attendeeEmails = User::whereIn('id', $participants)
                ->pluck('email')
                ->filter()
                ->values()
                ->all();
        }

        // best-effort deep-link: deal page is a stable route in this CRM
        $crmMeetingUrl = $followUp->deal_id
            ? url("/account/deals/{$followUp->deal_id}")
            : ($followUp->lead_id ? url("/account/lead-contact/{$followUp->lead_id}") : null);

        // scheduledAt should be ISO-8601 UTC. next_follow_up_date is cast to datetime on the model.
        $scheduledAt = $followUp->next_follow_up_date instanceof Carbon
            ? $followUp->next_follow_up_date->toISOString()
            : now()->toISOString();

        return [
            'meetingId' => (string) $followUp->id,
            'creatorUserId' => $creatorUserId,
            'title' => $followUp->meetingType?->name ?? 'Meeting',
            'scheduledAt' => $scheduledAt,
            'duration' => (int) ($followUp->duration ?? $followUp->getEffectiveDuration()),
            'description' => (string) ($followUp->remark ?? ''),
            'location' => (string) ($followUp->location ?? ''),
            'meetingLink' => (string) ($followUp->meeting_link ?? ''),
            'crmMeetingUrl' => $crmMeetingUrl,
            'attendeeEmails' => $attendeeEmails,
            'createZohoMeeting' => false,
        ];
    }
}
