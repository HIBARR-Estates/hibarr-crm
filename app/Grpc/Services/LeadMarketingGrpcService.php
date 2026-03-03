<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\LeadMarketingServiceInterface;
use App\Grpc\Generated\LeadMarketing\ListLeadMarketingsRequest;
use App\Grpc\Generated\LeadMarketing\ListLeadMarketingsResponse;
use App\Grpc\Generated\LeadMarketing\StreamLeadMarketingsRequest;
use App\Grpc\Generated\LeadMarketing\LeadMarketingBatch;
use App\Grpc\Generated\LeadMarketing\LeadMarketing as LeadMarketingMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\LeadMarketing;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class LeadMarketingGrpcService implements LeadMarketingServiceInterface
{
    public function List(ContextInterface $ctx, ListLeadMarketingsRequest $in): ListLeadMarketingsResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'created_at';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'asc' ? 'asc' : 'desc';

            $query = LeadMarketing::query()
                ->whereHas('lead', fn ($q) => $q->where('company_id', $companyId));

            if ($in->hasLeadId()) {
                $query->where('lead_id', $in->getLeadId());
            }
            if ($in->hasUtmSource()) {
                $query->where('utm_source', $in->getUtmSource());
            }
            if ($in->hasUtmMedium()) {
                $query->where('utm_medium', $in->getUtmMedium());
            }
            if ($in->hasUtmCampaign()) {
                $query->where('utm_campaign', $in->getUtmCampaign());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('utm_source', 'like', "%{$search}%")
                      ->orWhere('utm_campaign', 'like', "%{$search}%")
                      ->orWhere('utm_medium', 'like', "%{$search}%");
                });
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'lead_id', 'utm_source', 'utm_campaign', 'contact_score', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'created_at';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListLeadMarketingsResponse();
            foreach ($paginator->items() as $record) {
                $response->getResult()[] = $this->buildMessage($record);
            }

            $meta = new PaginationMeta();
            $meta->setCurrentPage($paginator->currentPage());
            $meta->setPerPage($paginator->perPage());
            $meta->setTotal($paginator->total());
            $meta->setTotalPages($paginator->lastPage());
            $meta->setHasMore($paginator->hasMorePages());
            $response->setPagination($meta);

            return $response;
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    // ── Stream (bulk dump) ─────────────────────────────────

    public function Stream(ContextInterface $ctx, StreamLeadMarketingsRequest $in): LeadMarketingBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = LeadMarketing::query()
                ->whereHas('lead', fn ($q) => $q->where('company_id', $companyId));

            // Incremental filters
            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            // Domain-specific filters
            if ($in->hasLeadId()) {
                $query->where('lead_id', $in->getLeadId());
            }
            if ($in->hasUtmSource()) {
                $query->where('utm_source', $in->getUtmSource());
            }
            if ($in->hasUtmCampaign()) {
                $query->where('utm_campaign', $in->getUtmCampaign());
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new LeadMarketingBatch();
            foreach ($records as $record) {
                $batch->getResult()[] = $this->buildMessage($record);
            }

            $progress = new StreamProgress();
            $progress->setProcessed($records->count());
            $progress->setTotal($total);
            $progress->setIsComplete(true);
            $batch->setProgress($progress);

            return $batch;
        } catch (GRPCException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->mapException($e);
        }
    }

    // ── Helpers ────────────────────────────────────────────

    private function buildMessage(LeadMarketing $record): LeadMarketingMessage
    {
        $msg = new LeadMarketingMessage();
        $msg->setId($record->id);
        $msg->setLeadId($record->lead_id ?? 0);
        $msg->setUtmSource($record->utm_source ?? '');
        $msg->setUtmMedium($record->utm_medium ?? '');
        $msg->setUtmCampaign($record->utm_campaign ?? '');
        $msg->setUtmContent($record->utm_content ?? '');
        $msg->setUtmTerm($record->utm_term ?? '');
        $msg->setUtmAudience($record->utm_audience ?? '');
        $msg->setTrafficSourceId($record->traffic_source_id ?? '');
        $msg->setFacebookClickId($record->facebook_click_id ?? '');
        $msg->setFacebookLeadId($record->facebook_lead_id ?? '');
        $msg->setFacebookBrowserId($record->facebook_browser_id ?? '');
        $msg->setUserAgent($record->user_agent ?? '');
        $msg->setIpAddress($record->ip_address ?? '');
        $msg->setHasRegisteredForTheWebinar((bool) ($record->has_registered_for_the_webinar ?? false));
        $msg->setHasJoinedTheFacebookGroup((bool) ($record->has_joined_the_facebook_group ?? false));
        $msg->setHasDownloadedTheEbook((bool) ($record->has_downloaded_the_ebook ?? false));
        $msg->setHasAttendedTheWebinar((bool) ($record->has_attended_the_webinar ?? false));
        $msg->setRegisteredForZoomMeeting((bool) ($record->registered_for_zoom_meeting ?? false));
        $msg->setLastWebinarDate($this->dateToString($record->last_webinar_date));
        $msg->setContactScore($record->contact_score ?? 0);
        $msg->setCreatedAt($this->dateToString($record->created_at));
        $msg->setUpdatedAt($this->dateToString($record->updated_at));

        return $msg;
    }

    private function getCompanyId(ContextInterface $ctx): int
    {
        $companyId = $ctx->getValue('authenticated_company_id');
        if (!$companyId) {
            throw new GRPCException(
                'Authentication required. Provide x-api-token and x-company-id in gRPC metadata.',
                StatusCode::UNAUTHENTICATED,
            );
        }
        return (int) $companyId;
    }

    private function dateToString(mixed $value): string
    {
        if ($value === null) return '';
        if ($value instanceof \DateTimeInterface) return $value->format('c');
        return (string) $value;
    }

    private function mapException(\Throwable $e): GRPCException
    {
        \Log::error('LeadMarketingGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
