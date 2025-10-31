# Custom Fields Import Guide for Deals

## Overview
The Excel import functionality has been enhanced to support custom fields for Deals. This allows you to import deal data along with custom field values in a single operation.

## What Changed

### 1. **DealImport.php**
- Modified `fields()` method to dynamically include custom fields
- Custom fields marked for export (`export = 1`) are automatically added to the import fields list
- Field naming convention: `field_{custom_field_id}`

### 2. **ImportDealJob.php**
- Added `importCustomFields()` method to handle custom field data import
- Automatically processes custom fields after deal creation
- Handles different custom field types (text, date, select, checkbox, number, etc.)

### 3. **DealSampleExport.php** (New)
- Dynamic Excel template generator
- Automatically includes custom fields marked for export
- Generates sample data for each field type
- Replaces the static `deal-sample.xlsx` file

### 4. **DealController.php**
- Added `downloadSampleImport()` method
- Generates dynamic template with custom fields on-demand

### 5. **Routes & Views**
- Added route: `deals.import.download-sample`
- Updated import view to use dynamic template download

## How It Works

### Custom Field Detection
The system automatically:
1. Queries all custom fields for the Deal model
2. Filters fields marked for export (`export = 1`)
3. Adds them to the importable fields list with prefix `field_`

### Field Type Handling
The import job handles different custom field types:

- **Text**: Imported as-is
- **Number**: Validated for numeric values
- **Date**: Parsed and formatted to `Y-m-d`
- **Select**: Matches the imported value against available options
- **Checkbox**: Handles comma/semicolon/pipe separated values
- **Phone**: Imported as text (country code handling requires frontend)
- **File**: Not supported via Excel import (requires file upload)

## Excel File Format

### Example Excel Structure

| email | name | pipeline | stages | value | close_date | field_1 | field_2 | field_3 |
|-------|------|----------|--------|-------|------------|---------|---------|---------|
| john@example.com | Deal 1 | Sales | Prospect | 5000 | 2025-12-31 | Custom Value | 100 | Option 1 |
| jane@example.com | Deal 2 | Sales | Negotiation | 7500 | 2025-11-15 | Another Value | 250 | Option 2 |

Where:
- `field_1`, `field_2`, `field_3` are custom fields with IDs 1, 2, and 3
- The actual column names will show the custom field labels in the import interface

## Setting Up Custom Fields for Import

### Step 1: Create Custom Fields
1. Go to Settings → Custom Fields
2. Create custom fields for the Deal module
3. **Important**: Mark the field for export by checking the "Export" option

### Step 2: Download Template & Prepare Excel File
1. Navigate to Deals → Import
2. Click "Download Sample Import" to get the template with your custom fields included
3. The template will automatically include columns for all custom fields marked for export
4. Fill in your data following the template format:
   - For **Select fields**: Use the exact option text as it appears in the system
   - For **Date fields**: Use any standard date format (will be auto-parsed)
   - For **Checkbox fields**: Use comma-separated values

### Step 3: Import
1. Navigate to Deals → Import
2. Upload your Excel file
3. Map columns (custom fields will appear in the mapping interface)
4. Process the import

## Custom Field Types & Import Format

### Text Field
```
Simple text value
```

### Number Field
```
100
250.50
1000
```

### Date Field
```
2025-12-31
31/12/2025
December 31, 2025
```

### Select Field (Dropdown)
```
Option 1
Option 2
(Must match exactly with defined options)
```

### Checkbox Field
```
Option 1, Option 2, Option 3
Option 1; Option 2
Option 1 | Option 2
```

### Radio Field
```
Selected Option
(Must match one of the defined options)
```

## Error Handling

The import process handles errors gracefully:

- **Invalid dates**: Skipped (deal imported without that field)
- **Invalid select options**: Skipped (deal imported without that field)
- **Non-numeric values for number fields**: Skipped
- **Empty values**: Skipped (no error)
- **Missing custom fields**: Skipped (optional fields)

## Notes & Best Practices

1. **Export Flag**: Only custom fields with `export = 1` will be available for import
2. **Field Naming**: Custom fields are prefixed with `field_` followed by their database ID
3. **Data Validation**: The system validates data types before importing
4. **Backwards Compatible**: Existing imports without custom fields will continue to work
5. **Performance**: Large imports with many custom fields may take longer to process

## Extending to Other Models

To add custom field import support to other models (Leads, Clients, etc.):

1. Modify the corresponding Import class (e.g., `LeadImport.php`)
2. Add the dynamic custom fields to the `fields()` method
3. Modify the corresponding Job class (e.g., `ImportLeadJob.php`)
4. Add the `importCustomFields()` method
5. Call it after the model is saved

## Example Code Pattern

```php
// In Import class
$customFieldsGroupsId = \App\Models\CustomFieldGroup::where('model', 'App\Models\YourModel')
    ->where('company_id', company()->id)
    ->select('id')
    ->first();

if ($customFieldsGroupsId) {
    $customFields = \App\Models\CustomField::where('custom_field_group_id', $customFieldsGroupsId->id)
        ->where('export', 1)
        ->get();

    foreach ($customFields as $customField) {
        $fields[] = array(
            'id' => 'field_' . $customField->id,
            'name' => $customField->label,
            'required' => $customField->required == 'yes' ? 'Yes' : 'No'
        );
    }
}
```

## Troubleshooting

### Custom Fields Not Showing in Import
- Ensure the custom field has `export = 1` in the database
- Check that the custom field group is correctly linked to the Deal model
- Verify company_id matches the current company

### Custom Field Values Not Importing
- Check the column name matches exactly (including the `field_` prefix)
- For select fields, ensure the value matches an available option
- For date fields, use a recognizable date format

### Import Fails
- Check the Laravel logs: `storage/logs/laravel.log`
- Verify all required fields (email, name, pipeline, stages, value, close_date) are present
- Ensure the lead with the specified email exists in the system

## Support

For issues or questions, check:
- Laravel logs: `storage/logs/laravel.log`
- Queue worker logs (if using queues)
- Browser console for frontend errors

