<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\DealFileServiceInterface;
use App\Grpc\Generated\DealFile\ListDealFilesRequest;
use App\Grpc\Generated\DealFile\ListDealFilesResponse;
use App\Grpc\Generated\DealFile\StreamDealFilesRequest;
use App\Grpc\Generated\DealFile\DealFileBatch;
use App\Grpc\Generated\DealFile\DealFile as DealFileMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Deal;
use App\Models\DealFile;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class DealFileGrpcService implements DealFileServiceInterface
{
    public function List(ContextInterface $ctx, ListDealFilesRequest $in): ListDealFilesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = DealFile::whereIn('deal_id', Deal::where('company_id', $companyId)->select('id'));

            if ($in->hasDealId()) {
                $query->where('deal_id', $in->getDealId());
            }
            if ($in->hasUserId()) {
                $query->where('user_id', $in->getUserId());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('filename', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'deal_id', 'filename', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListDealFilesResponse();
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

    public function Stream(ContextInterface $ctx, StreamDealFilesRequest $in): DealFileBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = DealFile::whereIn('deal_id', Deal::where('company_id', $companyId)->select('id'));

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
            if ($in->hasDealId()) {
                $query->where('deal_id', $in->getDealId());
            }
            if ($in->hasUserId()) {
                $query->where('user_id', $in->getUserId());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('filename', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new DealFileBatch();
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

    private function buildMessage(DealFile $file): DealFileMessage
    {
        $msg = new DealFileMessage();
        $msg->setId($file->id);
        $msg->setDealId($file->deal_id ?? 0);
        $msg->setUserId($file->user_id ?? 0);
        $msg->setAddedBy($file->added_by ?? 0);
        $msg->setLastUpdatedBy($file->last_updated_by ?? 0);
        $msg->setFilename($file->filename ?? '');
        $msg->setHashname($file->hashname ?? '');
        $msg->setSize($file->size ?? '');
        $msg->setDescription($file->description ?? '');
        $msg->setGoogleUrl($file->google_url ?? '');
        $msg->setDropboxLink($file->dropbox_link ?? '');
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
        \Log::error('DealFileGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
