<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use Yajra\DataTables\Facades\DataTables;
use App\Http\Requests\CustomField\StoreCustomField;
use App\Http\Requests\CustomField\UpdateCustomField;

class CustomFieldController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.customFields';
        $this->activeSettingMenu = 'custom_fields';
        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_custom_field_setting') !== 'all');

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        $this->customFields = CustomField::join('custom_field_groups', 'custom_field_groups.id', '=', 'custom_fields.custom_field_group_id')
                ->select('custom_fields.id', 'custom_field_groups.name as module', 'custom_fields.label', 'custom_fields.type', 'custom_fields.values', 'custom_fields.required', 'custom_fields.export', 'custom_fields.visible')
                ->get();
        $this->groupedCustomFields = $this->customFields->groupBy('module');


        return view('custom-fields.index', $this->data);
    }

    /**
     * Displays the form for creating a new custom field.
     *
     * Retrieves all custom field categories and groups, defines available field types, and returns the view for creating a custom field with this data.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        $customFieldCategories = \App\Models\CustomFieldCategory::all();
            $customFieldGroups = \App\Models\CustomFieldGroup::all();
            $types = ['text', 'number', 'password', 'textarea', 'select', 'radio', 'date', 'checkbox', 'file'];
            return view('custom-fields.create-custom-field-modal', compact('customFieldCategories', 'customFieldGroups', 'types'));
    }

    /**
     * Stores a new custom field with the provided attributes and assigns it to the specified category and group.
     *
     * Generates a unique slug for the field name, collects input data, and creates the custom field record.
     *
     * @param StoreCustomField $request The validated request containing custom field data.
     * @return array Success response indicating the record was saved.
     */
    public function store(StoreCustomField $request)
    {

        $name = CustomField::generateUniqueSlug($request->get('label'), $request->module);
        $categoryId = $request->get('category');

        $group = [
            'fields' => [
                [
                    'name' => $name,
                    'custom_field_group_id' => $request->module,
                    'custom_field_category_id' => $categoryId,
                    'label' => $request->get('label'),
                    'type' => $request->get('type'),
                    'required' => $request->get('required'),
                    'values' => $request->get('value'),
                    'export' => $request->get('export'),
                    'visible' => $request->get('visible'),
                ]
            ],

        ];

        $this->addCustomField($group);

        return Reply::success('messages.recordSaved');
    }

    /**
     * Displays the edit form for a specific custom field.
     *
     * Retrieves the custom field by its ID along with all available categories and groups, decodes its values, and returns the edit modal view.
     *
     * @param int $id The ID of the custom field to edit.
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        $customFieldCategories = \App\Models\CustomFieldCategory::all();
        $customFieldGroups = \App\Models\CustomFieldGroup::all();
        $field = CustomField::findOrFail($id);
        $field->values = json_decode($field->values);
        return view('custom-fields.edit-custom-field-modal', compact('field', 'customFieldCategories', 'customFieldGroups'));
    }

    /**
     * Updates an existing custom field with new attributes and category assignment.
     *
     * Finds the custom field by ID, updates its category, label, name (with a unique slug), values, and display properties, then saves the changes.
     *
     * @param UpdateCustomField $request The validated request containing updated custom field data.
     * @param int $id The ID of the custom field to update.
     * @return \Illuminate\Http\JsonResponse Success response after updating the custom field.
     */
    public function update(UpdateCustomField $request, $id)
    {
        $field = CustomField::findOrFail($id);
        $field->custom_field_category_id = $request->category;

        $name = CustomField::generateUniqueSlug($request->label, $field->custom_field_group_id);
        $field->label = $request->label;
        $field->name = $name;
        $field->values = json_encode($request->value);
        $field->required = $request->required;
        $field->export = $request->export;
        $field->visible = $request->visible;
        $field->save();

        return Reply::success('messages.updateSuccess');
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param int $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        // Find the custom field
        $field = CustomField::findOrFail($id);
        $module = $field->fieldGroup->name;
        // Delete the custom field
        $field->delete();
    
        // Fetch the updated count for the module
        $updatedCount = CustomField::whereHas('fieldGroup', function ($query) use ($module) {
            $query->where('name', $module);
        })->count();
        return Reply::successWithData(__('messages.deleteSuccess'), ['updatedCount' => $updatedCount]);
    }

    /**
     * Creates new custom fields for a given group using the provided field data.
     *
     * Each field in the group is inserted with its associated group ID, category ID, label, name, type, export, visibility, required status, and values (JSON-encoded if multiple).
     *
     * @param array $group An array containing a 'fields' key with field data to be added.
     */
    private function addCustomField($group)
    {
        // Add Custom Fields for this group
        foreach ($group['fields'] as $field) {
            $insertData = [
                'custom_field_group_id' => $field['custom_field_group_id'],
                'custom_field_category_id' => $field['custom_field_category_id'],
                'label' => $field['label'],
                'name' => $field['name'],
                'type' => $field['type'],
                'export' => $field['export'],
                'visible' => $field['visible']
            ];

            if (isset($field['required']) && (in_array($field['required'], ['yes', 'on', 1]))) {
                $insertData['required'] = 'yes';

            }
            else {
                $insertData['required'] = 'no';
            }

            // Single value should be stored as text (multi value JSON encoded)
            if (isset($field['values'])) {
                if (is_array($field['values'])) {
                    $insertData['values'] = \GuzzleHttp\json_encode($field['values']);

                }
                else {
                    $insertData['values'] = $field['values'];
                }
            }

            CustomField::create($insertData);

        }
    }

}
