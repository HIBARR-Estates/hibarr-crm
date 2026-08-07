# Permission Changes — Brief

## What changed

Four features were gated behind a single overloaded permission, `edit_product`/`edit_products` (originally "Sales Manager" property/product editing). Any role with that permission got Partner Network admin, Offers admin, Property admin, *and* publish-request approval as a bundle — you couldn't grant one without the others.

This branch splits them into five independent, named permissions (`app/Support/PermissionGates.php`), each toggleable separately in Role Permissions / user overrides:

| New permission | Constant | Controls |
|---|---|---|
| **Manage Partner Network** | `manage_partner_network` | MLM admin: levels, commissions, hierarchy, cycles (`MlmAdminController`, `MlmAdminApiController`) |
| **Manage Offers** | `manage_offers` | Developer/project offers CRUD (`OfferController`) — except viewing/removing offers already attached to a deal, which stays open |
| **Manage Properties** | `manage_properties` | Privileged property inventory access — view/edit any listing, not just your own (`PropertyController`, `PropertyPolicy`, `PropertyAvailabilityRequestPolicy`, `PropertyAuthorizationService`) |
| **Manage Property Publish Requests** | `manage_property_publish_requests` | Approve/reject property publish requests only (`PropertyPublishRequestController`) |
| **Manage Property Configuration** | `manage_property_configuration` | Property module settings/config screens (`PropertyConfigController`) |

**Important:** `manage_properties` does **not** imply `manage_property_publish_requests` anymore. Under the old model, one permission did both; now a property admin who should also approve publish requests needs both permissions granted explicitly.

Each is an `ALL_NONE` permission (all-or-nothing scope, no partial/own-only tier), matching how `edit_product` worked before.

## Migration behavior (`2026_08_05_000001_...` / `...000002_...`)

- Creates 3 new modules (`partner_network`, `offers`, `properties`) and the 5 permissions above.
- Auto-grants all 5 to every company's `admin` role and all admin users — admins keep full access, no action needed.
- Back-fills the new permissions for any user/role that previously had `edit_product`/`edit_products = all`, so existing Sales Managers don't lose access on deploy.
- Second migration renames a since-corrected `manage_property_admin` → `manage_properties` (cleanup of an in-flight rename before this first shipped).
- `down()` on both migrations fully reverses (deletes permissions, modules, grants).

## What you need to grant someone, by task

| They need to... | Grant |
|---|---|
| Manage MLM/partner network settings | `manage_partner_network` |
| Create/edit developer offers | `manage_offers` |
| View/edit any property (not just their own) | `manage_properties` |
| Approve or reject property publish requests | `manage_property_publish_requests` |
| Edit property module configuration/settings | `manage_property_configuration` |
| Do everything a pre-migration Sales Manager could | all of `manage_properties` + `manage_property_publish_requests` (+ `manage_property_configuration` if they also configured the module) |

Grants are managed the normal way — Role Permissions page or per-user override — no code change needed to assign them.

## Not yet done

- Frontend (`Sidebar.tsx`, `usePropertyPermissions.ts`, `PropertyCategoryForm.tsx`, `Properties/Index.tsx`, `PublishRequests/Index.tsx`, `permissionUtils.tsx`) has been updated to check the new permission names — worth a smoke test of the Properties and Publish Requests pages with a non-admin, partially-permissioned user before merging.
- Lang keys added for `eng`, `de`, `ru`, `tr` — verify translations aren't placeholder/machine-only if this ships to those locales soon.
