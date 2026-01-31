# Implementation Plan: Repeatable “Cars” Custom Field (Number of Cars)

## 1. Overview

**Goal:** Solve the “number of cars” use case by introducing a **repeatable custom field** that:

- Accepts an **array of objects** (e.g. one object per car).
- Is **rendered N times** based on a **linked field** (e.g. “Number of cars”, type `number`) whose value = N.
- Stores the collected values in a **single** `custom_fields_data` entry as a JSON array of objects, similar to multiselect storing an array of values.

**Pattern to follow:** Multi-select custom field — single `field_{id}` key, value is an array; form renders multiple inputs (checkboxes), backend JSON-encodes the array for storage.

---

## 2. Concepts

| Concept | Description |
|--------|-------------|
| **Linked field** | Another custom field (typically `number`) in the same group/category. Its value **N** dictates how many repeated blocks to show. |
| **Repeatable field** | New custom field type (e.g. `repeatable`). Rendered N times; each block collects one **object**; all N objects stored as `[obj1, obj2, ...]` in `field_{id}`. |
| **Item schema** | Definition of each object’s keys (e.g. `make`, `model`, `year`), their types (`text`, `number`, `date`, etc.), and labels. Stored in the repeatable field’s config (e.g. `values` JSON or new column). |

---

## 3. Backend Changes

### 3.1 Database

- **`custom_fields` table**
  - Add **`linked_field_id`** (nullable, FK → `custom_fields.id`): used only when `type = 'repeatable'`. References the field that provides the count N.
  - **`values`** column (existing): store **item schema** as JSON when `type = 'repeatable'`, e.g.:
    ```json
    [
      { "key": "make", "type": "text", "label": "Make" },
      { "key": "model", "type": "text", "label": "Model" },
      { "key": "year", "type": "number", "label": "Year" }
    ]
    ```
  - Create a migration to add `linked_field_id`. Ensure FK/lookup only when `type = 'repeatable'`.

- **`custom_fields_data`**
  - No schema change. Store repeatable value as a **string** (JSON): `value = json_encode([{...}, {...}, ...])`, same as multiselect arrays. Existing `value` column (e.g. `varchar(10000)`) holds the JSON.

### 3.2 Custom field create/update

- **CustomFieldController** (`create`, `store`, `edit`, `update`):
  - Add **`repeatable`** to the allowed `types` list (e.g. where `text`, `number`, `checkbox`, etc. are defined).
  - Accept and persist:
    - `linked_field_id` (optional, required when type = `repeatable`).
    - `values` as item schema (array of `{ key, type, label }`) when type = `repeatable`.
  - Validate: for `repeatable`, `linked_field_id` must reference a field in the same `custom_field_group_id`; linked field type should be `number` (or similar) if you want to enforce that.

- **StoreCustomField / UpdateCustomField requests**:
  - Add validation rules for `linked_field_id` and `values` when `type === 'repeatable'`.
  - Ensure `values` is valid JSON array of schema objects.

### 3.3 CustomFieldsTrait / Storage

- **`updateCustomFieldData`**:
  - For `type == 'repeatable'`: ensure value is **always JSON-encoded** when it’s an array of objects. Current logic already JSON-encodes non-checkbox arrays; confirm that repeatable is not treated as checkbox (it won’t be) so it goes through `json_encode`. No extra branch strictly required, but an explicit `if ($fieldType === 'repeatable')` check can make intent clear and guard against future changes.
  - Ensure the stored `value` is a **string** (the JSON). The rest of the update/insert logic already casts to string.

- **`getCustomFieldsData`**:
  - No change. It returns raw `value` from DB. Frontend will parse JSON when `type === 'repeatable'`.

### 3.4 API / serialization

- When custom fields are sent to the frontend (e.g. Inertia props, API responses):
  - Include `linked_field_id` and `values` (item schema) for `repeatable` fields.
  - Ensure `custom_fields_data.field_{id}` for repeatable fields is either:
    - already parsed as array of objects, or
    - left as JSON string so the frontend can `JSON.parse` consistently with other stored JSON (e.g. multiselect, phone).

---

