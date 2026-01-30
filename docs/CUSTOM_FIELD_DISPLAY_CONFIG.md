# Custom Field Default Display (Display Config)

Custom fields can define a **display config** so that, when enabled, the stored value is aggregated and a single display value is shown instead of the full data (e.g. for repeatable fields).

## When to use

- **Repeatable fields**: Instead of showing every block (Item 1, Item 2, …), you can show one aggregated value, e.g. total price, first name, or a comma-separated list of one schema key.

## Config shape

Stored in `custom_fields.display_config` (JSON). All keys are optional except when `useDefaultDisplay` is true you should set `fieldKey` and optionally `aggregateBy`.

| Key | Type | Description |
|-----|------|-------------|
| `useDefaultDisplay` | boolean | When `true`, value is aggregated by `fieldKey` and that result is shown. |
| `fieldKey` | string | Schema key to aggregate (e.g. `"price"`, `"name"`). Must match a key in the repeatable schema. |
| `aggregateBy` | string | How to combine values: `first`, `last`, `concat`, `list`, `sum`, `sum_currency`, `count`. Default: like `concat` (join with separator). |
| `separator` | string | Used for `concat` / `list` (default: `", "`). |
| `format` | string | Optional template. Use `{value}` as placeholder, e.g. `"Total: {value}"`. |

## Aggregate modes

- **first** – Value from the first item only.
- **last** – Value from the last item only.
- **concat** / **list** – All values joined with `separator`.
- **sum** – Numeric sum of the selected key across items (non-numeric treated as 0).
- **sum_currency** – Parse each value as currency (e.g. `USD|1200`, number, or `{ amount, currency }`), sum the numeric amounts, and display as formatted currency (uses first item’s currency or app default). Does not convert between currencies; all amounts are summed as numbers.
- **count** – Number of items (ignores actual value; useful with any `fieldKey`).

## Example

Repeatable field with schema: `[{ "key": "name", "type": "text", "label": "Name" }, { "key": "price", "type": "currency", "label": "Price" }]`.

- Show total price:  
  `{ "useDefaultDisplay": true, "fieldKey": "price", "aggregateBy": "sum", "format": "Total: {value}" }`
- Show first name only:  
  `{ "useDefaultDisplay": true, "fieldKey": "name", "aggregateBy": "first" }`
- Show all names:  
  `{ "useDefaultDisplay": true, "fieldKey": "name", "aggregateBy": "concat", "separator": ", " }`

## Backend

- **Migration**: `display_config` column (JSON, nullable) on `custom_fields`.
- **Model**: `CustomField` casts `display_config` to array.
- **API**: Create/update custom field requests can send `display_config`; it is persisted and returned with the field.

## Frontend

- **Types**: `DisplayConfig` in `@/Types`; `Field` and `CustomField` include `display_config`.
- **Rendering**: In `CustomFieldDisplay`, for type `repeatable`, if `display_config.useDefaultDisplay` and `display_config.fieldKey` are set, the value is aggregated and the result is rendered (with optional `format`). Otherwise the full list is shown as before.
