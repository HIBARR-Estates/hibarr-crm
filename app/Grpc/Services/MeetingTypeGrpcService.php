<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\MeetingTypeServiceInterface;
use App\Grpc\Generated\MeetingType\ListMeetingTypesRequest;
use App\Grpc\Generated\MeetingType\ListMeetingTypesResponse;
use App\Grpc\Generated\MeetingType\StreamMeetingTypesRequest;
use App\Grpc\Generated\MeetingType\MeetingTypeBatch;
use App\Grpc\Generated\MeetingType\MeetingType as MeetingTypeMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\MeetingType;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class MeetingTypeGrpcService implements MeetingTypeServiceInterface
{
    public function List(ContextInterface $ctx, ListMeetingTypesRequest $in): ListMeetingTypesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'name';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = MeetingType::where('company_id', $companyId);

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('name', 'like', "%{$search}%");
            }
            if ($in->hasIsActive()) {
                $query->where('is_active', $in->getIsActive());
            }

            $allowedSortColumns = ['id', 'name', 'is_active', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'name';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListMeetingTypesResponse();
            foreach ($paginator->items() as $meetingType) {
                $response->getResult()[] = $this->buildMessage($meetingType);
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

    public function Stream(ContextInterface $ctx, StreamMeetingTypesRequest $in): MeetingTypeBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = MeetingType::where('company_id', $companyId);

            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('name', 'like', "%{$search}%");
            }
            if ($in->hasIsActive()) {
                $query->where('is_active', $in->getIsActive());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new MeetingTypeBatch();
            foreach ($records as $meetingType) {
                $batch->getResult()[] = $this->buildMessage($meetingType);
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

    private function buildMessage(MeetingType $meetingType): MeetingTypeMessage
    {
        $msg = new MeetingTypeMessage();
        $msg->setId($meetingType->id);
        $msg->setCompanyId($meetingType->company_id ?? 0);
        $msg->setName($meetingType->name ?? '');
        $msg->setDescription($meetingType->description ?? '');
        $msg->setColor($meetingType->color ?? '');
        $msg->setIsActive((bool) ($meetingType->is_active ?? false));
        $msg->setCreatedAt($this->dateToString($meetingType->created_at));
        $msg->setUpdatedAt($this->dateToString($meetingType->updated_at));

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
        \Log::error('MeetingTypeGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
