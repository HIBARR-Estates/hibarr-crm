# Custom Field Visibility - Testing Guide

## Overview
This guide will help you test the custom field visibility feature that allows fields to show/hide based on values in other fields.

## Prerequisites
1. ✅ Migrations have been run successfully
2. ✅ You have access to the admin panel
3. ✅ You have at least 2 custom fields created (one to control, one to be controlled)

---

## Step 1: Test Backend API Endpoints

### 1.1 Get Rule Set for a Field

**Endpoint**: `GET /custom-fields/{id}/rule-set`

**Test using browser or Postman:**
```
http://your-domain.com/custom-fields/1/rule-set
```

**Expected Response** (if no rule set exists):
```json
null
```

**Expected Response** (if rule set exists):
```json
{
    "id": 1,
    "field_id": 1,
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
                "reference_field_id": 2,
                "operator": "equals",
                "reference_value": "Yes",
                "negate": false,
                "reference_field": {
                    "id": 2,
                    "label": "Have you ever been to North Cyprus?",
                    "type": "radio"
                }
            }
        ]
    }
}
```

### 1.2 Create/Update Rule Set

**Endpoint**: `POST /custom-fields/{id}/rule-set`

**Test using browser console or Postman:**

```javascript
// Example: Make field 2 visible only when field 1 equals "Yes"
fetch('/custom-fields/2/rule-set', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
    },
    body: JSON.stringify({
        rule_set: {
            default_visibility: false,
            enabled: true,
            group: {
                group_operator: "AND",
                criteria: [
                    {
                        reference_field_id: 1,
                        operator: "equals",
                        reference_value: "Yes",
                        negate: false
                    }
                ]
            }
        }
    })
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('Error:', error));
```

### 1.3 Evaluate Visibility

**Endpoint**: `POST /custom-fields/evaluate-visibility`

**Test:**
```javascript
fetch('/custom-fields/evaluate-visibility', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
    },
    body: JSON.stringify({
        field_id: 2,
        current_values: {
            field_1: "Yes",
            field_2: ""
        }
    })
})
.then(response => response.json())
.then(data => console.log('Visibility:', data.visible)) // Should be true
.catch(error => console.error('Error:', error));
```

---

## Step 2: Test Frontend Visibility

### 2.1 Create Test Fields

1. Go to **Settings → Custom Fields**
2. Create two fields:
   - **Field A** (ID: 1): Type "radio", Label "Have you ever been to North Cyprus?", Values: `["Yes", "No"]`
   - **Field B** (ID: 2): Type "text", Label "How many times?"

### 2.2 Create Visibility Rule (Using API or Database)

**Option A: Using API (Recommended)**
Use the POST endpoint from Step 1.2 to create a rule that makes Field B visible only when Field A = "Yes"

**Option B: Using Database Directly**
```sql
-- Create rule set for field 2
INSERT INTO show_rule_sets (field_id, default_visibility, enabled, created_at, updated_at) 
VALUES (2, FALSE, TRUE, NOW(), NOW());

-- Create rule group
INSERT INTO show_rule_groups (rule_set_id, group_operator, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 'AND', NOW(), NOW());

-- Create criterion
INSERT INTO show_criteria (group_id, reference_field_id, operator, reference_value, negate, created_at, updated_at)
VALUES (LAST_INSERT_ID(), 1, 'equals', 'Yes', FALSE, NOW(), NOW());
```

### 2.3 Test in Form

1. Navigate to a form that uses custom fields (e.g., Create Lead, Create Deal)
2. You should see Field A (the controlling field)
3. Field B should be **hidden** initially
4. Select "Yes" in Field A
5. Field B should **appear** immediately
6. Change Field A to "No"
7. Field B should **disappear** immediately

---

## Step 3: Test Different Operators

### 3.1 Test "equals" Operator
- Create rule: Field B visible when Field A equals "Yes"
- Test: Field A = "Yes" → Field B visible ✓
- Test: Field A = "No" → Field B hidden ✓

