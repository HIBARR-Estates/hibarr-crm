<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\Property;
use App\Models\User;
use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use App\Services\PdfExpose\ExposeGeneratorService;
use App\Services\PdfExpose\ExposePresentationBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Presentation-ready expose DTOs for OL (api.token).
 *
 * Catalog list/show endpoints remain unchanged; these routes return the lite
 * semantic expose schema built by ExposePresentationBuilder.
 */
class ExposeDataApiController extends Controller
{
    public function __construct(
        private ExposeGeneratorService $exposeService
    ) {}

    public function propertyExpose(Request $request, string $identifier): JsonResponse
    {
        $companyId = $this->requireCompanyId($request);
        if ($companyId instanceof JsonResponse) {
            return $companyId;
        }

        try {
            $property = $this->resolveProperty($companyId, $identifier);
            if (!$property) {
                return response()->json(['status' => 'fail', 'message' => 'Property not found'], 404);
            }

            $clientData = $this->clientDataFromRequest($request);
            $agent = $this->resolveAgent($request, $companyId);
            $layout = $this->stringQuery($request, 'layout', 'expose-template');

            $config = ExposeConfiguration::fromProperty(
                $property,
                $layout,
                $clientData,
                [],
                $agent,
                $companyId
            );

            return $this->presentationResponse($config);
        } catch (\Exception $e) {
            return $this->serverError('property', $e, $companyId, ['identifier' => $identifier]);
        }
    }

    public function projectExpose(Request $request, string $identifier): JsonResponse
    {
        $companyId = $this->requireCompanyId($request);
        if ($companyId instanceof JsonResponse) {
            return $companyId;
        }

        try {
            $project = $this->resolveProject($companyId, $identifier);
            if (!$project) {
                return response()->json(['status' => 'fail', 'message' => 'Developer project not found'], 404);
            }

            $clientData = $this->clientDataFromRequest($request);
            $agent = $this->resolveAgent($request, $companyId);
            $layout = $this->stringQuery($request, 'layout', 'project-expose-template');

            $config = ExposeConfiguration::fromDeveloperProject(
                $project,
                $layout,
                $clientData,
                $agent,
                $companyId
            );

            return $this->presentationResponse($config);
        } catch (\Exception $e) {
            return $this->serverError('developer_project', $e, $companyId, ['identifier' => $identifier]);
        }
    }

    public function unitTypeExpose(Request $request, string $identifier, int $unitTypeId): JsonResponse
    {
        $companyId = $this->requireCompanyId($request);
        if ($companyId instanceof JsonResponse) {
            return $companyId;
        }

        try {
            $project = $this->resolveProject($companyId, $identifier);
            if (!$project) {
                return response()->json(['status' => 'fail', 'message' => 'Developer project not found'], 404);
            }

            $unitType = DeveloperProjectUnitType::with([
                'project.developer',
                'project.location',
                'project.assets',
                'assets',
            ])
                ->where('developer_project_id', $project->id)
                ->where('id', $unitTypeId)
                ->first();

            if (!$unitType) {
                return response()->json(['status' => 'fail', 'message' => 'Unit type not found'], 404);
            }

            $clientData = $this->clientDataFromRequest($request);
            $agent = $this->resolveAgent($request, $companyId);
            $layout = $this->stringQuery($request, 'layout', 'expose-template');

            $config = ExposeConfiguration::fromUnitType(
                $unitType,
                $layout,
                $clientData,
                $agent,
                $companyId
            );

            return $this->presentationResponse($config);
        } catch (\Exception $e) {
            return $this->serverError('unit_type', $e, $companyId, [
                'identifier' => $identifier,
                'unit_type_id' => $unitTypeId,
            ]);
        }
    }

    private function presentationResponse(ExposeConfiguration $config): JsonResponse
    {
        $dto = ExposePresentationBuilder::from($config)->toClientDto();
        $warnings = $this->exposeService->checkWarnings($config);

        return response()->json([
            'status' => 'success',
            'data' => $dto->toArray(),
            'warnings' => $warnings,
        ], 200);
    }

    /**
     * @return int|JsonResponse
     */
    private function requireCompanyId(Request $request)
    {
        $companyId = $request->header('X-COMPANY-ID');
        if (!$companyId) {
            return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
        }

        return (int) $companyId;
    }

    private function resolveProperty(int $companyId, string $identifier): ?Property
    {
        $property = Property::where('properties.company_id', $companyId)
            ->where('properties.slug', $identifier)
            ->with(['assets', 'projectLocation', 'developerProject.location', 'developerProject.assets'])
            ->first();

        if ($property) {
            return $property;
        }

        if (!ctype_digit($identifier)) {
            return null;
        }

        return Property::where('properties.id', (int) $identifier)
            ->where('properties.company_id', $companyId)
            ->with(['assets', 'projectLocation', 'developerProject.location', 'developerProject.assets'])
            ->first();
    }

    private function resolveProject(int $companyId, string $identifier): ?DeveloperProject
    {
        $project = DeveloperProject::where('company_id', $companyId)
            ->where('slug', $identifier)
            ->with(['developer', 'location', 'assets', 'unitTypes.assets'])
            ->first();

        if ($project) {
            return $project;
        }

        if (!ctype_digit($identifier)) {
            return null;
        }

        return DeveloperProject::where('id', (int) $identifier)
            ->where('company_id', $companyId)
            ->with(['developer', 'location', 'assets', 'unitTypes.assets'])
            ->first();
    }

    /**
     * @return array{client_name: string|null, client_email: string|null}
     */
    private function clientDataFromRequest(Request $request): array
    {
        return [
            'client_name' => $this->nullableQuery($request, 'client_name'),
            'client_email' => $this->nullableQuery($request, 'client_email'),
        ];
    }

    private function resolveAgent(Request $request, int $companyId): ?User
    {
        $agentId = $request->query('agent_id') ?? $request->input('agent_id');
        if ($agentId === null || $agentId === '') {
            return null;
        }

        return User::with(['employeeDetail.designation', 'company.defaultAddress'])
            ->where('id', (int) $agentId)
            ->where('company_id', $companyId)
            ->first();
    }

    private function stringQuery(Request $request, string $key, string $default): string
    {
        $value = $request->query($key) ?? $request->input($key);

        if ($value === null || $value === '') {
            return $default;
        }

        return (string) $value;
    }

    private function nullableQuery(Request $request, string $key): ?string
    {
        $value = $request->query($key) ?? $request->input($key);
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function serverError(string $entity, \Exception $e, int $companyId, array $context = []): JsonResponse
    {
        $referenceId = uniqid('EXPOSE-', true);
        Log::error("Error building {$entity} expose via API", array_merge([
            'reference_id' => $referenceId,
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'company_id' => $companyId,
        ], $context));

        return response()->json([
            'status' => 'fail',
            'message' => 'Failed to build expose data. Please contact support with reference ID: ' . $referenceId,
            'reference_id' => $referenceId,
        ], 500);
    }
}
