<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use Illuminate\Http\Request;

class CustomFieldApiController extends Controller
{
    /**
     * List custom field definitions for the company in X-COMPANY-ID.
     *
     * Optional `model` query param narrows the result to one module. Accepts the
     * module name ("Deal", "time log"), the class basename ("ProjectTimeLog") or
     * the full class ("App\Models\Deal"), case-insensitive. Omit it to get every
     * custom field across all modules.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $companyId = (int) $request->header('X-COMPANY-ID');
        $modelQuery = trim((string) $request->query('model', ''));
        $modelClass = null;

        if ($modelQuery !== '') {
            $modelClass = $this->resolveModelClass($modelQuery);

            if ($modelClass === null) {
                return response()->json([
                    'status' => 'fail',
                    'message' => 'Unknown model "' . $modelQuery . '".',
                    'allowed_models' => array_column(CustomFieldGroup::ALL_FIELDS, 'name'),
                ], 422);
            }
        }

        $fields = CustomField::with(['fieldGroup:id,name,model', 'customFieldCategory:id,name'])
            ->where('custom_fields.company_id', $companyId)
            ->when($modelClass, fn ($query) => $query->whereHas(
                'fieldGroup',
                fn ($group) => $group->where('model', $modelClass)
            ))
            ->orderBy('custom_fields.custom_field_group_id')
            ->orderBy('custom_fields.display_order')
            ->orderBy('custom_fields.id')
            ->get();

        $data = $fields->map(function (CustomField $field) {
            $row = $field->toAdminArray();
            unset($row['show_rule_set']);

            return [
                'model' => $field->fieldGroup?->model,
                'id' => $row['id'],
                'custom_field_group_id' => $row['custom_field_group_id'],
                'custom_field_group_name' => $field->fieldGroup?->name,
            ] + $row;
        })->values();

        return response()->json([
            'status' => 'success',
            'model' => $modelClass,
            'total' => $data->count(),
            'data' => $data,
        ]);
    }

    private function resolveModelClass(string $input): ?string
    {
        $needle = $this->normalize($input);

        foreach (CustomFieldGroup::ALL_FIELDS as $module) {
            $candidates = [
                $module['name'],
                $module['model'],
                class_basename($module['model']),
            ];

            foreach ($candidates as $candidate) {
                if ($this->normalize($candidate) === $needle) {
                    return $module['model'];
                }
            }
        }

        return null;
    }

    private function normalize(string $value): string
    {
        return strtolower(str_replace([' ', '_', '-'], '', $value));
    }
}