## 4. Frontend Changes

### 4.1 Types

- **`CustomField`** (e.g. in `@/Types`):
  - Add `linked_field_id?: number | null` and keep `values` as `string | null` (item schema JSON for repeatable).
  - Document that for `type === 'repeatable'`, `values` holds the item schema.

### 4.2 Form rendering (create/edit)

**Locations:** `GeneralCustomFieldTab`, `CustomFieldRenderer`, and any other places that render custom field forms.

- **Field order:**
  - Linked (count) field **must** appear **before** the repeatable field. Use existing `display_order` (and `custom_field_category_id`) sorting so that the “Number of cars” field is above the “Cars” repeatable field. Document this as a config requirement.

- **Repeatable field renderer:**
  - **Watch** `custom_fields_data.field_{linked_field_id}` (e.g. via `Form.useWatch` or existing `useCustomFieldVisibility`-style form watch). Derive **N** = current value of linked field (coerced to non‑negative integer; 0 → show no blocks).
  - Render **N** blocks. Each block:
    - Represents one **object** in the array.
    - Contains one form control per item-schema entry (e.g. `make` text, `model` text, `year` number), with appropriate `Input`/`InputNumber`/`DatePicker` etc. based on `type`.
  - Form **name** for the repeatable field: **single** `Form.Item` (or `Form.List`) under `custom_fields_data.field_{repeatableId}`.
  - **Value:** array of N objects, `[{ make, model, year }, ...]`. Same pattern as multiselect’s single `field_{id}` with array value, but arrays of objects instead of primitives.

- **Implementation options:**
  - **Option A:** Use **`Form.List`** for `custom_fields_data.field_{repeatableId}`. Dynamically add/remove list items when N changes: when N increases, append empty objects; when N decreases, slice to length N. Sync N from linked field.
  - **Option B:** Manually manage an array of N objects in state, and `form.setFieldValue('custom_fields_data.field_{id}', array)` when inputs change. Render N controlled blocks (no `Form.List`).

- **Validation:**
  - If repeatable is **required**, ensure the array has length ≥ 1 (or ≥ N when N > 0, depending on product rules). Use `Form.Item` `rules` accordingly.
  - Optional: require each object to have certain schema keys filled when “required” is used.

- **Visibility:**
  - Use existing visibility mechanism. When the repeatable field is hidden, it is not rendered; when shown, it still uses the linked field’s value to determine N.

### 4.3 Display (read-only / view)

**Location:** `CustomFieldDisplay`.

- Add a **`repeatable`** branch in the switch that formats values (similar to `multiselect`, `phone`, etc.):
  - Parse `value` as JSON if it’s a string (array of objects).
  - Render each object (e.g. “Car 1: Make X, Model Y, Year Z”; “Car 2: …”). Layout can be simple (e.g. `Descriptions`, list, or cards) so it’s clear and scannable.
  - Handle empty array → show `--` or “None”.
  - Ensure `calculateSpan` (or equivalent) treats repeatable as a wide field when there are multiple items, similar to multiselect.

### 4.4 Inline editing (EditableField)

**Location:** `EditableField`.

- **`fieldType === 'repeatable'`** (or when `value` is array of objects and type is repeatable):
  - **Display mode:** Same as `CustomFieldDisplay` — list each object (e.g. “Car 1: …”, “Car 2: …”).
  - **Edit mode:** Two options:
    - **Option A (simpler):** Switch to a small **modal** that contains the same repeatable form (N blocks from linked field, `Form.List` or manual array). On save, call `onSave` with the array of objects; parent updates `custom_fields_data.field_{id}` and refetches/shared state updates.
    - **Option B:** Inline expandable list: show N blocks; each block editable in place (e.g. inline inputs). Less generic, more UI work.
  - Reuse the same **value shape** as forms: array of objects. `handleSave` sends that array to `onSave`; backend stores JSON.

- **`EditableField`** already supports `multiselect` and arrays. Extend support for “array of objects” for repeatable:
  - Initialize `inputValue` from `value` (parsed if string).
  - Compare and persist using JSON stringify when diffing/saving, similar to multiselect.

