<?php

namespace App\Http\Controllers;

use App\Models\CustomField;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Custom fields settings — a full-page React/Inertia rebuild of the classic
 * custom-fields.* Blade admin (fields, categories, visibility rules). Reads
 * the same custom_fields / custom_field_categories / show_rule_sets tables
 * and the writes go through the existing CustomFieldController /
 * CustomFieldCategoryController JSON endpoints — both UIs share the same
 * validation/model code.
 */
class CustomFieldSettingsController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_custom_field_setting') !== 'all');

            return $next($request);
        });
    }

    public function index()
    {
        return Inertia::render('Settings/CustomFields/Index', [
            'pageTitle' => __('app.menu.customFields'),

            'moduleGroups' => CustomFieldGroup::orderBy('id')->get(['id', 'name', 'model']),

            'fields' => Inertia::defer(function () {
                try {
                    $fields = CustomField::with([
                        'fieldGroup:id,name',
                        'customFieldCategory:id,name',
                        'showRuleSet' => function ($query) {
                            $query->with(['groups' => function ($q) {
                                $q->orderBy('id')->with('criteria.referenceField:id,label');
                            }]);
                        },
                    ])->orderBy('display_order')->get();
                } catch (\Exception $e) {
                    $fields = CustomField::with(['fieldGroup:id,name', 'customFieldCategory:id,name'])
                        ->orderBy('display_order')->get();
                }

                return $fields->map(fn (CustomField $field) => $field->toAdminArray())->values();
            }, 'customFields'),

            'categories' => Inertia::defer(fn () => CustomFieldCategory::with('customFieldGroup:id,name')
                ->where('company_id', company()->id)
                ->orderBy(DB::raw('`order`'), 'asc')
                ->orderBy('id', 'asc')
                ->get()
                ->map(fn (CustomFieldCategory $category) => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'custom_field_group_id' => $category->custom_field_group_id,
                    'module' => $category->customFieldGroup->name ?? '',
                    'order' => (int) $category->order,
                ])->values(), 'customFields'),
        ]);
    }
}
