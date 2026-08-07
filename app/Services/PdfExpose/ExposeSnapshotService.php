<?php

namespace App\Services\PdfExpose;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\ExposeSnapshot;
use App\Models\Lead;
use App\Models\Property;
use App\Models\User;
use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ExposeSnapshotService
{
    public function __construct(
        private ExposeGeneratorService $exposeService
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     * @return array{snapshot: ExposeSnapshot, token: string}
     *
     * @throws ValidationException
     */
    public function mint(int $companyId, array $payload): array
    {
        $validated = $this->validateMintPayload($payload);

        $agent = User::with(['employeeDetail.designation', 'company.defaultAddress'])
            ->where('id', (int) $validated['agent_id'])
            ->where('company_id', $companyId)
            ->first();

        if (!$agent) {
            throw ValidationException::withMessages([
                'agent_id' => ['Agent not found for this company.'],
            ]);
        }

        $lead = Lead::query()
            ->where('id', (int) $validated['lead_id'])
            ->where('company_id', $companyId)
            ->first();

        if (!$lead) {
            throw ValidationException::withMessages([
                'lead_id' => ['Lead not found for this company.'],
            ]);
        }

        $entityType = $validated['entity_type'];
        $entityId = (int) $validated['entity_id'];
        $subEntityId = $entityType === ExposeSnapshot::ENTITY_UNIT_TYPE
            ? (int) $validated['unit_type_id']
            : null;
        $layout = $validated['layout'] ?? null;

        $clientData = [
            'client_name' => $this->resolveLeadDisplayName($lead),
            'client_email' => $lead->client_email ?: null,
        ];

        $config = match ($entityType) {
            ExposeSnapshot::ENTITY_PROPERTY => $this->buildPropertyConfig(
                $companyId,
                $entityId,
                $layout ?? 'expose-template',
                $clientData,
                $agent
            ),
            ExposeSnapshot::ENTITY_DEVELOPER_PROJECT => $this->buildProjectConfig(
                $companyId,
                $entityId,
                $layout ?? 'project-expose-template',
                $clientData,
                $agent
            ),
            ExposeSnapshot::ENTITY_UNIT_TYPE => $this->buildUnitTypeConfig(
                $companyId,
                $entityId,
                (int) $validated['unit_type_id'],
                $layout ?? 'expose-template',
                $clientData,
                $agent
            ),
            default => throw ValidationException::withMessages([
                'entity_type' => ['Unsupported entity_type.'],
            ]),
        };

        $expose = ExposePresentationBuilder::from($config)->toClientDto()->toArray();
        $warnings = $this->exposeService->checkWarnings($config);

        $agentSnapshot = $this->buildAgentSnapshot($agent, $expose['agent'] ?? []);
        $leadSnapshot = $this->buildLeadSnapshot($lead);

        // Ensure frozen expose people match snapshot summaries (ids + names).
        $expose['agent'] = [
            'name' => $agentSnapshot['name'],
            'email' => $agentSnapshot['email'],
            'phone' => $agentSnapshot['phone'],
            'position' => $agentSnapshot['position'],
            'image' => $agentSnapshot['image'],
        ];
        $expose['client'] = [
            'name' => $leadSnapshot['name'],
            'email' => $leadSnapshot['email'],
        ];
        $expose['presence'] = array_merge($expose['presence'] ?? [], [
            'agent' => filled($agentSnapshot['name']),
            'client' => filled($leadSnapshot['name']),
        ]);

        $plainToken = ExposeSnapshot::generatePlainToken();

        $snapshot = ExposeSnapshot::create([
            'company_id' => $companyId,
            'token_hash' => ExposeSnapshot::hashToken($plainToken),
            'token_prefix' => ExposeSnapshot::tokenPrefix($plainToken),
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'sub_entity_id' => $subEntityId,
            'agent_user_id' => $agent->id,
            'lead_id' => $lead->id,
            'layout' => $config->layout,
            'request_payload' => $validated,
            'agent_snapshot' => $agentSnapshot,
            'lead_snapshot' => $leadSnapshot,
            'expose_payload' => $expose,
            'schema_version' => ExposeClientDto::SCHEMA_VERSION,
            'warnings' => $warnings,
        ]);

        return [
            'snapshot' => $snapshot,
            'token' => $plainToken,
        ];
    }

    public function findByToken(int $companyId, string $plainToken): ?ExposeSnapshot
    {
        if ($plainToken === '' || !str_starts_with($plainToken, 'exp_')) {
            return null;
        }

        return ExposeSnapshot::findByPlainToken($plainToken, $companyId);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function list(int $companyId, array $filters = []): LengthAwarePaginator
    {
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(max(1, (int) ($filters['per_page'] ?? config('api.defaultLimit', 20))), config('api.maxLimit', 1000));

        $query = ExposeSnapshot::query()
            ->where('company_id', $companyId)
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if (!empty($filters['lead_id'])) {
            $query->where('lead_id', (int) $filters['lead_id']);
        }

        if (!empty($filters['agent_id'])) {
            $query->where('agent_user_id', (int) $filters['agent_id']);
        }

        if (!empty($filters['entity_type'])) {
            $query->where('entity_type', (string) $filters['entity_type']);
        }

        if (!empty($filters['entity_id'])) {
            $query->where('entity_id', (int) $filters['entity_id']);
        }

        if (!empty($filters['unit_type_id'])) {
            $query->where('sub_entity_id', (int) $filters['unit_type_id']);
        }

        return $query->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function validateMintPayload(array $payload): array
    {
        $validator = Validator::make($payload, [
            'entity_type' => ['required', 'string', 'in:' . implode(',', ExposeSnapshot::ENTITY_TYPES)],
            'entity_id' => ['required', 'integer', 'min:1'],
            'agent_id' => ['required', 'integer', 'min:1'],
            'lead_id' => ['required', 'integer', 'min:1'],
            'unit_type_id' => ['required_if:entity_type,unit_type', 'nullable', 'integer', 'min:1'],
            'layout' => ['nullable', 'string', 'max:100'],
        ]);

        return $validator->validate();
    }

    /**
     * @param  array{client_name: string|null, client_email: string|null}  $clientData
     */
    private function buildPropertyConfig(
        int $companyId,
        int $propertyId,
        string $layout,
        array $clientData,
        User $agent
    ): ExposeConfiguration {
        $property = Property::where('properties.id', $propertyId)
            ->where('properties.company_id', $companyId)
            ->with(['assets', 'projectLocation', 'developerProject.location', 'developerProject.assets'])
            ->first();

        if (!$property) {
            throw ValidationException::withMessages([
                'entity_id' => ['Property not found for this company.'],
            ]);
        }

        return ExposeConfiguration::fromProperty(
            $property,
            $layout,
            $clientData,
            [],
            $agent,
            $companyId
        );
    }

    /**
     * @param  array{client_name: string|null, client_email: string|null}  $clientData
     */
    private function buildProjectConfig(
        int $companyId,
        int $projectId,
        string $layout,
        array $clientData,
        User $agent
    ): ExposeConfiguration {
        $project = DeveloperProject::where('id', $projectId)
            ->where('company_id', $companyId)
            ->with(['developer', 'location', 'assets', 'unitTypes.assets'])
            ->first();

        if (!$project) {
            throw ValidationException::withMessages([
                'entity_id' => ['Developer project not found for this company.'],
            ]);
        }

        return ExposeConfiguration::fromDeveloperProject(
            $project,
            $layout,
            $clientData,
            $agent,
            $companyId
        );
    }

    /**
     * @param  array{client_name: string|null, client_email: string|null}  $clientData
     */
    private function buildUnitTypeConfig(
        int $companyId,
        int $projectId,
        int $unitTypeId,
        string $layout,
        array $clientData,
        User $agent
    ): ExposeConfiguration {
        $project = DeveloperProject::where('id', $projectId)
            ->where('company_id', $companyId)
            ->first();

        if (!$project) {
            throw ValidationException::withMessages([
                'entity_id' => ['Developer project not found for this company.'],
            ]);
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
            throw ValidationException::withMessages([
                'unit_type_id' => ['Unit type not found for this project.'],
            ]);
        }

        return ExposeConfiguration::fromUnitType(
            $unitType,
            $layout,
            $clientData,
            $agent,
            $companyId
        );
    }

    /**
     * @param  array<string, mixed>  $exposeAgent
     * @return array{id: int, name: string|null, email: string|null, phone: string|null, position: string|null, image: string|null}
     */
    private function buildAgentSnapshot(User $agent, array $exposeAgent): array
    {
        return [
            'id' => $agent->id,
            'name' => $exposeAgent['name'] ?? ($agent->name_salutation ?? $agent->name),
            'email' => $exposeAgent['email'] ?? $agent->email,
            'phone' => $exposeAgent['phone'] ?? null,
            'position' => $exposeAgent['position'] ?? null,
            'image' => $exposeAgent['image'] ?? ($agent->image_url ?? null),
        ];
    }

    /**
     * @return array{id: int, name: string|null, email: string|null, phone: string|null, company_name: string|null}
     */
    private function buildLeadSnapshot(Lead $lead): array
    {
        $phone = null;
        try {
            $phone = $lead->mobile_with_phonecode ?: null;
        } catch (\Throwable) {
            $phone = is_string($lead->mobile) ? $lead->mobile : null;
        }

        return [
            'id' => $lead->id,
            'name' => $this->resolveLeadDisplayName($lead),
            'email' => $lead->client_email ?: null,
            'phone' => $phone,
            'company_name' => $lead->company_name ?: null,
        ];
    }

    private function resolveLeadDisplayName(Lead $lead): string
    {
        $salutationName = $lead->client_name_salutation ?? null;
        if (is_string($salutationName) && trim($salutationName) !== '') {
            return trim($salutationName);
        }

        return trim((string) ($lead->client_name ?? '')) ?: 'Unknown';
    }

    /**
     * @return array<string, mixed>
     */
    public function toDetailArray(ExposeSnapshot $snapshot, ?string $plainToken = null): array
    {
        $data = [
            'snapshot_id' => $snapshot->id,
            'token' => $plainToken,
            'token_prefix' => $snapshot->token_prefix,
            'created_at' => $snapshot->created_at?->toISOString(),
            'entity_type' => $snapshot->entity_type,
            'entity_id' => $snapshot->entity_id,
            'unit_type_id' => $snapshot->entity_type === ExposeSnapshot::ENTITY_UNIT_TYPE
                ? $snapshot->sub_entity_id
                : null,
            'agent_id' => $snapshot->agent_user_id,
            'agent' => $snapshot->agent_snapshot,
            'lead_id' => $snapshot->lead_id,
            'lead' => $snapshot->lead_snapshot,
            'layout' => $snapshot->layout,
            'schema_version' => $snapshot->schema_version,
            'expose' => $snapshot->expose_payload,
            'warnings' => $snapshot->warnings ?? [],
        ];

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    public function toSummaryArray(ExposeSnapshot $snapshot, bool $includeExpose = false): array
    {
        $data = [
            'snapshot_id' => $snapshot->id,
            'token_prefix' => $snapshot->token_prefix,
            'created_at' => $snapshot->created_at?->toISOString(),
            'entity_type' => $snapshot->entity_type,
            'entity_id' => $snapshot->entity_id,
            'unit_type_id' => $snapshot->entity_type === ExposeSnapshot::ENTITY_UNIT_TYPE
                ? $snapshot->sub_entity_id
                : null,
            'agent_id' => $snapshot->agent_user_id,
            'agent' => $snapshot->agent_snapshot,
            'lead_id' => $snapshot->lead_id,
            'lead' => $snapshot->lead_snapshot,
            'layout' => $snapshot->layout,
            'schema_version' => $snapshot->schema_version,
        ];

        if ($includeExpose) {
            $data['expose'] = $snapshot->expose_payload;
            $data['warnings'] = $snapshot->warnings ?? [];
        }

        return $data;
    }
}
