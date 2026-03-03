<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\DeveloperProjectUnitTypeAssetServiceInterface;
use App\Grpc\Generated\DeveloperProjectUnitTypeAsset\ListDeveloperProjectUnitTypeAssetsRequest;
use App\Grpc\Generated\DeveloperProjectUnitTypeAsset\ListDeveloperProjectUnitTypeAssetsResponse;
use App\Grpc\Generated\DeveloperProjectUnitTypeAsset\StreamDeveloperProjectUnitTypeAssetsRequest;
use App\Grpc\Generated\DeveloperProjectUnitTypeAsset\DeveloperProjectUnitTypeAssetBatch;
use App\Grpc\Generated\DeveloperProjectUnitTypeAsset\DeveloperProjectUnitTypeAsset as DeveloperProjectUnitTypeAssetMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\DeveloperProjectUnitTypeAsset;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class DeveloperProjectUnitTypeAssetGrpcService implements DeveloperProjectUnitTypeAssetServiceInterface
{
    public function List(ContextInterface $ctx, ListDeveloperProjectUnitTypeAssetsRequest $in): ListDeveloperProjectUnitTypeAssetsResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'id';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = DeveloperProjectUnitTypeAsset::where('company_id', $companyId);

            if ($in->hasUnitTypeId()) {
                $query->where('unit_type_id', $in->getUnitTypeId());
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

            $allowedSortColumns = ['id', 'unit_type_id', 'name', 'asset_type', 'order', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'id';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListDeveloperProjectUnitTypeAssetsResponse();
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

    public function Stream(ContextInterface $ctx, StreamDeveloperProjectUnitTypeAssetsRequest $in): DeveloperProjectUnitTypeAssetBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = DeveloperProjectUnitTypeAsset::where('company_id', $companyId);

            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($sinceUpdated)) {
                $query->where('updated_at', '>', $sinceUpdated);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            if ($in->hasUnitTypeId()) {
                $query->where('unit_type_id', $in->getUnitTypeId());
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

            $batch = new DeveloperProjectUnitTypeAssetBatch();
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

    private function buildMessage(DeveloperProjectUnitTypeAsset $record): DeveloperProjectUnitTypeAssetMessage
    {
        $msg = new DeveloperProjectUnitTypeAssetMessage();
        $msg->setId($record->id);
        $msg->setUnitTypeId($record->unit_type_id ?? 0);
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
        \Log::error('DeveloperProjectUnitTypeAssetGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