### 4.5 Custom field admin UI (create/edit modal)

**Locations:** Blade views (and any JS) for create/edit custom field modal.

- **Type dropdown:** Add **“Repeatable (array of objects)”** (or similar) mapping to `repeatable`.
- **When type = `repeatable`:**
  - **Linked field:** Dropdown of other custom fields in the same group (and optionally same category). Prefer `number` type. Store `linked_field_id`.
  - **Item schema:** Repeater UI (similar to existing “values” repeater for select/radio/checkbox):
    - Rows: `key`, `type` (text / number / date / etc.), `label`.
    - Persist as JSON in `values` for the repeatable field.
- **Validation:** Linked field required when type = `repeatable`; at least one schema row.

---

## 5. Validation & Edge Cases

- **N = 0:** Show zero blocks; store `[]`.
- **N decreases:** Truncate array to length N when syncing (form or display). Avoid orphan data.
- **N increases:** New blocks initialized with empty objects `{}`; user fills them.
- **Linked field missing or invalid:** Fall back to N = 0 or hide repeatable field; avoid runtime errors.
- **Required repeatable:** Define clearly: “at least one object” vs “exactly N objects when N > 0”. Implement accordingly in form rules and backend validation.

---

## 6. “Number of Cars” Setup

1. **Create “Number of cars”** custom field:
   - Type: `number`.
   - Same group/category as the repeatable field.
   - `display_order` **smaller** than the cars field so it appears first.

2. **Create “Cars”** custom field:
   - Type: `repeatable`.
   - **Linked field:** “Number of cars”.
   - **Item schema:** e.g. `make` (text), `model` (text), `year` (number). Extend as needed.

3. **Usage:** User sets “Number of cars” = 3 → form shows 3 “Car” blocks; each block has Make, Model, Year. Values stored as `field_{carsId}` = `[{...}, {...}, {...}]`.

---

## 7. Files to Touch (Checklist)

| Layer | Files |
|-------|--------|
| **DB** | New migration: `add_linked_field_id_to_custom_fields_table` (or similar). |
| **Backend** | `CustomField` model (fillable, casts, relation to `linkedField`), `CustomFieldController` (create/edit, types), `StoreCustomField` / `UpdateCustomField` (validation), `CustomFieldsTrait::updateCustomFieldData` (repeatable handling). |
| **Frontend – forms** | `GeneralCustomFieldTab`, `CustomFieldRenderer`: add `renderRepeatableField`, wire into `renderField` switch; ensure form value = `field_{id}` array of objects. |
| **Frontend – display** | `CustomFieldDisplay`: `repeatable` branch in `formatFieldValue` / `calculateSpan`; ensure visibility filtering already supports repeatable. |
| **Frontend – inline edit** | `EditableField`: handle `repeatable` / array-of-objects (display + edit, e.g. modal form or inline). |
| **Frontend – types** | `CustomField` type: `linked_field_id`, document `values` as item schema for repeatable. |
| **Admin UI** | Create/edit custom field modal: new type, linked field dropdown, item schema repeater; validation. |
| **Import/export** | If deals/leads import or export use custom fields, add handling for `repeatable` (e.g. `ImportDealJob`, export logic) so array-of-objects is read/written correctly. |

---

## 8. Testing

- Create “Number of cars” + “Cars” repeatable; set N = 0, 1, 3; submit form → DB has correct JSON array.
- Edit entity: change N down → array truncated; change N up → new empty objects; save → persistence correct.
- Display view: multiple cars render correctly; empty array shows `--`.
- Inline edit: save updates `custom_fields_data` and UI reflects it.
- Visibility: repeatable hidden when rules say so; when shown, N still derived from linked field.
- Validation: required repeatable rejects empty array when applicable.

---

## 9. Summary

Introduce a **repeatable** custom field type that uses a **linked (number) field** to determine how many blocks to render, stores an **array of objects** in a single `custom_fields_data` entry (like multiselect), and follows existing patterns for form names, visibility, and display. The “number of cars” case is implemented by a “Number of cars” number field plus a “Cars” repeatable field with an item schema (e.g. make, model, year) and linked to the number field.


