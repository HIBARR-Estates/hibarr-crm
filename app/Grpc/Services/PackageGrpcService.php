<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\PackageServiceInterface;
use App\Grpc\Generated\Package\ListPackagesRequest;
use App\Grpc\Generated\Package\ListPackagesResponse;
use App\Grpc\Generated\Package\StreamPackagesRequest;
use App\Grpc\Generated\Package\PackageBatch;
use App\Grpc\Generated\Package\Package as PackageMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Package;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class PackageGrpcService implements PackageServiceInterface
{
    public function List(ContextInterface $ctx, ListPackagesRequest $in): ListPackagesResponse
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'name';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = Package::where('company_id', $companyId);

            // By default exclude soft-deleted, unless include_trashed is set
            if ($in->hasIncludeTrashed() && $in->getIncludeTrashed()) {
                $query->withTrashed();
            }

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }

            $allowedSortColumns = ['id', 'name', 'value', 'created_at', 'updated_at'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'name';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListPackagesResponse();
            foreach ($paginator->items() as $package) {
                $response->getResult()[] = $this->buildMessage($package);
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

    public function Stream(ContextInterface $ctx, StreamPackagesRequest $in): PackageBatch
    {
        try {
            $companyId = $this->getCompanyId($ctx);

            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $sinceUpdated = $streamParams ? $streamParams->getSinceUpdated() : '';
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = Package::where('company_id', $companyId);

            // By default exclude soft-deleted, unless include_trashed is set
            if ($in->hasIncludeTrashed() && $in->getIncludeTrashed()) {
                $query->withTrashed();
            }

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
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
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

            $batch = new PackageBatch();
            foreach ($records as $package) {
                $batch->getResult()[] = $this->buildMessage($package);
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

    private function buildMessage(Package $package): PackageMessage
    {
        $msg = new PackageMessage();
        $msg->setId($package->id);
        $msg->setCompanyId($package->company_id ?? 0);
        $msg->setName($package->name ?? '');
        $msg->setValue((float) ($package->value ?? 0));
        $msg->setDescription($package->description ?? '');
        $msg->setCustomerTypeName($package->customer_type_name ?? '');
        $msg->setCustomerTypeDescription($package->customer_type_description ?? '');
        $msg->setCreatedAt($this->dateToString($package->created_at));
        $msg->setUpdatedAt($this->dateToString($package->updated_at));
        $msg->setDeletedAt($this->dateToString($package->deleted_at));
        $msg->setCurrency($package->currency ?? 'EUR');

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
        \Log::error('PackageGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
