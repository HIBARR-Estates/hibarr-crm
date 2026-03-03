<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\DealFollowUpServiceInterface;
use App\Grpc\Generated\DealFollowUp\ListDealFollowUpsRequest;
use App\Grpc\Generated\DealFollowUp\ListDealFollowUpsResponse;
use App\Grpc\Generated\DealFollowUp\StreamDealFollowUpsRequest;
use App\Grpc\Generated\DealFollowUp\DealFollowUpBatch;
use App\Grpc\Generated\DealFollowUp\DealFollowUp as DealFollowUpMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Deal;
use App\Models\DealFollowUp;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class DealFollowUpGrpcService implements DealFollowUpServiceInterface
{
    public function List(ContextInterface $ctx, ListDealFollowUpsRequest $in): ListDealFollowUpsResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = DealFollowUp::whereIn('deal_id', Deal::where('company_id', $companyId)->select('id'));

            if ($in->hasDealId()) {
                $query->where('deal_id', $in->getDealId());
            }
            if ($in->hasMeetingTypeId()) {
                $query->where('meeting_type_id', $in->getMeetingTypeId());
            }
            if ($in->hasStatus()) {
                $query->where('status', $in->getStatus());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('remark', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'deal_id', 'meeting_type_id', 'status', 'next_follow_up_date', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListDealFollowUpsResponse();
            foreach ($paginator->items() as $followUp) {
                $response->getResult()[] = $this->buildMessage($followUp);
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

    public function Stream(ContextInterface $ctx, StreamDealFollowUpsRequest $in): DealFollowUpBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = DealFollowUp::whereIn('deal_id', Deal::where('company_id', $companyId)->select('id'));

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
            if ($in->hasStatus()) {
                $query->where('status', $in->getStatus());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('remark', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new DealFollowUpBatch();
            foreach ($records as $followUp) {
                $batch->getResult()[] = $this->buildMessage($followUp);
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

    private function buildMessage(DealFollowUp $followUp): DealFollowUpMessage
    {
        $msg = new DealFollowUpMessage();
        $msg->setId($followUp->id);
        $msg->setDealId($followUp->deal_id ?? 0);
        $msg->setAddedBy($followUp->added_by ?? 0);
        $msg->setLastUpdatedBy($followUp->last_updated_by ?? 0);
        $msg->setSummaryId($followUp->summary_id ?? 0);
        $msg->setMeetingTypeId($followUp->meeting_type_id ?? 0);
        $msg->setRemark($followUp->remark ?? '');
        $msg->setNextFollowUpDate($this->dateToString($followUp->next_follow_up_date));
        $msg->setEventId($followUp->event_id ?? '');
        $msg->setMeetingId($followUp->meeting_id ?? '');
        $msg->setSendReminder($followUp->send_reminder ?? '');
        $msg->setRemindTime($followUp->remind_time ?? '');
        $msg->setRemindType($followUp->remind_type ?? '');
        $msg->setReminders(is_array($followUp->reminders) || is_object($followUp->reminders) ? json_encode($followUp->reminders) : ($followUp->reminders ?? ''));
        $msg->setStatus($followUp->status ?? '');
        $msg->setLocation($followUp->location ?? '');
        $msg->setMeetingLink($followUp->meeting_link ?? '');
        $msg->setParticipants(is_array($followUp->participants) || is_object($followUp->participants) ? json_encode($followUp->participants) : ($followUp->participants ?? ''));
        $msg->setCreatedAt($this->dateToString($followUp->created_at));
        $msg->setUpdatedAt($this->dateToString($followUp->updated_at));

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
        \Log::error('DealFollowUpGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
