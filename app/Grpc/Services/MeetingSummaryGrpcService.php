<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\MeetingSummaryServiceInterface;
use App\Grpc\Generated\MeetingSummary\ListMeetingSummariesRequest;
use App\Grpc\Generated\MeetingSummary\ListMeetingSummariesResponse;
use App\Grpc\Generated\MeetingSummary\StreamMeetingSummariesRequest;
use App\Grpc\Generated\MeetingSummary\MeetingSummaryBatch;
use App\Grpc\Generated\MeetingSummary\MeetingSummary as MeetingSummaryMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Deal;
use App\Models\MeetingSummary;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class MeetingSummaryGrpcService implements MeetingSummaryServiceInterface
{
    public function List(ContextInterface $ctx, ListMeetingSummariesRequest $in): ListMeetingSummariesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = MeetingSummary::whereIn('deal_id', Deal::where('company_id', $companyId)->select('id'));

            if ($in->hasDealId()) {
                $query->where('deal_id', $in->getDealId());
            }
            if ($in->hasMeetingTypeId()) {
                $query->where('meeting_type_id', $in->getMeetingTypeId());
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'deal_id', 'meeting_type_id', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListMeetingSummariesResponse();
            foreach ($paginator->items() as $summary) {
                $response->getResult()[] = $this->buildMessage($summary);
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

    public function Stream(ContextInterface $ctx, StreamMeetingSummariesRequest $in): MeetingSummaryBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = MeetingSummary::whereIn('deal_id', Deal::where('company_id', $companyId)->select('id'));

            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            if ($in->hasDealId()) {
                $query->where('deal_id', $in->getDealId());
            }
            if ($in->hasMeetingTypeId()) {
                $query->where('meeting_type_id', $in->getMeetingTypeId());
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new MeetingSummaryBatch();
            foreach ($records as $summary) {
                $batch->getResult()[] = $this->buildMessage($summary);
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

    private function buildMessage(MeetingSummary $summary): MeetingSummaryMessage
    {
        $msg = new MeetingSummaryMessage();
        $msg->setId($summary->id);
        $msg->setMeetingTypeId($summary->meeting_type_id ?? 0);
        $msg->setDealId($summary->deal_id ?? 0);
        $msg->setSummaryObject(is_array($summary->summary_object) || is_object($summary->summary_object) ? json_encode($summary->summary_object) : ($summary->summary_object ?? ''));
        $msg->setCreatedAt($this->dateToString($summary->created_at));
        $msg->setUpdatedAt($this->dateToString($summary->updated_at));

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
        \Log::error('MeetingSummaryGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
