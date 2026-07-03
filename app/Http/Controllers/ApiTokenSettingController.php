<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\ApiToken;
use App\Services\ApiTokenScopeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ApiTokenSettingController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.apiTokenSettings';
        $this->activeSettingMenu = 'api_token_settings';

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function index()
    {
        $this->apiTokens = ApiToken::query()
            ->where('company_id', company()->id)
            ->orderByDesc('created_at')
            ->get();

        $this->scopeGroups = ApiTokenScopeService::groupedScopes();

        return view('api-token-settings.index', $this->data);
    }

    public function store(Request $request)
    {
        $validator = $this->makeValidator($request);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $plainToken = ApiToken::generatePlainToken();

        $apiToken = ApiToken::create([
            'token' => ApiToken::hashToken($plainToken),
            'name' => $request->name,
            'company_id' => company()->id,
            'permissions' => $this->resolvePermissionsPayload($request),
            'revoked' => false,
        ]);

        return Reply::successWithData(__('messages.apiTokenCreated'), [
            'api_token' => $this->serializeToken($apiToken, $plainToken),
        ]);
    }

    public function update(Request $request, int $id)
    {
        $validator = $this->makeValidator($request, true);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $apiToken = $this->findCompanyToken($id);

        if ($request->has('name')) {
            $apiToken->name = $request->name;
        }

        if ($request->has('revoked')) {
            $apiToken->revoked = $request->boolean('revoked');
        }

        if ($request->has('unrestricted') || $request->has('scopes')) {
            $apiToken->permissions = $this->resolvePermissionsPayload($request);
        }

        $apiToken->save();

        return Reply::successWithData(__('messages.updateSuccess'), [
            'api_token' => $this->serializeToken($apiToken),
        ]);
    }

    public function destroy(int $id)
    {
        $this->findCompanyToken($id)->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function regenerate(int $id)
    {
        $apiToken = $this->findCompanyToken($id);
        $plainToken = ApiToken::generatePlainToken();

        $apiToken->token = ApiToken::hashToken($plainToken);
        $apiToken->revoked = false;
        $apiToken->save();

        return Reply::successWithData(__('messages.apiTokenRegenerated'), [
            'api_token' => $this->serializeToken($apiToken, $plainToken),
        ]);
    }

    private function findCompanyToken(int $id): ApiToken
    {
        return ApiToken::query()
            ->where('company_id', company()->id)
            ->findOrFail($id);
    }

    private function makeValidator(Request $request, bool $updating = false): \Illuminate\Contracts\Validation\Validator
    {
        $rules = [
            'name' => ($updating ? 'sometimes|' : '') . 'required|string|max:255',
            'revoked' => 'sometimes|boolean',
            'unrestricted' => 'nullable|boolean',
            'scopes' => 'nullable|array',
            'scopes.*' => ['string', Rule::in(ApiTokenScopeService::allScopeKeys())],
        ];

        return Validator::make($request->all(), $rules)->after(function ($validator) use ($request) {
            if ($request->boolean('unrestricted')) {
                return;
            }

            $scopes = $request->input('scopes');

            if (is_array($scopes) && count($scopes) === 0) {
                $validator->errors()->add('scopes', __('messages.apiTokenScopesRequired'));
            }
        });
    }

    /**
     * @return array{scopes: list<string>}|null
     */
    private function resolvePermissionsPayload(Request $request): ?array
    {
        if ($request->boolean('unrestricted', false)) {
            return null;
        }

        return ApiTokenScopeService::encodeScopes($request->input('scopes', []));
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeToken(ApiToken $apiToken, ?string $plainToken = null): array
    {
        return [
            'id' => $apiToken->id,
            'name' => $apiToken->name,
            'token' => $plainToken,
            'masked_token' => $apiToken->maskedToken(),
            'revoked' => $apiToken->revoked,
            'unrestricted' => $apiToken->isUnrestricted(),
            'scopes' => $apiToken->scopeKeys(),
            'scope_labels' => $apiToken->scopeLabels(),
            'created_at' => $apiToken->created_at?->toIso8601String(),
            'updated_at' => $apiToken->updated_at?->toIso8601String(),
        ];
    }
}
