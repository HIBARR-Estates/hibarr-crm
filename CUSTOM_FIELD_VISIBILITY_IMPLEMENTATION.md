# Custom Field Visibility Rules - Implementation Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Business Requirements](#business-requirements)
3. [Technical Architecture](#technical-architecture)
4. [Database Schema](#database-schema)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [User Interface Design](#user-interface-design)
8. [API Specifications](#api-specifications)
9. [Implementation Phases](#implementation-phases)
10. [Testing Strategy](#testing-strategy)
11. [Migration Plan](#migration-plan)
12. [Performance Considerations](#performance-considerations)
13. [Edge Cases & Error Handling](#edge-cases--error-handling)

---

## Overview

### Purpose

This document outlines the implementation of **dynamic visibility rules** for custom fields in Worksuite CRM. This feature allows administrators to configure conditional logic that determines when custom fields are visible to users based on values in other fields.

### Goals

- **Flexibility**: Support complex AND/OR logic across multiple fields
- **Maintainability**: Store rules in database without code changes
- **User Experience**: Real-time field visibility updates as users fill forms
- **Performance**: Efficient evaluation with minimal impact on form rendering
- **Extensibility**: Easy to add new operators or criteria types

### Current State

- Custom fields are currently always visible (no conditional logic)
- Fields are rendered using React components (`CustomFieldRenderer.tsx`)
- Backend uses Laravel with custom field models
- Frontend uses React + TypeScript + Ant Design + Inertia.js

### Target State

- Fields can be conditionally shown/hidden based on other field values
- Administrators can configure rules through a visual interface
- Rules support complex logic (AND/OR groups, multiple criteria)
- Real-time visibility updates as users interact with forms

---

## Business Requirements

### Use Cases

#### Scenario 1: Hide Multiple Fields Based on Single Condition
**Business Need**: Hide follow-up questions when user answers "No" to a primary question.

**Example**:
- **Controlling Field**: "Have you ever been to North Cyprus?" (Field ID: 48)
- **Dependent Fields**: 
  - "How many times?" (Field ID: 49)
  - "Last visited" (Field ID: 50)
  - "Purpose of visit" (Field ID: 51)
- **Logic**: Show dependent fields only if Field 48 = "Yes"

**Implementation**:
- One rule set for each dependent field
- Each rule set has one group (AND operator)
- Each group has one criterion: Field 48 equals "Yes"

#### Scenario 2: Show Field if Any of Multiple Conditions True (OR)
**Business Need**: Show a field if user has either invested before OR been to North Cyprus.

**Example**:
- **Controlling Fields**:
  - "Have you ever invested before?" (Field ID: 47)
  - "Have you ever been to North Cyprus?" (Field ID: 48)
- **Dependent Field**: "Purpose of visit or investment" (Field ID: 51)
- **Logic**: Visible if Field 47 = "Yes" **OR** Field 48 = "Yes"

**Implementation**:
- One rule set for Field 51
- One group with OR operator
- Two criteria:
  - Field 47 equals "Yes"
  - Field 48 equals "Yes"

#### Scenario 3: Show Field Only if All Conditions True (AND)
**Business Need**: Show special notes field only if user has both invested AND been to North Cyprus.

**Example**:
- **Controlling Fields**:
  - "Have you ever invested before?" (Field ID: 47)
  - "Have you ever been to North Cyprus?" (Field ID: 48)
- **Dependent Field**: "Special investment notes" (Field ID: 53)
- **Logic**: Visible only if Field 47 = "Yes" **AND** Field 48 = "Yes"

**Implementation**:
- One rule set for Field 53
- One group with AND operator
- Two criteria:
  - Field 47 equals "Yes"
  - Field 48 equals "Yes"

#### Scenario 4: Mixed Logic Across Multiple Fields
**Business Need**: Different fields have different visibility requirements.

**Example**:
- Field 49 → Visible if Field 48 = "Yes" (AND)
- Field 50 → Visible if Field 48 = "Yes" (AND)
- Field 51 → Visible if Field 47 = "Yes" OR Field 48 = "Yes" (OR)

**Implementation**:
- Separate rule sets for each field
- Each rule set configured independently

#### Scenario 5: Multiple Groups with AND/OR Relationships
**Business Need**: Show a field if (Group A conditions) AND/OR (Group B conditions), where each group has its own internal logic.

**Example**:
- **Dependent Field**: "Why North Cyprus Comments" (Field ID: 60)
- **Logic**: Show field if:
  - **Group 1 (OR)**: Any of these exist:
    - "Purpose of Investment" exists
    - "Investment (checkbox)" exists
    - "Rental Income (checkbox)" exists
    - "Residential (checkbox)" exists
  - **Groups Operator**: AND
  - **Group 2 (AND)**: All of these must be true:
    - "Residential (checkbox)" does NOT exist (negated)
    - "Immigration/Exit Plan (checkbox)" does NOT exist (negated)
- **Result**: Field is visible if any checkbox in Group 1 is selected AND neither Residential nor Immigration/Exit Plan are selected

**Implementation**:
- One rule set for Field 60
- `groups_operator` = "AND" (how to combine groups)
- Group 1: `group_operator` = "OR" with 4 criteria (all using "exists")
- Group 2: `group_operator` = "AND" with 2 criteria (both negated "exists")

### Functional Requirements

1. **Rule Configuration**
   - Administrators can create/edit/delete visibility rules
   - Rules can be enabled/disabled without deletion
   - Default visibility can be set (show/hide by default)

2. **Rule Evaluation**
   - Real-time evaluation as users fill forms
   - Support for all field types (text, number, select, radio, checkbox, date, etc.)
   - Support for multiple operators (equals, exists, boolean, >, <, >=, <=, in, not_in)

3. **User Experience**
   - Smooth show/hide transitions
   - Fields appear/disappear instantly on value change
   - Hidden fields retain their values (not cleared)
   - Validation errors cleared when field becomes hidden

4. **Performance**
   - Evaluation should not cause noticeable form lag
   - Support forms with 50+ custom fields
   - Efficient re-rendering on value changes

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  Form (React)   │─────────▶│ CustomField      │          │
│  │  Ant Design     │         │ Renderer         │          │
│  └──────────────────┘         └──────────────────┘          │
│         │                              │                      │
│         │                              ▼                      │
│         │                    ┌──────────────────┐             │
│         │                    │ Visibility Hook  │             │
│         │                    │ (useCustomField  │             │
│         │                    │  Visibility)     │             │
│         │                    └──────────────────┘             │
│         │                              │                      │
│         │                              ▼                      │
│         │                    ┌──────────────────┐             │
│         │                    │ Evaluation       │             │
│         │                    │ Utility          │             │
│         └────────────────────┘                  │             │
│                                                  │             │
└──────────────────────────────────────────────────┼─────────────┘
                                                   │
┌──────────────────────────────────────────────────┼─────────────┐
│                   Backend (Laravel)              │             │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │ CustomField      │────────▶│ ShowRuleSet      │             │
│  │ Model            │         │ Model            │             │
│  └──────────────────┘         └──────────────────┘             │
│         │                              │                      │
│         │                              ▼                      │
│         │                    ┌──────────────────┐             │
│         │                    │ ShowRuleGroup    │             │
│         │                    │ Model            │             │
│         │                    └──────────────────┘             │
│         │                              │                      │
│         │                              ▼                      │
│         │                    ┌──────────────────┐             │
│         │                    │ ShowCriteria      │             │
│         │                    │ Model             │             │
│         │                    └──────────────────┘             │
│         │                              │                      │
│         │                              ▼                      │
│         │                    ┌──────────────────┐             │
│         │                    │ Visibility      │             │
│         │                    │ Service         │             │
│         └────────────────────┘                  │             │
│                                                  │             │
└──────────────────────────────────────────────────┘             │
                                                                 │
┌────────────────────────────────────────────────────────────────┘
│                    Database (MySQL)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │custom_fields│  │show_rule_sets│  │show_rule_     │        │
│  │             │  │              │  │groups        │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                               │
│  ┌──────────────┐                                            │
│  │show_criteria │                                            │
│  └──────────────┘                                            │
└───────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend**:
- React 18+ with TypeScript
- Ant Design 5.x (Form components)
- Inertia.js (server communication)
- React Hooks (useState, useEffect, useMemo, useCallback)

**Backend**:
- Laravel 10+
- MySQL/MariaDB
- Eloquent ORM

**Key Libraries**:
- `Form.useWatch` from Ant Design (field value watching)
- React memoization hooks (performance optimization)

---

## Database Schema

### Schema Extensions

#### 1. `custom_fields` Table (Extended)

```sql
ALTER TABLE custom_fields
ADD COLUMN important_flag BOOLEAN DEFAULT FALSE,
ADD COLUMN display_order INT DEFAULT 0;
```

**New Fields**:
- `important_flag`: Marks fields as important (for UI highlighting)
- `display_order`: Controls field rendering order

#### 2. `show_rule_sets` Table (New)

```sql
CREATE TABLE show_rule_sets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    field_id BIGINT UNSIGNED NOT NULL,
    default_visibility BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    groups_operator ENUM('AND', 'OR') DEFAULT 'AND',
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    
    FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE,
    UNIQUE KEY unique_field_rule_set (field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Fields**:
- `id`: Primary key
- `field_id`: Foreign key to `custom_fields.id` (one rule set per field)
- `default_visibility`: Default visibility when rules are disabled or no rules match
- `enabled`: Whether the rule set is active
- `groups_operator`: How to combine multiple groups ('AND' or 'OR'). Defaults to 'AND'. Only relevant when a rule set has multiple groups.

#### 3. `show_rule_groups` Table (New)

```sql
CREATE TABLE show_rule_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rule_set_id BIGINT UNSIGNED NOT NULL,
    group_operator ENUM('AND', 'OR') DEFAULT 'AND',
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    
    FOREIGN KEY (rule_set_id) REFERENCES show_rule_sets(id) ON DELETE CASCADE,
    INDEX idx_rule_set (rule_set_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Fields**:
- `id`: Primary key
- `rule_set_id`: Foreign key to `show_rule_sets.id`
- `group_operator`: How to combine criteria within this group ('AND' or 'OR'). This controls the logic between criteria within a single group.

**Note**: A rule set can have multiple groups. The `groups_operator` field in `show_rule_sets` controls how multiple groups are combined. Each group's `group_operator` controls how criteria within that group are combined.

#### 4. `show_criteria` Table (New)

```sql
CREATE TABLE show_criteria (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    group_id BIGINT UNSIGNED NOT NULL,
    reference_field_id BIGINT UNSIGNED NOT NULL,
    operator ENUM('equals', 'exists', 'boolean', '>', '<', '>=', '<=', 'in', 'not_in') NOT NULL,
    reference_value TEXT NULL,
    negate BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    
    FOREIGN KEY (group_id) REFERENCES show_rule_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (reference_field_id) REFERENCES custom_fields(id) ON DELETE CASCADE,
    INDEX idx_group (group_id),
    INDEX idx_reference_field (reference_field_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Fields**:
- `id`: Primary key
- `group_id`: Foreign key to `show_rule_groups.id`
- `reference_field_id`: The field being evaluated (controlling field)
- `operator`: Comparison operator
- `reference_value`: Value to compare against (JSON for 'in'/'not_in')
- `negate`: Whether to negate the result

### Relationship Diagram

```
custom_fields (1) ──────< (1) show_rule_sets
                                │
                                │ (many) - supports multiple groups
                                │
                                ▼
                        show_rule_groups (*)
                                │
                                │ (many)
                                │
                                ▼
                        show_criteria (*)
                                │
                                │ (many)
                                │
                                ▼
                        custom_fields (reference_field_id)
```

**Key Relationships**:
- One `custom_field` can have one `show_rule_set`
- One `show_rule_set` can have multiple `show_rule_groups` (multi-group support)
- One `show_rule_group` can have multiple `show_criteria`
- Each `show_criterion` references one `custom_field` (the controlling field)

### Data Examples

#### Example 1: Simple Single Condition

**Field 49** ("How many times?") should be visible only if **Field 48** = "Yes"

```sql
-- Rule Set
INSERT INTO show_rule_sets (field_id, default_visibility, enabled) 
VALUES (49, FALSE, TRUE);

-- Rule Group
INSERT INTO show_rule_groups (rule_set_id, group_operator) 
VALUES (LAST_INSERT_ID(), 'AND');

-- Criterion
INSERT INTO show_criteria (group_id, reference_field_id, operator, reference_value, negate)
VALUES (LAST_INSERT_ID(), 48, 'equals', 'Yes', FALSE);
```

#### Example 2: OR Condition

**Field 51** visible if **Field 47** = "Yes" OR **Field 48** = "Yes"

```sql
-- Rule Set
INSERT INTO show_rule_sets (field_id, default_visibility, enabled) 
VALUES (51, FALSE, TRUE);

-- Rule Group (OR operator)
INSERT INTO show_rule_groups (rule_set_id, group_operator) 
VALUES (LAST_INSERT_ID(), 'OR');

-- Criteria
INSERT INTO show_criteria (group_id, reference_field_id, operator, reference_value, negate)
VALUES 
    (LAST_INSERT_ID(), 47, 'equals', 'Yes', FALSE),
    (LAST_INSERT_ID(), 48, 'equals', 'Yes', FALSE);
```

#### Example 3: AND Condition

**Field 53** visible only if **Field 47** = "Yes" AND **Field 48** = "Yes"

```sql
-- Rule Set
INSERT INTO show_rule_sets (field_id, default_visibility, enabled) 
VALUES (53, FALSE, TRUE);

-- Rule Group (AND operator)
INSERT INTO show_rule_groups (rule_set_id, group_operator) 
VALUES (LAST_INSERT_ID(), 'AND');

-- Criteria
INSERT INTO show_criteria (group_id, reference_field_id, operator, reference_value, negate)
VALUES 
    (LAST_INSERT_ID(), 47, 'equals', 'Yes', FALSE),
    (LAST_INSERT_ID(), 48, 'equals', 'Yes', FALSE);
```

#### Example 4: Multiple Groups with AND Relationship

**Field 60** ("Why North Cyprus Comments") visible if:
- **Group 1 (OR)**: Any checkbox selected (Purpose of Investment OR Investment OR Rental Income OR Residential)
- **Groups Operator**: AND
- **Group 2 (AND)**: Neither Residential NOR Immigration/Exit Plan selected

```sql
-- Rule Set with groups_operator = 'AND'
INSERT INTO show_rule_sets (field_id, default_visibility, enabled, groups_operator) 
VALUES (60, FALSE, TRUE, 'AND');

-- Group 1: OR operator (any of these checkboxes exist)
INSERT INTO show_rule_groups (rule_set_id, group_operator) 
VALUES (LAST_INSERT_ID(), 'OR');
SET @group1_id = LAST_INSERT_ID();

-- Group 1 Criteria
INSERT INTO show_criteria (group_id, reference_field_id, operator, reference_value, negate)
VALUES 
    (@group1_id, 55, 'exists', NULL, FALSE),  -- Purpose of Investment
    (@group1_id, 56, 'exists', NULL, FALSE),  -- Investment (checkbox)
    (@group1_id, 57, 'exists', NULL, FALSE),  -- Rental Income (checkbox)
    (@group1_id, 58, 'exists', NULL, FALSE);  -- Residential (checkbox)

-- Group 2: AND operator (both must be false, so both negated)
INSERT INTO show_rule_groups (rule_set_id, group_operator) 
VALUES ((SELECT id FROM show_rule_sets WHERE field_id = 60), 'AND');
SET @group2_id = LAST_INSERT_ID();

-- Group 2 Criteria (both negated to check they DON'T exist)
INSERT INTO show_criteria (group_id, reference_field_id, operator, reference_value, negate)
VALUES 
    (@group2_id, 58, 'exists', NULL, TRUE),   -- Residential (negated)
    (@group2_id, 59, 'exists', NULL, TRUE);   -- Immigration/Exit Plan (negated)
```

**Evaluation Logic**:
1. Evaluate Group 1: Check if any of the 4 checkboxes exist (OR logic) → Result: `true` or `false`
2. Evaluate Group 2: Check if Residential does NOT exist AND Immigration/Exit Plan does NOT exist (AND logic with negated exists) → Result: `true` or `false`
3. Combine groups: Group 1 Result **AND** Group 2 Result → Final visibility

---

## Backend Implementation

### Models

#### 1. CustomField Model Extension

**File**: `app/Models/CustomField.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasOne;

class CustomField extends BaseModel
{
    // ... existing code ...

    /**
     * Get the visibility rule set for this field
     */
    public function showRuleSet(): HasOne
    {
        return $this->hasOne(ShowRuleSet::class, 'field_id');
    }

    /**
     * Check if field has visibility rules
     */
    public function hasVisibilityRules(): bool
    {
        return $this->showRuleSet && $this->showRuleSet->enabled;
    }
}
```

#### 2. ShowRuleSet Model

**File**: `app/Models/ShowRuleSet.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ShowRuleSet extends Model
{
    protected $fillable = [
        'field_id',
        'default_visibility',
        'enabled',
    ];

    protected $casts = [
        'default_visibility' => 'boolean',
        'enabled' => 'boolean',
    ];

    /**
     * Get the custom field this rule set belongs to
     */
    public function field(): BelongsTo
    {
        return $this->belongsTo(CustomField::class, 'field_id');
    }

    /**
     * Get the rule group for this rule set
     */
    public function group(): HasOne
    {
        return $this->hasOne(ShowRuleGroup::class, 'rule_set_id');
    }

    /**
     * Get all groups (for future multi-group support)
     */
    public function groups()
    {
        return $this->hasMany(ShowRuleGroup::class, 'rule_set_id');
    }
}
```

#### 3. ShowRuleGroup Model

**File**: `app/Models/ShowRuleGroup.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShowRuleGroup extends Model
{
    protected $fillable = [
        'rule_set_id',
        'group_operator',
    ];

    /**
     * Get the rule set this group belongs to
     */
    public function ruleSet(): BelongsTo
    {
        return $this->belongsTo(ShowRuleSet::class, 'rule_set_id');
    }

    /**
     * Get all criteria for this group
     */
    public function criteria(): HasMany
    {
        return $this->hasMany(ShowCriterion::class, 'group_id')->orderBy('id');
    }
}
```

#### 4. ShowCriterion Model

**File**: `app/Models/ShowCriterion.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShowCriterion extends Model
{
    protected $fillable = [
        'group_id',
        'reference_field_id',
        'operator',
        'reference_value',
        'negate',
    ];

    protected $casts = [
        'negate' => 'boolean',
    ];

    /**
     * Get the rule group this criterion belongs to
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(ShowRuleGroup::class, 'group_id');
    }

    /**
     * Get the reference field being evaluated
     */
    public function referenceField(): BelongsTo
    {
        return $this->belongsTo(CustomField::class, 'reference_field_id');
    }
}
```

### Service: Visibility Evaluation

**File**: `app/Services/CustomFieldVisibilityService.php`

```php
<?php

namespace App\Services;

use App\Models\CustomField;
use App\Models\ShowRuleSet;

class CustomFieldVisibilityService
{
    /**
     * Evaluate visibility for a single field
     *
     * @param int $fieldId
     * @param array $currentValues Array of field values: ['field_47' => 'Yes', 'field_48' => 'No']
     * @return bool
     */
    public function evaluate(int $fieldId, array $currentValues): bool
    {
        $field = CustomField::with(['showRuleSet.group.criteria.referenceField'])->find($fieldId);
        
        if (!$field || !$field->showRuleSet) {
            return true; // Default: visible if no rules
        }

        $ruleSet = $field->showRuleSet;

        // If rule set is disabled, use default visibility
        if (!$ruleSet->enabled) {
            return $ruleSet->default_visibility;
        }

        // Load all groups for this rule set
        $groups = $ruleSet->groups()->with('criteria.referenceField')->get();

        // If no groups or all groups are empty, use default visibility
        if ($groups->isEmpty() || $groups->every(fn($g) => $g->criteria->isEmpty())) {
            return $ruleSet->default_visibility;
        }

        $groupResults = [];

        // Evaluate each group
        foreach ($groups as $group) {
            if ($group->criteria->isEmpty()) {
                continue; // Skip empty groups
            }

            $criteriaResults = [];

            // Evaluate each criterion in the group
            foreach ($group->criteria as $criterion) {
                $referenceValue = $currentValues['field_' . $criterion->reference_field_id] ?? null;
                $result = $this->evaluateCriterion($criterion, $referenceValue);
                
                // Apply negation if needed
                $criteriaResults[] = $criterion->negate ? !$result : $result;
            }

            // Combine criteria within group based on group_operator
            if ($group->group_operator === 'OR') {
                // At least one criterion must pass
                $groupResult = !empty($criteriaResults) && in_array(true, $criteriaResults, true);
            } else {
                // All criteria must pass (AND logic)
                $groupResult = !empty($criteriaResults) && !in_array(false, $criteriaResults, true);
            }

            $groupResults[] = $groupResult;
        }

        // Combine groups based on groups_operator (from rule set)
        $groupsOperator = $ruleSet->groups_operator ?? 'AND';
        
        if ($groupsOperator === 'OR') {
            // At least one group must pass
            $finalResult = !empty($groupResults) && in_array(true, $groupResults, true);
        } else {
            // All groups must pass (AND logic)
            $finalResult = !empty($groupResults) && !in_array(false, $groupResults, true);
        }

        return $finalResult;
    }

    /**
     * Evaluate a single criterion
     *
     * @param ShowCriterion $criterion
     * @param mixed $fieldValue
     * @return bool
     */
    protected function evaluateCriterion($criterion, $fieldValue): bool
    {
        $operator = $criterion->operator;
        $referenceValue = $criterion->reference_value;

        switch ($operator) {
            case 'equals':
                return (string)$fieldValue === (string)$referenceValue;

            case 'exists':
                return !empty($fieldValue);

            case 'boolean':
                return filter_var($fieldValue, FILTER_VALIDATE_BOOLEAN);

            case '>':
                return (float)$fieldValue > (float)$referenceValue;

            case '<':
                return (float)$fieldValue < (float)$referenceValue;

            case '>=':
                return (float)$fieldValue >= (float)$referenceValue;

            case '<=':
                return (float)$fieldValue <= (float)$referenceValue;

            case 'in':
                $values = json_decode($referenceValue, true) ?: [];
                return in_array($fieldValue, $values);

            case 'not_in':
                $values = json_decode($referenceValue, true) ?: [];
                return !in_array($fieldValue, $values);

            default:
                return false;
        }
    }

    /**
     * Evaluate visibility for multiple fields at once
     *
     * @param array $fieldIds
     * @param array $currentValues
     * @return array ['field_47' => true, 'field_48' => false, ...]
     */
    public function evaluateMultiple(array $fieldIds, array $currentValues): array
    {
        $results = [];
        
        foreach ($fieldIds as $fieldId) {
            $results['field_' . $fieldId] = $this->evaluate($fieldId, $currentValues);
        }
        
        return $results;
    }
}
```

### Controller Extensions

#### CustomFieldController Updates

**File**: `app/Http/Controllers/CustomFieldController.php`

```php
// Add method to include rule sets when fetching fields
public function index()
{
    $this->customFields = CustomField::with('showRuleSet.group.criteria')
        ->join('custom_field_groups', 'custom_field_groups.id', '=', 'custom_fields.custom_field_group_id')
        ->select('custom_fields.*', 'custom_field_groups.name as module')
        ->get();
    
    // ... rest of existing code ...
}

// New method: Evaluate visibility
public function evaluateVisibility(Request $request)
{
    $fieldId = $request->input('field_id');
    $currentValues = $request->input('current_values', []);
    
    $service = new CustomFieldVisibilityService();
    $visible = $service->evaluate($fieldId, $currentValues);
    
    return response()->json(['visible' => $visible]);
}

// New method: Get rule set for a field
public function getRuleSet($fieldId)
{
    $field = CustomField::with('showRuleSet.group.criteria.referenceField')
        ->findOrFail($fieldId);
    
    return response()->json($field->showRuleSet);
}

// New method: Save/Update rule set
public function saveRuleSet(Request $request, $fieldId)
{
    $field = CustomField::findOrFail($fieldId);
    
    $ruleSetData = $request->input('rule_set');
    
    // Create or update rule set
    $ruleSet = $field->showRuleSet()->updateOrCreate(
        ['field_id' => $fieldId],
        [
            'default_visibility' => $ruleSetData['default_visibility'] ?? true,
            'enabled' => $ruleSetData['enabled'] ?? true,
        ]
    );
    
    // Handle group and criteria
    if (isset($ruleSetData['group'])) {
        $group = $ruleSet->group()->updateOrCreate(
            ['rule_set_id' => $ruleSet->id],
            ['group_operator' => $ruleSetData['group']['group_operator'] ?? 'AND']
        );
        
        // Delete existing criteria
        $group->criteria()->delete();
        
        // Create new criteria
        if (isset($ruleSetData['group']['criteria'])) {
            foreach ($ruleSetData['group']['criteria'] as $criterionData) {
                $group->criteria()->create([
                    'reference_field_id' => $criterionData['reference_field_id'],
                    'operator' => $criterionData['operator'],
                    'reference_value' => $criterionData['reference_value'],
                    'negate' => $criterionData['negate'] ?? false,
                ]);
            }
        }
    }
    
    return response()->json(['success' => true, 'rule_set' => $ruleSet->load('group.criteria')]);
}
```

### API Routes

**File**: `routes/web.php` or `routes/api.php`

```php
// Add to existing custom fields routes
Route::prefix('custom-fields')->group(function () {
    Route::get('{id}/rule-set', [CustomFieldController::class, 'getRuleSet']);
    Route::post('{id}/rule-set', [CustomFieldController::class, 'saveRuleSet']);
    Route::post('evaluate-visibility', [CustomFieldController::class, 'evaluateVisibility']);
});
```

---

## Frontend Implementation

### Type Definitions

**File**: `resources/js/Types/index.ts`

```typescript
// Extend existing CustomField interface
export interface CustomField {
    id: number;
    label: string;
    name: string;
    type: string;
    required: string;
    values: string | null;
    custom_field_group_id: number;
    show_table: string;
    field_display_name: string;
    field_order: number;
    // New fields
    important_flag?: boolean;
    display_order?: number;
    show_rule_set?: ShowRuleSet;
}

// New interfaces
export interface ShowRuleSet {
    id: number;
    field_id: number;
    default_visibility: boolean;
    enabled: boolean;
    groups_operator?: 'AND' | 'OR'; // How to combine multiple groups
    group?: ShowRuleGroup; // For backward compatibility (single group)
    groups?: ShowRuleGroup[]; // Multiple groups support
}

export interface ShowRuleGroup {
    id: number;
    rule_set_id: number;
    group_operator: 'AND' | 'OR'; // How to combine criteria within this group
    criteria?: ShowCriterion[];
}

export interface ShowCriterion {
    id: number;
    group_id: number;
    reference_field_id: number;
    operator: 'equals' | 'exists' | 'boolean' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in';
    reference_value: string;
    negate: boolean;
    reference_field?: CustomField; // Populated from backend
}
```

### Visibility Evaluation Utility

**File**: `resources/js/lib/customFieldVisibility.ts`

```typescript
import { CustomField, ShowRuleSet, ShowCriterion } from '@/Types';

/**
 * Evaluate a single criterion
 */
function evaluateCriterion(
    criterion: ShowCriterion,
    fieldValue: any
): boolean {
    const { operator, reference_value, negate } = criterion;
    let result = false;

    switch (operator) {
        case 'equals':
            result = String(fieldValue) === String(reference_value);
            break;

        case 'exists':
            result = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
            break;

        case 'boolean':
            result = Boolean(fieldValue);
            break;

        case '>':
            result = Number(fieldValue) > Number(reference_value);
            break;

        case '<':
            result = Number(fieldValue) < Number(reference_value);
            break;

        case '>=':
            result = Number(fieldValue) >= Number(reference_value);
            break;

        case '<=':
            result = Number(fieldValue) <= Number(reference_value);
            break;

        case 'in':
            try {
                const values = JSON.parse(reference_value);
                result = Array.isArray(values) && values.includes(fieldValue);
            } catch {
                result = false;
            }
            break;

        case 'not_in':
            try {
                const values = JSON.parse(reference_value);
                result = Array.isArray(values) && !values.includes(fieldValue);
            } catch {
                result = false;
            }
            break;

        default:
            result = false;
    }

    return negate ? !result : result;
}

/**
 * Evaluate visibility for a single field
 */
export function evaluateFieldVisibility(
    field: CustomField,
    allFieldValues: Record<string, any>
): boolean {
    const ruleSet = field.show_rule_set;

    // If no rule set, field is visible by default
    if (!ruleSet) {
        return true;
    }

    // If rule set is disabled, use default visibility
    if (!ruleSet.enabled) {
        return ruleSet.default_visibility;
    }

    // Get groups (support both single group for backward compatibility and multiple groups)
    const groups = ruleSet.groups && ruleSet.groups.length > 0 
        ? ruleSet.groups 
        : (ruleSet.group ? [ruleSet.group] : []);

    // If no groups or all groups are empty, use default visibility
    if (groups.length === 0 || groups.every(g => !g.criteria || g.criteria.length === 0)) {
        return ruleSet.default_visibility;
    }

    const groupResults: boolean[] = [];

    // Evaluate each group
    for (const group of groups) {
        if (!group.criteria || group.criteria.length === 0) {
            continue; // Skip empty groups
        }

        const criteriaResults: boolean[] = [];

        // Evaluate each criterion in the group
        for (const criterion of group.criteria) {
            const fieldKey = `field_${criterion.reference_field_id}`;
            const fieldValue = allFieldValues[fieldKey];
            const result = evaluateCriterion(criterion, fieldValue);
            criteriaResults.push(result);
        }

        // Combine criteria within group based on group_operator
        let groupResult: boolean;
        if (group.group_operator === 'OR') {
            // At least one criterion must pass
            groupResult = criteriaResults.length > 0 && criteriaResults.some(r => r === true);
        } else {
            // All criteria must pass (AND logic)
            groupResult = criteriaResults.length > 0 && criteriaResults.every(r => r === true);
        }

        groupResults.push(groupResult);
    }

    // Combine groups based on groups_operator (from rule set)
    const groupsOperator = ruleSet.groups_operator || 'AND';
    
    if (groupsOperator === 'OR') {
        // At least one group must pass
        return groupResults.length > 0 && groupResults.some(r => r === true);
    } else {
        // All groups must pass (AND logic)
        return groupResults.length > 0 && groupResults.every(r => r === true);
    }
}

/**
 * Evaluate visibility for all fields
 * Returns a map: { field_47: true, field_48: false, ... }
 */
export function evaluateAllFieldsVisibility(
    fields: CustomField[],
    allFieldValues: Record<string, any>
): Record<number, boolean> {
    const visibilityMap: Record<number, boolean> = {};

    for (const field of fields) {
        visibilityMap[field.id] = evaluateFieldVisibility(field, allFieldValues);
    }

    return visibilityMap;
}
```

### Custom Hook for Visibility

**File**: `resources/js/Hooks/useCustomFieldVisibility.ts`

```typescript
import { useMemo } from 'react';
import { Form } from 'antd';
import { CustomField } from '@/Types';
import { evaluateAllFieldsVisibility } from '@/lib/customFieldVisibility';

interface UseCustomFieldVisibilityOptions {
    fields: CustomField[];
    form: any;
    namePrefix?: string;
}

/**
 * Hook to manage custom field visibility
 * Watches form values and evaluates visibility rules
 */
export function useCustomFieldVisibility({
    fields,
    form,
    namePrefix = 'custom_fields_data',
}: UseCustomFieldVisibilityOptions) {
    // Watch all custom field values
    const allFieldValues = Form.useWatch(namePrefix, form) || {};

    // Evaluate visibility for all fields
    const visibilityMap = useMemo(() => {
        return evaluateAllFieldsVisibility(fields, allFieldValues);
    }, [fields, allFieldValues]);

    /**
     * Check if a field is visible
     */
    const isFieldVisible = (fieldId: number): boolean => {
        return visibilityMap[fieldId] !== false;
    };

    /**
     * Get visibility map
     */
    const getVisibilityMap = (): Record<number, boolean> => {
        return visibilityMap;
    };

    return {
        visibilityMap,
        isFieldVisible,
        getVisibilityMap,
    };
}
```

### Updated CustomFieldRenderer

**File**: `resources/js/Components/CustomFieldRenderer.tsx`

```typescript
import React, { useMemo } from 'react';
import {
    Form,
    Input,
    Select,
    DatePicker,
    Checkbox,
    Radio,
    Row,
    Col,
} from 'antd';
import { CustomField } from '@/Types';
import { useCustomFieldVisibility } from '@/Hooks/useCustomFieldVisibility';
import dayjs from 'dayjs';

interface Props {
    fields: CustomField[];
    form: any;
    namePrefix?: string;
}

const CustomFieldRenderer: React.FC<Props> = ({
    fields,
    form,
    namePrefix = 'custom_fields_data',
}) => {
    // Get visibility map
    const { visibilityMap, isFieldVisible } = useCustomFieldVisibility({
        fields,
        form,
        namePrefix,
    });

    // Sort fields by display_order
    const sortedFields = useMemo(() => {
        return [...fields].sort((a, b) => {
            const orderA = a.display_order || 0;
            const orderB = b.display_order || 0;
            return orderA - orderB;
        });
    }, [fields]);

    // Render methods (existing code)
    const renderTextField = (field: CustomField) => (
        <Form.Item
            key={field.id}
            name={[namePrefix, `field_${field.id}`]}
            label={field.label}
            rules={
                field.required === '1' && isFieldVisible(field.id)
                    ? [{ required: true, message: `${field.label} is required` }]
                    : []
            }
        >
            <Input placeholder={`Enter ${field.label}`} />
        </Form.Item>
    );

    // ... other render methods (renderNumberField, renderSelectField, etc.) ...

    const renderField = (field: CustomField) => {
        // Check visibility
        if (!isFieldVisible(field.id)) {
            return null;
        }

        switch (field.type) {
            case 'text':
                return renderTextField(field);
            case 'number':
                return renderNumberField(field);
            case 'textarea':
                return renderTextAreaField(field);
            case 'select':
                return renderSelectField(field);
            case 'radio':
                return renderRadioField(field);
            case 'checkbox':
                return renderCheckboxField(field);
            case 'date':
                return renderDateField(field);
            default:
                return renderTextField(field);
        }
    };

    return (
        <Row gutter={[16, 16]}>
            {sortedFields.map((field) => {
                const fieldElement = renderField(field);
                if (!fieldElement) return null;

                return (
                    <Col
                        key={field.id}
                        span={field.type === 'textarea' ? 24 : 12}
                    >
                        {fieldElement}
                    </Col>
                );
            })}
        </Row>
    );
};

export default CustomFieldRenderer;
```

---

## User Interface Design

### Admin Interface: Rule Builder

#### Location
Custom Field Edit Modal → New "Visibility Rules" Tab

#### Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Custom Field: "How many times?"                    [X]│
├─────────────────────────────────────────────────────────────┤
│  [Basic Info] [Visibility Rules] [Advanced]                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Visibility Rules                                           │
│                                                             │
│  ☑ Enable visibility rules                                 │
│                                                             │
│  Default Visibility: ○ Show  ● Hide                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Rule Group                                           │   │
│  │                                                       │   │
│  │ Group Operator: [AND ▼]                              │   │
│  │                                                       │   │
│  │ Criteria:                                             │   │
│  │                                                       │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ Field: [Have you ever been to North Cyprus? ▼] │ │   │
│  │ │ Operator: [equals ▼]                            │ │   │
│  │ │ Value: [Yes        ]                             │ │   │
│  │ │ ☐ Negate                                         │ │   │
│  │ │ [Remove]                                         │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  │                                                       │   │
│  │ [+ Add Criterion]                                     │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Preview:                                                   │
│  This field will be visible when:                          │
│  • "Have you ever been to North Cyprus?" equals "Yes"     │
│                                                             │
│  [Cancel] [Save Rules]                                     │
└─────────────────────────────────────────────────────────────┘
```

#### Component Structure

**File**: `resources/js/Components/CustomFieldRuleBuilder.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import {
    Form,
    Switch,
    Radio,
    Select,
    Input,
    Button,
    Card,
    Space,
    Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { CustomField, ShowRuleSet, ShowCriterion } from '@/Types';

interface Props {
    field: CustomField;
    availableFields: CustomField[]; // All fields that can be used as references
    ruleSet?: ShowRuleSet;
    onSave: (ruleSet: Partial<ShowRuleSet>) => void;
    onCancel: () => void;
}

const CustomFieldRuleBuilder: React.FC<Props> = ({
    field,
    availableFields,
    ruleSet,
    onSave,
    onCancel,
}) => {
    const [form] = Form.useForm();
    const [enabled, setEnabled] = useState(ruleSet?.enabled ?? false);
    const [groupOperator, setGroupOperator] = useState<'AND' | 'OR'>(
        ruleSet?.group?.group_operator ?? 'AND'
    );

    useEffect(() => {
        if (ruleSet) {
            form.setFieldsValue({
                default_visibility: ruleSet.default_visibility,
                enabled: ruleSet.enabled,
                group_operator: ruleSet.group?.group_operator ?? 'AND',
                criteria: ruleSet.group?.criteria ?? [],
            });
            setEnabled(ruleSet.enabled);
        }
    }, [ruleSet, form]);

    const handleSave = (values: any) => {
        const ruleSetData: Partial<ShowRuleSet> = {
            field_id: field.id,
            default_visibility: values.default_visibility,
            enabled: values.enabled,
            group: {
                group_operator: values.group_operator,
                criteria: values.criteria || [],
            },
        };

        onSave(ruleSetData);
    };

    return (
        <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item label="Enable visibility rules">
                <Switch
                    checked={enabled}
                    onChange={setEnabled}
                />
            </Form.Item>

            <Form.Item
                name="default_visibility"
                label="Default Visibility"
                initialValue={true}
            >
                <Radio.Group>
                    <Radio value={true}>Show</Radio>
                    <Radio value={false}>Hide</Radio>
                </Radio.Group>
            </Form.Item>

            {enabled && (
                <Card title="Rule Group" style={{ marginTop: 16 }}>
                    <Form.Item
                        name="group_operator"
                        label="Group Operator"
                        initialValue="AND"
                    >
                        <Select>
                            <Select.Option value="AND">AND (all criteria must match)</Select.Option>
                            <Select.Option value="OR">OR (any criterion must match)</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.List name="criteria">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map((field, index) => (
                                    <Card
                                        key={field.key}
                                        style={{ marginBottom: 16 }}
                                        extra={
                                            <Button
                                                type="text"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => remove(field.name)}
                                            >
                                                Remove
                                            </Button>
                                        }
                                    >
                                        <Space direction="vertical" style={{ width: '100%' }}>
                                            <Form.Item
                                                {...field}
                                                name={[field.name, 'reference_field_id']}
                                                label="Field"
                                                rules={[{ required: true }]}
                                            >
                                                <Select
                                                    placeholder="Select a field"
                                                    showSearch
                                                    filterOption={(input, option) =>
                                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                    }
                                                >
                                                    {availableFields
                                                        .filter(f => f.id !== field.id) // Exclude self
                                                        .map(f => (
                                                            <Select.Option
                                                                key={f.id}
                                                                value={f.id}
                                                                label={f.label}
                                                            >
                                                                {f.label}
                                                            </Select.Option>
                                                        ))}
                                                </Select>
                                            </Form.Item>

                                            <Form.Item
                                                {...field}
                                                name={[field.name, 'operator']}
                                                label="Operator"
                                                rules={[{ required: true }]}
                                            >
                                                <Select>
                                                    <Select.Option value="equals">equals</Select.Option>
                                                    <Select.Option value="exists">exists</Select.Option>
                                                    <Select.Option value="boolean">is boolean</Select.Option>
                                                    <Select.Option value=">">greater than</Select.Option>
                                                    <Select.Option value="<">less than</Select.Option>
                                                    <Select.Option value=">=">greater than or equal</Select.Option>
                                                    <Select.Option value="<=">less than or equal</Select.Option>
                                                    <Select.Option value="in">in list</Select.Option>
                                                    <Select.Option value="not_in">not in list</Select.Option>
                                                </Select>
                                            </Form.Item>

                                            <Form.Item
                                                {...field}
                                                name={[field.name, 'reference_value']}
                                                label="Value"
                                                dependencies={[['criteria', field.name, 'operator']]}
                                            >
                                                {Form.useWatch(['criteria', field.name, 'operator'], form) === 'in' ||
                                                Form.useWatch(['criteria', field.name, 'operator'], form) === 'not_in' ? (
                                                    <Input.TextArea
                                                        placeholder='Enter values as JSON array, e.g., ["Yes", "No"]'
                                                        rows={3}
                                                    />
                                                ) : (
                                                    <Input placeholder="Enter value" />
                                                )}
                                            </Form.Item>

                                            <Form.Item
                                                {...field}
                                                name={[field.name, 'negate']}
                                                valuePropName="checked"
                                                initialValue={false}
                                            >
                                                <Checkbox>Negate (NOT)</Checkbox>
                                            </Form.Item>
                                        </Space>
                                    </Card>
                                ))}

                                <Button
                                    type="dashed"
                                    onClick={() => add()}
                                    block
                                    icon={<PlusOutlined />}
                                >
                                    Add Criterion
                                </Button>
                            </>
                        )}
                    </Form.List>
                </Card>
            )}

            <Form.Item style={{ marginTop: 24 }}>
                <Space>
                    <Button onClick={onCancel}>Cancel</Button>
                    <Button type="primary" htmlType="submit">
                        Save Rules
                    </Button>
                </Space>
            </Form.Item>
        </Form>
    );
};

export default CustomFieldRuleBuilder;
```

### User-Facing Form: Real-Time Visibility

#### Behavior

1. **Initial Load**: Fields are rendered based on initial form values
2. **Value Change**: When a user changes a controlling field value:
   - Visibility is re-evaluated immediately
   - Dependent fields appear/disappear smoothly
   - No page reload required
3. **Visual Feedback**: 
   - Fields fade in/out (CSS transition)
   - No jarring layout shifts

#### CSS for Smooth Transitions

**File**: `resources/css/custom-fields.css` (or add to existing CSS)

```css
.custom-field-container {
    transition: opacity 0.3s ease, max-height 0.3s ease;
    overflow: hidden;
}

.custom-field-container.hidden {
    opacity: 0;
    max-height: 0;
    margin: 0;
    padding: 0;
}

.custom-field-container.visible {
    opacity: 1;
    max-height: 1000px; /* Adjust based on max field height */
}
```

---

## API Specifications

### 1. Get Rule Set for Field

**Endpoint**: `GET /custom-fields/{id}/rule-set`

**Response**:
```json
{
    "id": 1,
    "field_id": 49,
    "default_visibility": false,
    "enabled": true,
    "group": {
        "id": 1,
        "rule_set_id": 1,
        "group_operator": "AND",
        "criteria": [
            {
                "id": 1,
                "group_id": 1,
                "reference_field_id": 48,
                "operator": "equals",
                "reference_value": "Yes",
                "negate": false,
                "reference_field": {
                    "id": 48,
                    "label": "Have you ever been to North Cyprus?",
                    "type": "radio"
                }
            }
        ]
    }
}
```

### 2. Save/Update Rule Set

**Endpoint**: `POST /custom-fields/{id}/rule-set`

**Request Body**:
```json
{
    "rule_set": {
        "default_visibility": false,
        "enabled": true,
        "group": {
            "group_operator": "AND",
            "criteria": [
                {
                    "reference_field_id": 48,
                    "operator": "equals",
                    "reference_value": "Yes",
                    "negate": false
                }
            ]
        }
    }
}
```

**Response**:
```json
{
    "success": true,
    "rule_set": {
        "id": 1,
        "field_id": 49,
        "default_visibility": false,
        "enabled": true,
        "group": {
            "id": 1,
            "rule_set_id": 1,
            "group_operator": "AND",
            "criteria": [...]
        }
    }
}
```

### 3. Evaluate Visibility

**Endpoint**: `POST /custom-fields/evaluate-visibility`

**Request Body**:
```json
{
    "field_id": 49,
    "current_values": {
        "field_47": "Yes",
        "field_48": "No",
        "field_49": "3"
    }
}
```

**Response**:
```json
{
    "visible": false
}
```

### 4. Get Fields with Rule Sets

**Endpoint**: `GET /custom-fields?include_rule_sets=true`

**Response**:
```json
{
    "data": [
        {
            "id": 47,
            "label": "Have you ever invested before?",
            "type": "radio",
            "show_rule_set": null
        },
        {
            "id": 48,
            "label": "Have you ever been to North Cyprus?",
            "type": "radio",
            "show_rule_set": null
        },
        {
            "id": 49,
            "label": "How many times?",
            "type": "number",
            "show_rule_set": {
                "id": 1,
                "field_id": 49,
                "default_visibility": false,
                "enabled": true,
                "group": {
                    "id": 1,
                    "rule_set_id": 1,
                    "group_operator": "AND",
                    "criteria": [...]
                }
            }
        }
    ]
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Backend**:
- [ ] Create database migrations
- [ ] Create Eloquent models (ShowRuleSet, ShowRuleGroup, ShowCriterion)
- [ ] Extend CustomField model with relationships
- [ ] Create CustomFieldVisibilityService
- [ ] Add API endpoints (get, save, evaluate)

**Frontend**:
- [ ] Add TypeScript interfaces
- [ ] Create visibility evaluation utility functions
- [ ] Create useCustomFieldVisibility hook

**Testing**:
- [ ] Unit tests for visibility service
- [ ] API endpoint tests

### Phase 2: Basic Visibility (Week 2)

**Frontend**:
- [ ] Update CustomFieldRenderer with visibility logic
- [ ] Integrate useCustomFieldVisibility hook
- [ ] Add CSS transitions for show/hide
- [ ] Test with simple single-condition rules

**Testing**:
- [ ] Manual testing: Single condition rules
- [ ] Test form submission with hidden fields
- [ ] Test validation with conditional required fields

### Phase 3: Complex Rules (Week 2-3)

**Frontend**:
- [ ] Support AND logic (multiple criteria)
- [ ] Support OR logic (multiple criteria)
- [ ] Handle edge cases (empty values, null values)

**Backend**:
- [ ] Optimize visibility service
- [ ] Add caching if needed

**Testing**:
- [ ] Test AND logic scenarios
- [ ] Test OR logic scenarios
- [ ] Test negation (NOT operator)
- [ ] Test all operators (equals, >, <, in, etc.)

### Phase 4: Admin UI (Week 3)

**Frontend**:
- [ ] Create CustomFieldRuleBuilder component
- [ ] Add "Visibility Rules" tab to custom field edit modal
- [ ] Integrate with backend API
- [ ] Add form validation
- [ ] Add preview/help text

**Testing**:
- [ ] Test rule creation
- [ ] Test rule editing
- [ ] Test rule deletion
- [ ] Test enable/disable toggle

### Phase 5: Polish & Optimization (Week 4)

**Performance**:
- [ ] Optimize re-rendering (useMemo, useCallback)
- [ ] Add debouncing if needed
- [ ] Profile form performance with 50+ fields

**UX**:
- [ ] Smooth animations
- [ ] Loading states
- [ ] Error handling
- [ ] User feedback messages

**Documentation**:
- [ ] Update API documentation
- [ ] Create user guide for admins
- [ ] Document edge cases

**Testing**:
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Performance tests
- [ ] User acceptance testing

---

## Testing Strategy

### Unit Tests

#### Backend Tests

**File**: `tests/Unit/Services/CustomFieldVisibilityServiceTest.php`

```php
class CustomFieldVisibilityServiceTest extends TestCase
{
    public function test_evaluates_simple_equals_condition()
    {
        // Create field with rule: visible if field_48 = "Yes"
        // Test with field_48 = "Yes" → should return true
        // Test with field_48 = "No" → should return false
    }

    public function test_evaluates_and_logic()
    {
        // Create field with rule: visible if field_47 = "Yes" AND field_48 = "Yes"
        // Test various combinations
    }

    public function test_evaluates_or_logic()
    {
        // Create field with rule: visible if field_47 = "Yes" OR field_48 = "Yes"
        // Test various combinations
    }

    public function test_handles_missing_values()
    {
        // Test when reference field value is null/empty
    }

    public function test_respects_default_visibility()
    {
        // Test when rule set is disabled
    }
}
```

#### Frontend Tests

**File**: `resources/js/lib/__tests__/customFieldVisibility.test.ts`

```typescript
import { evaluateFieldVisibility } from '../customFieldVisibility';
import { CustomField } from '@/Types';

describe('customFieldVisibility', () => {
    it('returns true when no rule set exists', () => {
        const field: CustomField = { id: 1, label: 'Test', ... };
        const result = evaluateFieldVisibility(field, {});
        expect(result).toBe(true);
    });

    it('evaluates simple equals condition', () => {
        // Test equals operator
    });

    it('evaluates AND logic correctly', () => {
        // Test multiple criteria with AND
    });

    // ... more tests
});
```

### Integration Tests

**File**: `tests/Feature/CustomFieldVisibilityTest.php`

```php
class CustomFieldVisibilityTest extends TestCase
{
    public function test_api_returns_visibility_correctly()
    {
        // Create fields and rules
        // Make API call
        // Assert correct visibility
    }

    public function test_saving_rule_set_works()
    {
        // Create field
        // Save rule set via API
        // Verify in database
    }
}
```

### Manual Test Scenarios

#### Scenario 1: Simple Show/Hide
1. Create Field A (radio: Yes/No)
2. Create Field B (text)
3. Set rule: Field B visible if Field A = "Yes"
4. Open form
5. Select "No" in Field A → Field B should hide
6. Select "Yes" in Field A → Field B should show

#### Scenario 2: AND Logic
1. Create Field A (radio: Yes/No)
2. Create Field B (radio: Yes/No)
3. Create Field C (text)
4. Set rule: Field C visible if Field A = "Yes" AND Field B = "Yes"
5. Test all combinations:
   - A=Yes, B=Yes → C visible ✓
   - A=Yes, B=No → C hidden ✓
   - A=No, B=Yes → C hidden ✓
   - A=No, B=No → C hidden ✓

#### Scenario 3: OR Logic
1. Similar setup as Scenario 2
2. Set rule: Field C visible if Field A = "Yes" OR Field B = "Yes"
3. Test all combinations

#### Scenario 4: Form Submission
1. Set up conditional field
2. Fill form with values that hide a field
3. Submit form
4. Verify hidden field value is not cleared (or is cleared, depending on requirement)
5. Reload form
6. Verify field remains hidden if condition still false

---

## Migration Plan

### Step 1: Database Migration

```bash
php artisan make:migration add_visibility_fields_to_custom_fields
php artisan make:migration create_show_rule_sets_table
php artisan make:migration create_show_rule_groups_table
php artisan make:migration create_show_criteria_table
```

Run migrations:
```bash
php artisan migrate
```

### Step 2: Backfill Existing Fields

Create a migration or artisan command to set default visibility for existing fields:

```php
// In migration or command
CustomField::chunk(100, function ($fields) {
    foreach ($fields as $field) {
        ShowRuleSet::create([
            'field_id' => $field->id,
            'default_visibility' => true,
            'enabled' => false, // Disabled by default
        ]);
    }
});
```

### Step 3: Deploy Backend

1. Deploy models and services
2. Deploy API endpoints
3. Test API endpoints

### Step 4: Deploy Frontend (Gradual)

1. Deploy TypeScript types
2. Deploy utility functions
3. Deploy hook
4. Update CustomFieldRenderer (feature flag)
5. Enable for testing
6. Full rollout

### Step 5: Admin UI

1. Deploy rule builder component
2. Add to custom field edit modal
3. Train administrators
4. Monitor usage

### Rollback Plan

If issues arise:
1. Disable feature flag in frontend
2. Keep backend running (no breaking changes)
3. Revert frontend changes if needed
4. Database changes are additive (can be rolled back with migration rollback)

---

## Performance Considerations

### Frontend Optimization

1. **Memoization**:
   - Use `useMemo` for visibility calculations
   - Use `useCallback` for event handlers
   - Memoize sorted fields list

2. **Re-rendering**:
   - Only re-render fields when their visibility changes
   - Use React.memo for field components if needed

3. **Form Watching**:
   - `Form.useWatch` is efficient, but watching entire form can be expensive
   - Consider watching specific fields if form is very large

### Backend Optimization

1. **Eager Loading**:
   - Always eager load rule sets when fetching fields
   - Use `with()` to avoid N+1 queries

2. **Caching**:
   - Cache rule sets (if they don't change often)
   - Cache evaluation results per session

3. **Database Indexes**:
   - Index `field_id` in `show_rule_sets`
   - Index `rule_set_id` in `show_rule_groups`
   - Index `group_id` and `reference_field_id` in `show_criteria`

### Expected Performance

- **Form Load**: < 100ms additional time (with eager loading)
- **Visibility Evaluation**: < 10ms per field
- **Re-render on Value Change**: < 50ms for 20 fields
- **Form with 50 Fields**: Should remain responsive

---

## Edge Cases & Error Handling

### Edge Cases

1. **Circular Dependencies**
   - **Problem**: Field A depends on Field B, Field B depends on Field A
   - **Solution**: Detect cycles, default to hidden, show warning in admin

2. **Missing Reference Field**
   - **Problem**: Rule references field that was deleted
   - **Solution**: Skip criterion, log warning, use default visibility

3. **Invalid Operator for Field Type**
   - **Problem**: Using ">" operator on text field
   - **Solution**: Validate in admin UI, fallback to "equals" in evaluation

4. **Empty/Null Values**
   - **Problem**: Reference field has no value
   - **Solution**: Use "exists" operator, or handle gracefully in evaluation

5. **Form Submission with Hidden Required Fields**
   - **Problem**: Field is required but hidden
   - **Solution**: Clear validation errors when field becomes hidden

6. **Rapid Value Changes**
   - **Problem**: User changes values quickly, causing multiple re-evaluations
   - **Solution**: Debounce if needed (likely not necessary with React)

7. **Multiple Groups with Complex Logic**
   - **Problem**: Complex nested logic with multiple groups may be difficult to debug
   - **Solution**: Provide clear admin UI feedback, log evaluation steps in development mode
   - **Note**: When using multiple groups, ensure the `groups_operator` is set correctly on the rule set

### Error Handling

#### Backend Errors

```php
try {
    $visible = $service->evaluate($fieldId, $currentValues);
} catch (\Exception $e) {
    \Log::error('Visibility evaluation failed', [
        'field_id' => $fieldId,
        'error' => $e->getMessage(),
    ]);
    // Return default visibility
    return $ruleSet->default_visibility ?? true;
}
```

#### Frontend Errors

```typescript
try {
    const visible = evaluateFieldVisibility(field, allFieldValues);
    return visible;
} catch (error) {
    console.error('Visibility evaluation failed', error);
    // Return true (default: visible) to avoid breaking form
    return true;
}
```

### Validation

#### Admin UI Validation

- Prevent selecting same field as reference (self-reference)
- Validate operator matches field type
- Validate value format for "in"/"not_in" operators
- Show helpful error messages

#### Backend Validation

```php
// In CustomFieldController::saveRuleSet
$validator = Validator::make($request->all(), [
    'rule_set.groups_operator' => 'sometimes|in:AND,OR',
    'rule_set.groups.*.group_operator' => 'required|in:AND,OR',
    'rule_set.groups.*.criteria.*.reference_field_id' => 'required|exists:custom_fields,id',
    'rule_set.groups.*.criteria.*.operator' => 'required|in:equals,exists,boolean,>,<,>=,<=,in,not_in',
    'rule_set.groups.*.criteria.*.reference_value' => 'required_if:operator,equals,>,<,>=,<=',
    // Backward compatibility for single group
    'rule_set.group.group_operator' => 'sometimes|in:AND,OR',
    'rule_set.group.criteria.*.reference_field_id' => 'sometimes|exists:custom_fields,id',
    'rule_set.group.criteria.*.operator' => 'sometimes|in:equals,exists,boolean,>,<,>=,<=,in,not_in',
]);

if ($validator->fails()) {
    return response()->json(['errors' => $validator->errors()], 422);
}
```

---

## Conclusion

This implementation provides a flexible, maintainable solution for custom field visibility rules. The system supports:

1. **Single Group Logic**: Simple AND/OR combinations within a single group (original implementation)
2. **Multiple Groups**: Advanced logic with multiple groups combined using AND/OR operators (enhanced feature)

The multi-level grouping approach (groups → criteria) provides powerful flexibility:
- **Within a group**: Criteria are combined using the group's `group_operator` (AND/OR)
- **Between groups**: Groups are combined using the rule set's `groups_operator` (AND/OR)

This architecture supports complex business logic while remaining intuitive and maintainable. The system is backward compatible - existing single-group rules continue to work, and multiple groups can be added as needed.

### Key Benefits

- ✅ **Flexible**: Supports AND/OR logic, multiple operators
- ✅ **Maintainable**: Rules stored in database, no code changes needed
- ✅ **Performant**: Efficient evaluation, minimal impact on forms
- ✅ **User-Friendly**: Real-time updates, smooth transitions
- ✅ **Extensible**: Easy to add new operators or criteria types

### Next Steps

1. Review this document with the team
2. Get approval for implementation approach
3. Create detailed tickets for each phase
4. Begin Phase 1 implementation
5. Regular check-ins and demos

---

## Appendix

### A. Operator Reference

| Operator | Description | Example | Field Types |
|----------|-------------|---------|-------------|
| `equals` | Exact match | `field_48 = "Yes"` | All |
| `exists` | Value is not empty | `field_48 exists` | All |
| `boolean` | Value is truthy | `field_48 is true` | All |
| `>` | Greater than | `field_49 > 5` | Number, Date |
| `<` | Less than | `field_49 < 10` | Number, Date |
| `>=` | Greater than or equal | `field_49 >= 5` | Number, Date |
| `<=` | Less than or equal | `field_49 <= 10` | Number, Date |
| `in` | Value in list | `field_48 in ["Yes", "Maybe"]` | All |
| `not_in` | Value not in list | `field_48 not in ["No"]` | All |

### B. Example Rule Configurations

See "Data Examples" section in Database Schema for SQL examples.

### C. Glossary

- **Controlling Field**: A field whose value determines visibility of other fields
- **Dependent Field**: A field whose visibility is controlled by other fields
- **Rule Set**: Collection of rules for a single field
- **Rule Group**: Collection of criteria with an operator (AND/OR)
- **Criterion**: Single condition (field, operator, value)

---

**Document Version**: 1.0    
**Status**: Draft for Review

