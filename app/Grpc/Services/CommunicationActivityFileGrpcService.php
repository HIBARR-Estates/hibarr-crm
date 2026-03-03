<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\CommunicationActivityFileServiceInterface;
use App\Grpc\Generated\CommunicationActivityFile\ListCommunicationActivityFilesRequest;
use App\Grpc\Generated\CommunicationActivityFile\ListCommunicationActivityFilesResponse;
use App\Grpc\Generated\CommunicationActivityFile\StreamCommunicationActivityFilesRequest;
use App\Grpc\Generated\CommunicationActivityFile\CommunicationActivityFileBatch;
use App\Grpc\Generated\CommunicationActivityFile\CommunicationActivityFile as CommunicationActivityFileMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\CommunicationActivity;
use App\Models\CommunicationActivityFile;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class CommunicationActivityFileGrpcService implements CommunicationActivityFileServiceInterface
{
    public function List(ContextInterface $ctx, ListCommunicationActivityFilesRequest $in): ListCommunicationActivityFilesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = CommunicationActivityFile::whereIn('activity_id', CommunicationActivity::where('company_id', $companyId)->select('id'));

            if ($in->hasActivityId()) {
                $query->where('activity_id', $in->getActivityId());
            }
            if ($in->hasFileType()) {
                $query->where('file_type', $in->getFileType());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('file_url', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'activity_id', 'file_type', 'file_size', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListCommunicationActivityFilesResponse();
            foreach ($paginator->items() as $file) {
                $response->getResult()[] = $this->buildMessage($file);
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

    public function Stream(ContextInterface $ctx, StreamCommunicationActivityFilesRequest $in): CommunicationActivityFileBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = CommunicationActivityFile::whereIn('activity_id', CommunicationActivity::where('company_id', $companyId)->select('id'));

            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            if ($in->hasActivityId()) {
                $query->where('activity_id', $in->getActivityId());
            }
            if ($in->hasFileType()) {
                $query->where('file_type', $in->getFileType());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('file_url', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new CommunicationActivityFileBatch();
            foreach ($records as $file) {
                $batch->getResult()[] = $this->buildMessage($file);
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

    private function buildMessage(CommunicationActivityFile $file): CommunicationActivityFileMessage
    {
        $msg = new CommunicationActivityFileMessage();
        $msg->setId($file->id);
        $msg->setActivityId($file->activity_id ?? 0);
        $msg->setFileUrl($file->file_url ?? '');
        $msg->setFileType($file->file_type ?? '');
        $msg->setFileSize($file->file_size ?? 0);
        $msg->setCreatedAt($this->dateToString($file->created_at));
        $msg->setUpdatedAt($this->dateToString($file->updated_at));

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
        \Log::error('CommunicationActivityFileGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
