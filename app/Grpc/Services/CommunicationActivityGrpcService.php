<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\CommunicationActivityServiceInterface;
use App\Grpc\Generated\CommunicationActivity\ListCommunicationActivitiesRequest;
use App\Grpc\Generated\CommunicationActivity\ListCommunicationActivitiesResponse;
use App\Grpc\Generated\CommunicationActivity\StreamCommunicationActivitiesRequest;
use App\Grpc\Generated\CommunicationActivity\CommunicationActivityBatch;
use App\Grpc\Generated\CommunicationActivity\CommunicationActivity as CommunicationActivityMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\CommunicationActivity;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class CommunicationActivityGrpcService implements CommunicationActivityServiceInterface
{
    public function List(ContextInterface $ctx, ListCommunicationActivitiesRequest $in): ListCommunicationActivitiesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = CommunicationActivity::where('company_id', $companyId);

            if ($in->hasDealId()) {
                $query->where('deal_id', $in->getDealId());
            }
            if ($in->hasLeadId()) {
                $query->where('lead_id', $in->getLeadId());
            }
            if ($in->hasChannelType()) {
                $query->where('channel_type', $in->getChannelType());
            }
            if ($in->hasMessageType()) {
                $query->where('message_type', $in->getMessageType());
            }
            if ($in->hasResolutionStatus()) {
                $query->where('resolution_status', $in->getResolutionStatus());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('message_content', 'like', "%{$search}%")
                      ->orWhere('subject', 'like', "%{$search}%");
                });
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'deal_id', 'lead_id', 'channel_type', 'message_type', 'resolution_status', 'timestamp', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListCommunicationActivitiesResponse();
            foreach ($paginator->items() as $activity) {
                $response->getResult()[] = $this->buildMessage($activity);
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

    public function Stream(ContextInterface $ctx, StreamCommunicationActivitiesRequest $in): CommunicationActivityBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = CommunicationActivity::where('company_id', $companyId);

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
            if ($in->hasLeadId()) {
                $query->where('lead_id', $in->getLeadId());
            }
            if ($in->hasChannelType()) {
                $query->where('channel_type', $in->getChannelType());
            }
            if ($in->hasMessageType()) {
                $query->where('message_type', $in->getMessageType());
            }
            if ($in->hasResolutionStatus()) {
                $query->where('resolution_status', $in->getResolutionStatus());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('message_content', 'like', "%{$search}%")
                      ->orWhere('subject', 'like', "%{$search}%");
                });
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new CommunicationActivityBatch();
            foreach ($records as $activity) {
                $batch->getResult()[] = $this->buildMessage($activity);
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

    private function buildMessage(CommunicationActivity $activity): CommunicationActivityMessage
    {
        $msg = new CommunicationActivityMessage();
        $msg->setId($activity->id);
        $msg->setCompanyId($activity->company_id ?? 0);
        $msg->setDealId($activity->deal_id ?? 0);
        $msg->setLeadId($activity->lead_id ?? 0);
        $msg->setParentActivityId($activity->parent_activity_id ?? 0);
        $msg->setChannelType($activity->channel_type ?? '');
        $msg->setResolutionStatus($activity->resolution_status ?? '');
        $msg->setResolutionAttempts($activity->resolution_attempts ?? 0);
        $msg->setMessageContent($activity->message_content ?? '');
        $msg->setSenderInfo(is_array($activity->sender_info) || is_object($activity->sender_info) ? json_encode($activity->sender_info) : ($activity->sender_info ?? ''));
        $msg->setTimestamp($this->dateToString($activity->timestamp));
        $msg->setMetadata(is_array($activity->metadata) || is_object($activity->metadata) ? json_encode($activity->metadata) : ($activity->metadata ?? ''));
        $msg->setEmail($activity->email ?? '');
        $msg->setPhoneNumber($activity->phone_number ?? '');
        $msg->setInstagramUsername($activity->instagram_username ?? '');
        $msg->setTelegramUsername($activity->telegram_username ?? '');
        $msg->setWhatsappUsername($activity->whatsapp_username ?? '');
        $msg->setFirstName($activity->first_name ?? '');
        $msg->setLastName($activity->last_name ?? '');
        $msg->setMessageType($activity->message_type ?? '');
        $msg->setSubject($activity->subject ?? '');
        $msg->setLastResolutionAttemptAt($this->dateToString($activity->last_resolution_attempt_at));
        $msg->setChatId($activity->chat_id ?? '');
        $msg->setCreatedAt($this->dateToString($activity->created_at));
        $msg->setUpdatedAt($this->dateToString($activity->updated_at));

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
        \Log::error('CommunicationActivityGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
