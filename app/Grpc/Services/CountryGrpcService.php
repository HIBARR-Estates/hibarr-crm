<?php

namespace App\Grpc\Services;

use App\Grpc\Interfaces\CountryServiceInterface;
use App\Grpc\Generated\Country\ListCountriesRequest;
use App\Grpc\Generated\Country\ListCountriesResponse;
use App\Grpc\Generated\Country\StreamCountriesRequest;
use App\Grpc\Generated\Country\CountryBatch;
use App\Grpc\Generated\Country\Country as CountryMessage;
use App\Grpc\Generated\Common\PaginationMeta;
use App\Grpc\Generated\Common\StreamProgress;
use App\Models\Country;
use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\Exception\GRPCException;
use Spiral\RoadRunner\GRPC\StatusCode;

class CountryGrpcService implements CountryServiceInterface
{
    public function List(ContextInterface $ctx, ListCountriesRequest $in): ListCountriesResponse
    {
        try {
            $pagination = $in->getPagination();
            $page = max(1, $pagination ? $pagination->getPage() : 1);
            $perPage = min(100, max(1, $pagination ? $pagination->getPerPage() : 15));
            $sortBy = $pagination ? $pagination->getSortBy() : 'name';
            $sortOrder = $pagination && strtolower($pagination->getSortOrder()) === 'desc' ? 'desc' : 'asc';

            $query = Country::query();

            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('nicename', 'like', "%{$search}%")
                      ->orWhere('iso', 'like', "%{$search}%")
                      ->orWhere('iso3', 'like', "%{$search}%");
                });
            }
            if ($in->hasIso()) {
                $query->where('iso', $in->getIso());
            }
            if ($in->hasPhonecode()) {
                $query->where('phonecode', $in->getPhonecode());
            }

            $allowedSortColumns = ['id', 'name', 'nicename', 'iso', 'phonecode'];
            if (!in_array($sortBy, $allowedSortColumns)) {
                $sortBy = 'name';
            }

            $paginator = $query->orderBy($sortBy, $sortOrder)->paginate($perPage, ['*'], 'page', $page);

            $response = new ListCountriesResponse();
            foreach ($paginator->items() as $country) {
                $response->getResult()[] = $this->buildMessage($country);
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

    public function Stream(ContextInterface $ctx, StreamCountriesRequest $in): CountryBatch
    {
        try {
            $streamParams = $in->getStreamParams();
            $sinceId = $streamParams ? $streamParams->getSinceId() : 0;
            $ids = $streamParams ? iterator_to_array($streamParams->getIds()) : [];

            $query = Country::query();

            // Incremental filters
            if ($sinceId > 0) {
                $query->where('id', '>', $sinceId);
            }
            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }

            // Domain-specific filters
            if ($in->hasSearch()) {
                $search = $in->getSearch();
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('nicename', 'like', "%{$search}%")
                      ->orWhere('iso', 'like', "%{$search}%");
                });
            }
            if ($in->hasIso()) {
                $query->where('iso', $in->getIso());
            }

            $total = $query->count();
            $records = $query->orderBy('id', 'asc')->get();

            $batch = new CountryBatch();
            foreach ($records as $country) {
                $batch->getResult()[] = $this->buildMessage($country);
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

    private function buildMessage(Country $country): CountryMessage
    {
        $msg = new CountryMessage();
        $msg->setId($country->id);
        $msg->setIso($country->iso ?? '');
        $msg->setName($country->name ?? '');
        $msg->setNicename($country->nicename ?? '');
        $msg->setIso3($country->iso3 ?? '');
        $msg->setNumcode($country->numcode ?? 0);
        $msg->setPhonecode($country->phonecode ?? 0);

        return $msg;
    }

    private function mapException(\Throwable $e): GRPCException
    {
        \Log::error('CountryGrpcService error: ' . $e->getMessage(), ['exception' => $e]);
        return new GRPCException('Internal error: ' . $e->getMessage(), StatusCode::INTERNAL);
    }
}