### 3.2 Test "exists" Operator
- Create rule: Field B visible when Field A exists (has any value)
- Test: Field A = "" → Field B hidden ✓
- Test: Field A = "Any value" → Field B visible ✓

### 3.3 Test ">" Operator (for number fields)
- Create rule: Field B visible when Field A > 5
- Test: Field A = 3 → Field B hidden ✓
- Test: Field A = 7 → Field B visible ✓

### 3.4 Test "in" Operator
- Create rule: Field B visible when Field A in ["Yes", "Maybe"]
- Test: Field A = "Yes" → Field B visible ✓
- Test: Field A = "No" → Field B hidden ✓

---

## Step 4: Test AND/OR Logic

### 4.1 Test AND Logic
- Create rule: Field C visible when Field A = "Yes" **AND** Field B = "Yes"
- Test combinations:
  - A=Yes, B=Yes → C visible ✓
  - A=Yes, B=No → C hidden ✓
  - A=No, B=Yes → C hidden ✓
  - A=No, B=No → C hidden ✓

### 4.2 Test OR Logic
- Create rule: Field C visible when Field A = "Yes" **OR** Field B = "Yes"
- Test combinations:
  - A=Yes, B=Yes → C visible ✓
  - A=Yes, B=No → C visible ✓
  - A=No, B=Yes → C visible ✓
  - A=No, B=No → C hidden ✓

---

## Step 5: Verify Data Persistence

1. Fill out a form with conditional fields
2. Make a field visible and fill it with data
3. Make the field hidden by changing the controlling field
4. Submit the form
5. Reload the form
6. Verify that:
   - Hidden field values are preserved
   - Fields remain hidden if conditions are still false
   - Fields appear if conditions become true

---

## Step 6: Test Edge Cases

### 6.1 Circular Dependencies
- Try to create: Field A depends on Field B, Field B depends on Field A
- Expected: Should work, but may cause infinite loops (this is a known limitation)

### 6.2 Missing Reference Field
- Delete a field that is referenced by a rule
- Expected: Rule should still work, but may show warnings

### 6.3 Empty Values
- Test with null/empty values
- Expected: "exists" operator should handle this correctly

---

## Troubleshooting

### Fields not showing/hiding
1. Check browser console for JavaScript errors
2. Verify rule set is enabled: `enabled = true`
3. Verify rule set exists: Check `show_rule_sets` table
4. Verify criteria exist: Check `show_criteria` table
5. Check that custom fields are loaded with rule sets in the API response

### API endpoints not working
1. Verify routes are registered: Check `routes/web-settings.php`
2. Verify you're authenticated and have permissions
3. Check Laravel logs: `storage/logs/laravel.log`

### Frontend not updating
1. Verify `CustomFieldRenderer` is using `useCustomFieldVisibility` hook
2. Check that fields include `show_rule_set` in the data
3. Verify form is using Ant Design's `Form.useWatch`

---

## Quick Test Script

Run this in your browser console on a page with custom fields:

```javascript
// Check if fields have rule sets loaded
console.log('Custom Fields:', window.customFields || 'Not found');

// Manually test visibility evaluation
const testField = {
    id: 2,
    show_rule_set: {
        enabled: true,
        default_visibility: false,
        group: {
            group_operator: 'AND',
            criteria: [{
                reference_field_id: 1,
                operator: 'equals',
                reference_value: 'Yes',
                negate: false
            }]
        }
    }
};

const allFieldValues = {
    field_1: 'Yes',
    field_2: ''
};

// This should work if the utility is imported
// import { evaluateFieldVisibility } from '@/lib/customFieldVisibility';
// console.log('Should be visible:', evaluateFieldVisibility(testField, allFieldValues));
```

---

## Next Steps

Once basic testing is complete:
1. Create the admin UI component (`CustomFieldRuleBuilder`) for easier rule management
2. Add validation to prevent circular dependencies
3. Add performance monitoring for forms with many fields
4. Add user documentation

---

**Note**: The admin UI component for creating rules visually is not yet implemented. For now, use the API endpoints or direct database queries to create rules.


