<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\DeveloperProjectAssetServiceInterface;
use App\Grpc\Generated\DeveloperProjectAsset\ListDeveloperProjectAssetsRequest;
use App\Grpc\Generated\DeveloperProjectAsset\ListDeveloperProjectAssetsResponse;
use App\Grpc\Generated\DeveloperProjectAsset\StreamDeveloperProjectAssetsRequest;
use App\Grpc\Generated\DeveloperProjectAsset\DeveloperProjectAssetBatch;
use App\Grpc\Generated\DeveloperProjectAsset\DeveloperProjectAsset as DeveloperProjectAssetMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\DeveloperProjectAsset;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class DeveloperProjectAssetGrpcService implements DeveloperProjectAssetServiceInterface
{
    public function List(ContextInterface $ctx, ListDeveloperProjectAssetsRequest $in): ListDeveloperProjectAssetsResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = DeveloperProjectAsset::where('company_id', $companyId);

            if ($in->hasDeveloperProjectId()) {
                $query->where('developer_project_id', $in->getDeveloperProjectId());
            }
            if ($in->hasAssetType()) {
                $query->where('asset_type', $in->getAssetType());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('name', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $allowedSortColumns = ['id', 'developer_project_id', 'name', 'asset_type', 'order', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListDeveloperProjectAssetsResponse();
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

    public function Stream(ContextInterface $ctx, StreamDeveloperProjectAssetsRequest $in): DeveloperProjectAssetBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = DeveloperProjectAsset::where('company_id', $companyId);

            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            if ($in->hasDeveloperProjectId()) {
                $query->where('developer_project_id', $in->getDeveloperProjectId());
            }
            if ($in->hasAssetType()) {
                $query->where('asset_type', $in->getAssetType());
            }
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where('name', 'like', "%{$search}%");
            }
            if ($in->hasCreatedFrom()) {
                $query->where('created_at', '>=', $in->getCreatedFrom());
            }
            if ($in->hasCreatedTo()) {
                $query->where('created_at', '<=', $in->getCreatedTo());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new DeveloperProjectAssetBatch();
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

    private function buildMessage(DeveloperProjectAsset $record): DeveloperProjectAssetMessage
    {
        $msg = new DeveloperProjectAssetMessage();
        $msg->setId($record->id);
        $msg->setDeveloperProjectId($record->developer_project_id ?? 0);
        $msg->setCompanyId($record->company_id ?? 0);
        $msg->setName($record->name ?? '');
        $msg->setAssetType($record->asset_type ?? '');
        $msg->setFilePath($record->file_path ?? '');
        $msg->setExternalUrl($record->external_url ?? '');
        $msg->setMimeType($record->mime_type ?? '');
        $msg->setFileSize($record->file_size ?? 0);
        $msg->setTags(is_array($record->tags) ? json_encode($record->tags) : (string) ($record->tags ?? ''));
        $msg->setMetadata(is_array($record->metadata) || is_object($record->metadata) ? json_encode($record->metadata) : (string) ($record->metadata ?? ''));
        $msg->setOrder($record->order ?? 0);
        $msg->setCreatedAt($this->dateToString($record->created_at));
        $msg->setUpdatedAt($this->dateToString($record->updated_at));
        $msg->setDeletedAt($this->dateToString($record->deleted_at));

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
        \Log::error('DeveloperProjectAssetGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
