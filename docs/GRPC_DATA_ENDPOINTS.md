# CRM Model Structure - Design Document

> **35 new models** to integrate CRM functionality into the existing backend.
> All models follow existing codebase conventions: Sequelize + PostgreSQL + TypeScript + Registry pattern.

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [Excluded Tables](#2-excluded-tables)
3. [Existing Models Needing Updates](#3-existing-models-needing-updates)
4. [New Enums](#4-new-enums)
5. [Naming Normalizations](#5-naming-normalizations)
6. [Directory Structure](#6-directory-structure)
7. [Model Specifications by Domain](#7-model-specifications-by-domain)
    - [7.1 Reference Tables](#71-reference-tables)
    - [7.2 Lead Management](#72-lead-management)
    - [7.3 Deal Management](#73-deal-management)
    - [7.4 Meeting Domain](#74-meeting-domain)
    - [7.5 Communication Domain](#75-communication-domain)
    - [7.6 Task Management](#76-task-management)
    - [7.7 Property / Real Estate](#77-property--real-estate)
    - [7.8 Settings](#78-settings)
    - [7.9 Custom Field Extensions](#79-custom-field-extensions)
    - [7.10 Other](#710-other)
8. [Cross-Domain Relationship Map](#8-cross-domain-relationship-map)
9. [FK Reference Matrix](#9-fk-reference-matrix)

---

## 1. Quick Reference

| #   | Model                                               | Table                          | Directory        | Type        | Paranoid |
| --- | --------------------------------------------------- | ------------------------------ | ---------------- | ----------- | -------- |
| 1   | Country                                             | `countries`                    | `reference/`     | Lookup      | No       |
| 2   | Currency                                            | `currencies`                   | `reference/`     | Domain      | Yes      |
| 3   | Lead                                                | `leads`                        | `lead/`          | Domain      | Yes      |
| 4   | LeadAgent                                           | `lead_agents`                  | `lead/`          | Domain      | Yes      |
| 5   | LeadCategory                                        | `lead_categories`              | `lead/`          | Domain      | Yes      |
| 6   | LeadMarketing                                       | `lead_marketing_data`          | `lead/`          | Domain      | Yes      |
| 7   | LeadSource                                          | `lead_sources`                 | `lead/`          | Domain      | Yes      |
| 8   | LeadStatus                                          | `lead_statuses`                | `lead/`          | Domain      | Yes      |
| 9   | Deal                                                | `deals`                        | `deal/`          | Domain      | Yes      |
| 10  | DealPipeline                                        | `deal_pipelines`               | `deal/`          | Domain      | Yes      |
| 11  | PipelineStage                                       | `pipeline_stages`              | `deal/`          | Domain      | Yes      |
| 12  | DealFile                                            | `deal_files`                   | `deal/`          | Domain      | Yes      |
| 13  | DealHistory                                         | `deal_histories`               | `deal/`          | Audit       | No       |
| 14  | DealNote                                            | `deal_notes`                   | `deal/`          | Domain      | Yes      |
| 15  | DealPackage                                         | `deal_packages`                | `deal/`          | Join        | No       |
| 16  | DealParticipant                                     | `deal_participants`            | `deal/`          | Join        | No       |
| 17  | DealWatcher                                         | `deal_watchers`                | `deal/`          | Join        | No       |
| 18  | MeetingType                                         | `meeting_types`                | `meeting/`       | Domain      | Yes      |
| 19  | Meeting                                             | `meetings`                     | `meeting/`       | Domain      | Yes      |
| 20  | MeetingSummary                                      | `meeting_summaries`            | `meeting/`       | Domain      | Yes      |
| 21  | CommunicationActivity                               | `communication_activities`     | `communication/` | Domain      | Yes      |
| 22  | CommunicationActivityFile                           | `communication_activity_files` | `communication/` | Domain      | No       |
| 23  | TaskboardColumn                                     | `taskboard_columns`            | `task/`          | Domain      | Yes      |
| 24  | TaskCategory                                        | `task_categories`              | `task/`          | Domain      | Yes      |
| 25  | Task                                                | `tasks`                        | `task/`          | Domain      | Yes      |
| 26  | TaskHistory                                         | `task_histories`               | `task/`          | Audit       | No       |
| 27  | TaskNote                                            | `task_notes`                   | `task/`          | Domain      | Yes      |
| 28  | TaskUser                                            | `task_users`                   | `task/`          | Join        | No       |
| 29  | Taskable                                            | `taskables`                    | `task/`          | Polymorphic | No       |
| 30  | Property                                            | `properties`                   | `property/`      | Domain      | Yes      |
| 31  | PropertyAsset(Done with Developer, begin from here) | `property_assets`              | `property/`      | Domain      | Yes      |
| 32  | Package                                             | `packages`                     | `property/`      | Domain      | Yes      |
| 33  | ApiToken                                            | `api_tokens`                   | `settings/`      | Domain      | Yes      |
| 34  | SmtpSetting                                         | `smtp_settings`                | `settings/`      | Config      | No       |
| 35  | LanguageSetting                                     | `language_settings`            | `settings/`      | Config      | No       |
| 36  | CustomFieldCondition                                | `custom_field_conditions`      | `custom-field/`  | Domain      | No       |
| 37  | MetaConversionTrigger                               | `meta_conversion_triggers`     | (root)           | Domain      | No       |
| 38  | UserReminderPreference                              | `user_reminder_preferences`    | (root)           | Domain      | No       |

---

## 2. Excluded Tables

| CRM Table                   | Reason                                                |
| --------------------------- | ----------------------------------------------------- |
| `companies`                 | No multi-tenancy pattern needed                       |
| `company_addresses`         | Depends on `companies`                                |
| `users` (CRM)               | Mapped to existing **Employee** model                 |
| `forms`                     | Already exists as **Form** model                      |
| `form_submissions`          | Already exists as **FormSubmission** model            |
| `custom_field_visibilities` | Covered by existing **CustomFieldShowRuleSet** system |
| `field_types`               | No column specification in CRM document; hold         |
| `custom_field_groups`       | Already exists as **CustomFieldGroup**                |
| `custom_field_categories`   | Already exists as **CustomFieldCategory**             |
| `custom_fields`             | Already exists as **CustomField**                     |
| `custom_fields_data`        | Already exists as **CustomFieldData**                 |
| `show_rule_sets`            | Already exists as **CustomFieldShowRuleSet**          |
| `show_rule_groups`          | Already exists as **CustomFieldShowRuleGroup**        |
| `show_criteria`             | Already exists as **CustomFieldShowCriteria**         |

---

## 3. Existing Models Needing Association Updates

### Employee (`src/database/models/core/employee.model.ts`)

Add `hasMany` associations for all CRM entities that reference Employee via `addedById`, `updatedById`, `leadOwnerId`, `agentId`, `employeeId`, `createdById`, `responsibleAgentId`.

### User (`src/database/models/core/user.model.ts`)

Add `hasMany` association: `User.hasMany(Lead, { as: 'leads', foreignKey: 'clientId' })`

### CustomField (`src/database/models/core/custom-field/custom-field.model.ts`)

Add `hasMany` association: `CustomField.hasMany(CustomFieldCondition, { as: 'conditions', foreignKey: 'customFieldId', onDelete: 'CASCADE' })`

---

## 4. New Enums

Location: `src/infrastructure/enums/`

```typescript
// lead.enum.ts
export enum LeadType {
    AGENT = "agent",
    CUSTOMER = "customer",
}

export enum Salutation {
    MR = "mr",
    MRS = "mrs",
    MISS = "miss",
    DR = "dr",
    SIR = "sir",
    MADAM = "madam",
}

// communication.enum.ts
export enum ChannelType {
    EMAIL = "email",
    WHATSAPP = "whatsapp",
    INSTAGRAM = "instagram",
    TELEGRAM = "telegram",
}

// task.enum.ts
export enum TaskPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
}

export enum TaskStatus {
    TO_DO = "to_do",
    IN_PROGRESS = "in_progress",
    IN_REVIEW = "in_review",
    ON_HOLD = "on_hold",
    DONE = "done",
}

export enum RepeatType {
    DAY = "day",
    WEEK = "week",
    MONTH = "month",
    YEAR = "year",
}

// settings.enum.ts
export enum MailEncryption {
    SSL = "ssl",
    TLS = "tls",
    STARTTLS = "starttls",
}

export enum MailConnection {
    SYNC = "sync",
    DATABASE = "database",
}

// common enums
export enum EnabledStatus {
    ENABLED = "enabled",
    DISABLED = "disabled",
}

export enum ReminderEntityType {
    MEETING = "meeting",
    TASK = "task",
    ALL = "all",
}

export enum RemindType {
    MINUTE = "minute",
    HOUR = "hour",
    DAY = "day",
}

export enum PropertyAssetType {
    IMAGE = "image",
    VIDEO = "video",
    VIDEO_URL = "video_url",
    TOUR_360_URL = "tour_360_url",
}

export enum CurrencyPosition {
    LEFT = "left",
    RIGHT = "right",
    LEFT_WITH_SPACE = "left_with_space",
    RIGHT_WITH_SPACE = "right_with_space",
}
```

Note: `Gender` enum already exists at `src/infrastructure/enums/gender.enum.ts`.

---

## 5. Naming Normalizations

| Original CRM Name | New Table Name        | Model Name     | Change                            |
| ----------------- | --------------------- | -------------- | --------------------------------- |
| `lead_category`   | `lead_categories`     | LeadCategory   | Pluralized                        |
| `lead_status`     | `lead_statuses`       | LeadStatus     | Pluralized                        |
| `lead_follow_up`  | `meetings`            | Meeting        | Renamed to reflect actual purpose |
| `deal_package`    | `deal_packages`       | DealPackage    | Pluralized                        |
| `task_category`   | `task_categories`     | TaskCategory   | Pluralized                        |
| `task_history`    | `task_histories`      | TaskHistory    | Pluralized                        |
| `meeting_summary` | `meeting_summaries`   | MeetingSummary | Pluralized                        |
| `lead_marketing`  | `lead_marketing_data` | LeadMarketing  | Clarified (holds UTM data)        |

### Column-Level Normalizations (applied across all models)

| Original                      | Normalized           | Reason                                       |
| ----------------------------- | -------------------- | -------------------------------------------- |
| `enum('yes','no')`            | `BOOLEAN`            | Type fix                                     |
| `enum('0','1')`               | `BOOLEAN`            | Type fix                                     |
| `tinyint(1)`                  | `BOOLEAN`            | Type fix                                     |
| `json`                        | `JSONB`              | PostgreSQL binary JSON                       |
| `double`                      | `DECIMAL`            | Precision fix                                |
| `added_by`                    | `addedById`          | Consistent FK naming + reference to Employee |
| `last_updated_by`             | `updatedById`        | Consistent FK naming + reference to Employee |
| `lead_owner`                  | `leadOwnerId`        | Consistent FK naming + reference to Employee |
| `user_id` (internal)          | `employeeId`         | References Employee, not CRM User            |
| `default` (reserved)          | `isDefault`          | Avoid SQL reserved word                      |
| `revoked`                     | `isRevoked`          | Boolean prefix convention                    |
| `active`                      | `isActive`           | Boolean prefix convention                    |
| `next_follow_up` ('yes'/'no') | `hasNextFollowUp`    | Boolean with semantic naming                 |
| `create_client` ('0'/'1')     | `shouldCreateClient` | Boolean with semantic naming                 |

---

## 6. Directory Structure

```
src/database/models/core/
├── reference/                                # Lookup tables
│   ├── country.model.ts                      # Country
│   └── currency.model.ts                     # Currency
│
├── lead/                                     # Lead management
│   ├── lead.model.ts                         # Lead
│   ├── lead-agent.model.ts                   # LeadAgent
│   ├── lead-category.model.ts                # LeadCategory
│   ├── lead-marketing.model.ts               # LeadMarketing
│   ├── lead-source.model.ts                  # LeadSource
│   └── lead-status.model.ts                  # LeadStatus
│
├── deal/                                     # Deal management
│   ├── deal.model.ts                         # Deal
│   ├── deal-pipeline.model.ts                # DealPipeline
│   ├── pipeline-stage.model.ts               # PipelineStage
│   ├── deal-file.model.ts                    # DealFile
│   ├── deal-history.model.ts                 # DealHistory
│   ├── deal-note.model.ts                    # DealNote
│   ├── deal-package.model.ts                 # DealPackage (join)
│   ├── deal-participant.model.ts             # DealParticipant (join)
│   └── deal-watcher.model.ts                 # DealWatcher (join)
│
├── meeting/                                  # Meetings & follow-ups
│   ├── meeting.model.ts                      # Meeting (was lead_follow_up)
│   ├── meeting-summary.model.ts              # MeetingSummary
│   └── meeting-type.model.ts                 # MeetingType
│
├── communication/                            # Communication tracking
│   ├── communication-activity.model.ts       # CommunicationActivity
│   └── communication-activity-file.model.ts  # CommunicationActivityFile
│
├── task/                                     # Task management
│   ├── task.model.ts                         # Task
│   ├── task-category.model.ts                # TaskCategory
│   ├── task-history.model.ts                 # TaskHistory
│   ├── task-note.model.ts                    # TaskNote
│   ├── task-user.model.ts                    # TaskUser (join)
│   ├── taskable.model.ts                     # Taskable (polymorphic)
│   └── taskboard-column.model.ts             # TaskboardColumn
│
├── property/                                 # Real estate
│   ├── property.model.ts                     # Property
│   ├── property-asset.model.ts               # PropertyAsset
│   └── package.model.ts                      # Package
│
├── settings/                                 # System settings
│   ├── api-token.model.ts                    # ApiToken
│   ├── smtp-setting.model.ts                 # SmtpSetting
│   └── language-setting.model.ts             # LanguageSetting
│
├── custom-field/                             # EXISTING - extend with:
│   └── custom-field-condition.model.ts       # CustomFieldCondition (NEW)
│
├── meta-conversion-trigger.model.ts          # MetaConversionTrigger
└── user-reminder-preference.model.ts         # UserReminderPreference
```

---

## 7. Model Specifications by Domain

### Convention Reference

- **PK**: `id: INTEGER, primaryKey, autoIncrement`
- **Timestamps**: `createdAt`, `updatedAt` (auto-managed by Sequelize)
- **Soft delete**: `deletedAt` when `paranoid: true`
- **FK naming**: `<relatedModel>Id` (camelCase)
- **Registry**: every model calls `registry.register({ name, model, init, associate })`
- **Interface**: every model implements `I<ModelName>Attribute extends IBaseAttribute`

---

### 7.1 Reference Tables

#### Country

| Property       | Value                        |
| -------------- | ---------------------------- |
| **Model**      | `Country`                    |
| **Table**      | `countries`                  |
| **File**       | `reference/country.model.ts` |
| **Interface**  | `ICountryAttribute`          |
| **Paranoid**   | No                           |
| **Timestamps** | No                           |

| Field     | Type       | Null | Default | Notes  |
| --------- | ---------- | ---- | ------- | ------ |
| id        | INTEGER    | No   | Auto    | PK     |
| iso       | CHAR(2)    | No   | -       | Unique |
| name      | STRING(80) | No   | -       |        |
| niceName  | STRING(80) | No   | -       |        |
| iso3      | CHAR(3)    | Yes  | -       |        |
| numCode   | SMALLINT   | Yes  | -       |        |
| phoneCode | INTEGER    | Yes  | -       |        |

**Relationships**: None (referenced by Lead.country as string value for now)
**Indexes**: Unique on `iso`

---

#### Currency

| Property      | Value                         |
| ------------- | ----------------------------- |
| **Model**     | `Currency`                    |
| **Table**     | `currencies`                  |
| **File**      | `reference/currency.model.ts` |
| **Interface** | `ICurrencyAttribute`          |
| **Paranoid**  | Yes                           |

| Field             | Type                   | Null | Default | Notes                  |
| ----------------- | ---------------------- | ---- | ------- | ---------------------- |
| id                | INTEGER                | No   | Auto    | PK                     |
| name              | STRING                 | No   | -       |                        |
| symbol            | STRING                 | No   | -       |                        |
| code              | STRING                 | No   | -       | Unique                 |
| exchangeRate      | DECIMAL(10,4)          | Yes  | -       |                        |
| isCryptocurrency  | BOOLEAN                | No   | false   | Was `enum('yes','no')` |
| usdPrice          | DECIMAL(10,4)          | Yes  | -       |                        |
| currencyPosition  | ENUM(CurrencyPosition) | No   | 'left'  |                        |
| noOfDecimal       | INTEGER                | No   | 2       |                        |
| thousandSeparator | STRING                 | No   | ','     |                        |
| decimalSeparator  | STRING                 | No   | '.'     |                        |

**Indexes**: Unique on `code`

---

### 7.2 Lead Management

#### Lead

| Property      | Value                |
| ------------- | -------------------- |
| **Model**     | `Lead`               |
| **Table**     | `leads`              |
| **File**      | `lead/lead.model.ts` |
| **Interface** | `ILeadAttribute`     |
| **Paranoid**  | Yes                  |

| Field           | Type             | Null | Default | Notes                 |
| --------------- | ---------------- | ---- | ------- | --------------------- |
| id              | INTEGER          | No   | Auto    | PK                    |
| type            | ENUM(LeadType)   | No   | -       | `agent` or `customer` |
| sourceId        | INTEGER          | Yes  | -       | FK → LeadSource       |
| statusId        | INTEGER          | Yes  | -       | FK → LeadStatus       |
| columnPriority  | INTEGER          | Yes  | 0       |                       |
| companyName     | STRING           | Yes  | -       |                       |
| website         | STRING           | Yes  | -       |                       |
| address         | TEXT             | Yes  | -       |                       |
| salutation      | ENUM(Salutation) | Yes  | -       |                       |
| gender          | ENUM(Gender)     | Yes  | -       | Reuse existing enum   |
| clientName      | STRING           | Yes  | -       |                       |
| clientEmail     | STRING           | Yes  | -       |                       |
| clientWhatsapp  | STRING           | Yes  | -       |                       |
| clientInstagram | STRING           | Yes  | -       |                       |
| clientTelegram  | STRING           | Yes  | -       |                       |
| telegramChatId  | STRING           | Yes  | -       |                       |
| mobile          | STRING           | Yes  | -       |                       |
| cell            | STRING           | Yes  | -       |                       |
| office          | STRING           | Yes  | -       |                       |
| city            | STRING           | Yes  | -       |                       |
| state           | STRING           | Yes  | -       |                       |
| country         | STRING           | Yes  | -       |                       |
| postalCode      | STRING           | Yes  | -       |                       |
| note            | TEXT             | Yes  | -       |                       |
| categoryId      | INTEGER          | Yes  | -       | FK → LeadCategory     |
| addedById       | INTEGER          | Yes  | -       | FK → Employee         |
| leadOwnerId     | INTEGER          | Yes  | -       | FK → Employee         |
| updatedById     | INTEGER          | Yes  | -       | FK → Employee         |
| hash            | TEXT             | Yes  | -       |                       |

**Relationships**:
| Direction | Target | FK | Alias | OnDelete |
|-----------|--------|----|-------|----------|
| belongsTo | LeadSource | sourceId | source | SET NULL |
| belongsTo | LeadStatus | statusId | status | SET NULL |
| belongsTo | LeadCategory | categoryId | category | SET NULL |
| belongsTo | Employee | addedById | addedBy | SET NULL |
| belongsTo | Employee | leadOwnerId | leadOwner | SET NULL |
| belongsTo | Employee | updatedById | updatedBy | SET NULL |
| hasMany | Deal | leadId | deals | RESTRICT |
| hasMany | CommunicationActivity | leadId | communicationActivities | CASCADE |
| hasMany | LeadMarketing | leadId | marketingData | CASCADE |

**Indexes**: `index(statusId)`, `index(categoryId)`, `index(leadOwnerId)`, `index(clientEmail)`

---

#### LeadCategory

| Property      | Value                         |
| ------------- | ----------------------------- |
| **Model**     | `LeadCategory`                |
| **Table**     | `lead_categories`             |
| **File**      | `lead/lead-category.model.ts` |
| **Interface** | `ILeadCategoryAttribute`      |
| **Paranoid**  | Yes                           |

| Field       | Type    | Null | Default | Notes            |
| ----------- | ------- | ---- | ------- | ---------------- |
| id          | INTEGER | No   | Auto    | PK               |
| name        | STRING  | No   | -       |                  |
| isDefault   | BOOLEAN | No   | false   | Was `tinyint(1)` |
| addedById   | INTEGER | Yes  | -       | FK → Employee    |
| updatedById | INTEGER | Yes  | -       | FK → Employee    |

**Relationships**:

- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'updatedBy', foreignKey: 'updatedById', onDelete: 'SET NULL' })`
- `hasMany(Lead, { as: 'leads', foreignKey: 'categoryId' })`
- `hasMany(LeadAgent, { as: 'agents', foreignKey: 'leadCategoryId' })`

---

#### LeadSource

| Property      | Value                       |
| ------------- | --------------------------- |
| **Model**     | `LeadSource`                |
| **Table**     | `lead_sources`              |
| **File**      | `lead/lead-source.model.ts` |
| **Interface** | `ILeadSourceAttribute`      |
| **Paranoid**  | Yes                         |

| Field       | Type    | Null | Default | Notes            |
| ----------- | ------- | ---- | ------- | ---------------- |
| id          | INTEGER | No   | Auto    | PK               |
| type        | STRING  | No   | -       | Source type name |
| addedById   | INTEGER | Yes  | -       | FK → Employee    |
| updatedById | INTEGER | Yes  | -       | FK → Employee    |

**Relationships**:

- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'updatedBy', foreignKey: 'updatedById', onDelete: 'SET NULL' })`
- `hasMany(Lead, { as: 'leads', foreignKey: 'sourceId' })`

---

#### LeadStatus

| Property      | Value                       |
| ------------- | --------------------------- |
| **Model**     | `LeadStatus`                |
| **Table**     | `lead_statuses`             |
| **File**      | `lead/lead-status.model.ts` |
| **Interface** | `ILeadStatusAttribute`      |
| **Paranoid**  | Yes                         |

| Field      | Type    | Null | Default | Notes            |
| ---------- | ------- | ---- | ------- | ---------------- |
| id         | INTEGER | No   | Auto    | PK               |
| type       | STRING  | No   | -       | Status type name |
| priority   | INTEGER | No   | 0       | Sort order       |
| isDefault  | BOOLEAN | No   | false   |                  |
| labelColor | STRING  | Yes  | -       | Hex color        |

**Relationships**:

- `hasMany(Lead, { as: 'leads', foreignKey: 'statusId' })`

---

#### LeadAgent

| Property      | Value                      |
| ------------- | -------------------------- |
| **Model**     | `LeadAgent`                |
| **Table**     | `lead_agents`              |
| **File**      | `lead/lead-agent.model.ts` |
| **Interface** | `ILeadAgentAttribute`      |
| **Paranoid**  | Yes                        |

| Field          | Type                | Null | Default   | Notes             |
| -------------- | ------------------- | ---- | --------- | ----------------- |
| id             | INTEGER             | No   | Auto      | PK                |
| employeeId     | INTEGER             | No   | -         | FK → Employee     |
| leadCategoryId | INTEGER             | Yes  | -         | FK → LeadCategory |
| status         | ENUM(EnabledStatus) | No   | 'enabled' |                   |
| addedById      | INTEGER             | Yes  | -         | FK → Employee     |
| updatedById    | INTEGER             | Yes  | -         | FK → Employee     |

**Relationships**:

- `belongsTo(Employee, { as: 'employee', foreignKey: 'employeeId', onDelete: 'RESTRICT' })`
- `belongsTo(LeadCategory, { as: 'category', foreignKey: 'leadCategoryId', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'updatedBy', foreignKey: 'updatedById', onDelete: 'SET NULL' })`

---

#### LeadMarketing

| Property      | Value                          |
| ------------- | ------------------------------ |
| **Model**     | `LeadMarketing`                |
| **Table**     | `lead_marketing_data`          |
| **File**      | `lead/lead-marketing.model.ts` |
| **Interface** | `ILeadMarketingAttribute`      |
| **Paranoid**  | Yes                            |

| Field                    | Type     | Null | Default | Notes     |
| ------------------------ | -------- | ---- | ------- | --------- |
| id                       | INTEGER  | No   | Auto    | PK        |
| leadId                   | INTEGER  | No   | -       | FK → Lead |
| utmSource                | STRING   | Yes  | -       |           |
| utmMedium                | STRING   | Yes  | -       |           |
| utmCampaign              | STRING   | Yes  | -       |           |
| utmContent               | STRING   | Yes  | -       |           |
| utmTerm                  | STRING   | Yes  | -       |           |
| utmAudience              | STRING   | Yes  | -       |           |
| trafficSourceId          | STRING   | Yes  | -       |           |
| facebookClickId          | STRING   | Yes  | -       |           |
| facebookLeadId           | STRING   | Yes  | -       |           |
| hasRegisteredForWebinar  | BOOLEAN  | No   | false   |           |
| hasJoinedFacebookGroup   | BOOLEAN  | No   | false   |           |
| hasDownloadedEbook       | BOOLEAN  | No   | false   |           |
| hasAttendedWebinar       | BOOLEAN  | No   | false   |           |
| registeredForZoomMeeting | BOOLEAN  | No   | false   |           |
| lastWebinarDate          | DATEONLY | Yes  | -       |           |
| contactScore             | INTEGER  | No   | 0       |           |

**Relationships**:

- `belongsTo(Lead, { as: 'lead', foreignKey: 'leadId', onDelete: 'CASCADE' })`

**Indexes**: `index(leadId)`

---

### 7.3 Deal Management

#### Deal

| Property      | Value                |
| ------------- | -------------------- |
| **Model**     | `Deal`               |
| **Table**     | `deals`              |
| **File**      | `deal/deal.model.ts` |
| **Interface** | `IDealAttribute`     |
| **Paranoid**  | Yes                  |

| Field              | Type          | Null | Default | Notes                  |
| ------------------ | ------------- | ---- | ------- | ---------------------- | --------------------------------------------------------------------- |
| id                 | INTEGER       | No   | Auto    | PK                     |
| bitrixId           | BIGINT        | Yes  | -       | Legacy external ID     |
| name               | STRING        | No   | -       |                        |
| columnPriority     | INTEGER       | Yes  | 0       |                        |
| dealPipelineId     | INTEGER       | Yes  | -       | FK → DealPipeline      |
| pipelineStageId    | INTEGER       | Yes  | -       | FK → PipelineStage     |
| leadId             | INTEGER       | Yes  | -       | FK → Lead              |
| closeDate          | DATEONLY      | Yes  | -       |                        |
| agentId            | INTEGER       | Yes  | -       | FK → LeadAgent         |
| categoryId         | INTEGER       | Yes  | -       | FK → LeadCategory      |
| hasNextFollowUp    | BOOLEAN       | No   | false   | Was `enum('yes','no')` |
| value              | DECIMAL(30,2) | Yes  | -       |                        |
| note               | TEXT          | Yes  | -       |                        |
| hash               | TEXT          | Yes  | -       |                        |
| currencyId         | INTEGER       | Yes  | -       | FK → Currency          |
| addedById          | INTEGER       | Yes  | -       | FK → Employee          |
| updatedById        | INTEGER       | Yes  | -       | FK → Employee          |
| shouldCreateClient | BOOLEAN       | No   | false   | Was `enum('0','1')`    | [NB: Ask Ayo if this is still needed or not and what it does exactly] |

**Relationships**:
| Direction | Target | FK | Alias | OnDelete |
|-----------|--------|----|-------|----------|
| belongsTo | Lead | leadId | lead | SET NULL |
| belongsTo | DealPipeline | dealPipelineId | pipeline | SET NULL |
| belongsTo | PipelineStage | pipelineStageId | stage | SET NULL |
| belongsTo | LeadCategory | categoryId | category | SET NULL |
| belongsTo | Currency | currencyId | currency | SET NULL |
| belongsTo | LeadAgent | agentId | agent | SET NULL |
| belongsTo | Employee | addedById | addedBy | SET NULL |
| belongsTo | Employee | updatedById | updatedBy | SET NULL |
| hasMany | DealFile | dealId | files | CASCADE |
| hasMany | DealHistory | dealId | histories | CASCADE |
| hasMany | DealNote | dealId | notes | CASCADE |
| hasMany | Meeting | dealId | meetings | CASCADE |
| hasMany | MeetingSummary | dealId | meetingSummaries | CASCADE |
| hasMany | CommunicationActivity | dealId | communicationActivities | CASCADE |
| belongsToMany | Package | through: DealPackage | packages | CASCADE |
| belongsToMany | Employee | through: DealParticipant | participants | CASCADE |
| belongsToMany | Employee | through: DealWatcher | watchers | CASCADE |

**Indexes**: `index(dealPipelineId)`, `index(pipelineStageId)`, `index(leadId)`, `index(agentId)`

---

#### DealPipeline

| Property      | Value                         |
| ------------- | ----------------------------- |
| **Model**     | `DealPipeline`                |
| **Table**     | `deal_pipelines`              |
| **File**      | `deal/deal-pipeline.model.ts` |
| **Interface** | `IDealPipelineAttribute`      |
| **Paranoid**  | Yes                           |

| Field       | Type    | Null | Default | Notes         |
| ----------- | ------- | ---- | ------- | ------------- |
| id          | INTEGER | No   | Auto    | PK            |
| name        | STRING  | No   | -       |               |
| slug        | STRING  | No   | -       | Unique        |
| priority    | INTEGER | No   | 0       |               |
| labelColor  | STRING  | Yes  | -       |               |
| isDefault   | BOOLEAN | No   | false   |               |
| addedById   | INTEGER | Yes  | -       | FK → Employee |
| updatedById | INTEGER | Yes  | -       | FK → Employee |

**Relationships**:

- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'updatedBy', foreignKey: 'updatedById', onDelete: 'SET NULL' })`
- `hasMany(PipelineStage, { as: 'stages', foreignKey: 'dealPipelineId', onDelete: 'CASCADE' })`
- `hasMany(Deal, { as: 'deals', foreignKey: 'dealPipelineId' })`
- `hasMany(MetaConversionTrigger, { as: 'conversionTriggers', foreignKey: 'dealPipelineId', onDelete: 'CASCADE' })`

**Indexes**: Unique on `slug`

---

#### PipelineStage

| Property      | Value                          |
| ------------- | ------------------------------ |
| **Model**     | `PipelineStage`                |
| **Table**     | `pipeline_stages`              |
| **File**      | `deal/pipeline-stage.model.ts` |
| **Interface** | `IPipelineStageAttribute`      |
| **Paranoid**  | Yes                            |

| Field          | Type    | Null | Default | Notes             |
| -------------- | ------- | ---- | ------- | ----------------- |
| id             | INTEGER | No   | Auto    | PK                |
| dealPipelineId | INTEGER | No   | -       | FK → DealPipeline |
| name           | STRING  | No   | -       |                   |
| slug           | STRING  | No   | -       |                   |
| priority       | INTEGER | No   | 0       |                   |
| isDefault      | BOOLEAN | No   | false   |                   |
| labelColor     | STRING  | Yes  | -       |                   |
| addedById      | INTEGER | Yes  | -       | FK → Employee     |
| updatedById    | INTEGER | Yes  | -       | FK → Employee     |

**Relationships**:

- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'updatedBy', foreignKey: 'updatedById', onDelete: 'SET NULL' })`
- `belongsTo(DealPipeline, { as: 'pipeline', foreignKey: 'dealPipelineId', onDelete: 'CASCADE' })`
- `hasMany(Deal, { as: 'deals', foreignKey: 'pipelineStageId' })`
- `hasMany(MetaConversionTrigger, { as: 'conversionTriggers', foreignKey: 'dealPipelineStageId' })`

**Indexes**: Composite unique on `(dealPipelineId, slug)`

---

#### DealFile [NB: Have a discussion with Ayo concerning it since both clients and employees should be able to upload. Also, is it best to just have one table for all files in the system with a polymorphic association to the owning entity (deal, meeting, communication activity, etc) instead of separate tables for each?]

| Property      | Value                     |
| ------------- | ------------------------- |
| **Model**     | `DealFile`                |
| **Table**     | `deal_files`              |
| **File**      | `deal/deal-file.model.ts` |
| **Interface** | `IDealFileAttribute`      |
| **Paranoid**  | Yes                       |

| Field       | Type         | Null | Default | Notes                                                            |
| ----------- | ------------ | ---- | ------- | ---------------------------------------------------------------- |
| id          | INTEGER      | No   | Auto    | PK                                                               |
| dealId      | INTEGER      | No   | -       | FK → Deal                                                        |
| employeeId  | INTEGER      | Yes  | -       | FK → Employee (uploader)                                         |
| provider    | STRING(50)   | No   | -       | File storage provider (e.g., 'local', 's3', 'google', 'dropbox') |
| name        | STRING(200)  | No   | -       |                                                                  |
| url         | STRING(2054) | No   | -       |                                                                  |
| hashName    | STRING(200)  | No   | -       |                                                                  |
| size        | STRING(200)  | Yes  | -       |                                                                  |
| description | TEXT         | Yes  | -       |                                                                  |
| addedById   | INTEGER      | Yes  | -       | FK → Employee                                                    |
| updatedById | INTEGER      | Yes  | -       | FK → Employee                                                    |

**Relationships**:

- `belongsTo(Deal, { as: 'deal', foreignKey: 'dealId', onDelete: 'CASCADE' })`
- `belongsTo(Employee, { as: 'employee', foreignKey: 'employeeId', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'updatedBy', foreignKey: 'updatedById', onDelete: 'SET NULL' })`

---

#### DealHistory [NB: If there is an event feature, will this still be needed as the events table can serve the same purpose? Also, if we keep it, we should rename it to DealEventHistory or something to avoid confusion with TaskHistory and other history tables]

| Property      | Value                        |
| ------------- | ---------------------------- |
| **Model**     | `DealHistory`                |
| **Table**     | `deal_histories`             |
| **File**      | `deal/deal-history.model.ts` |
| **Interface** | `IDealHistoryAttribute`      |
| **Paranoid**  | Yes                          |

| Field           | Type    | Null | Default | Notes              |
| --------------- | ------- | ---- | ------- | ------------------ |
| id              | INTEGER | No   | Auto    | PK                 |
| dealId          | INTEGER | No   | -       | FK → Deal          |
| eventType       | STRING  | No   | -       |                    |
| createdById     | INTEGER | Yes  | -       | FK → Employee      |
| dealStageFromId | INTEGER | Yes  | -       | FK → PipelineStage |
| dealStageToId   | INTEGER | Yes  | -       | FK → PipelineStage |
| fileId          | INTEGER | Yes  | -       | FK → DealFile      |
| taskId          | INTEGER | Yes  | -       | FK → Task          |
| followUpId      | INTEGER | Yes  | -       | FK → Meeting       |
| noteId          | INTEGER | Yes  | -       | FK → DealNote      |
| proposalId      | BIGINT  | Yes  | -       | External reference |

**Relationships**:

- `belongsTo(Deal, { as: 'deal', foreignKey: 'dealId', onDelete: 'CASCADE' })`
- `belongsTo(Employee, { as: 'createdBy', foreignKey: 'createdById', onDelete: 'SET NULL' })`
- `belongsTo(PipelineStage, { as: 'stageFrom', foreignKey: 'dealStageFromId', onDelete: 'SET NULL' })`
- `belongsTo(PipelineStage, { as: 'stageTo', foreignKey: 'dealStageToId', onDelete: 'SET NULL' })`
- `belongsTo(DealFile, { as: 'file', foreignKey: 'fileId', onDelete: 'SET NULL' })`
- `belongsTo(Task, { as: 'task', foreignKey: 'taskId', onDelete: 'SET NULL' })`
- `belongsTo(Meeting, { as: 'followUp', foreignKey: 'followUpId', onDelete: 'SET NULL' })`
- `belongsTo(DealNote, { as: 'note', foreignKey: 'noteId', onDelete: 'SET NULL' })`

**Indexes**: `index(dealId)`, `index(eventType)`

---

#### DealNote [NB: should we have ownerId and ownerType for all addedBy & updatedBy since we don't have one table to easily get users or is it going to be just employees that do this]

| Property      | Value                     |
| ------------- | ------------------------- |
| **Model**     | `DealNote`                |
| **Table**     | `deal_notes`              |
| **File**      | `deal/deal-note.model.ts` |
| **Interface** | `IDealNoteAttribute`      |
| **Paranoid**  | Yes                       |

| Field       | Type    | Null | Default | Notes         |
| ----------- | ------- | ---- | ------- | ------------- |
| id          | INTEGER | No   | Auto    | PK            |
| dealId      | INTEGER | No   | -       | FK → Deal     |
| title       | STRING  | No   | -       |               |
| details     | TEXT    | Yes  | -       |               |
| addedById   | INTEGER | Yes  | -       | FK → Employee |
| updatedById | INTEGER | Yes  | -       | FK → Employee |

**Relationships**:

- `belongsTo(Deal, { as: 'deal', foreignKey: 'dealId', onDelete: 'CASCADE' })`
- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'updatedBy', foreignKey: 'updatedById', onDelete: 'SET NULL' })`

---

#### DealPackage (Join Table)

| Property      | Value                        |
| ------------- | ---------------------------- |
| **Model**     | `DealPackage`                |
| **Table**     | `deal_packages`              |
| **File**      | `deal/deal-package.model.ts` |
| **Interface** | `IDealPackageAttribute`      |
| **Paranoid**  | No                           |

| Field     | Type    | Null | Default | Notes        |
| --------- | ------- | ---- | ------- | ------------ |
| id        | INTEGER | No   | Auto    | PK           |
| dealId    | INTEGER | No   | -       | FK → Deal    |
| packageId | INTEGER | No   | -       | FK → Package |

**Relationships**:

- `belongsTo(Deal, { foreignKey: 'dealId', onDelete: 'CASCADE' })`
- `belongsTo(Package, { foreignKey: 'packageId', onDelete: 'CASCADE' })`

**Indexes**: Composite unique on `(dealId, packageId)`

---

#### DealParticipant (Join Table)

| Property      | Value                            |
| ------------- | -------------------------------- |
| **Model**     | `DealParticipant`                |
| **Table**     | `deal_participants`              |
| **File**      | `deal/deal-participant.model.ts` |
| **Interface** | `IDealParticipantAttribute`      |
| **Paranoid**  | No                               |

| Field      | Type    | Null | Default | Notes         |
| ---------- | ------- | ---- | ------- | ------------- |
| id         | INTEGER | No   | Auto    | PK            |
| dealId     | INTEGER | No   | -       | FK → Deal     |
| employeeId | INTEGER | No   | -       | FK → Employee |

**Relationships**:

- `belongsTo(Deal, { foreignKey: 'dealId', onDelete: 'CASCADE' })`
- `belongsTo(Employee, { foreignKey: 'employeeId', onDelete: 'CASCADE' })`

**Indexes**: Composite unique on `(dealId, employeeId)`

---

#### DealWatcher (Join Table)

| Property      | Value                        |
| ------------- | ---------------------------- |
| **Model**     | `DealWatcher`                |
| **Table**     | `deal_watchers`              |
| **File**      | `deal/deal-watcher.model.ts` |
| **Interface** | `IDealWatcherAttribute`      |
| **Paranoid**  | No                           |

| Field      | Type    | Null | Default | Notes         |
| ---------- | ------- | ---- | ------- | ------------- |
| id         | INTEGER | No   | Auto    | PK            |
| dealId     | INTEGER | No   | -       | FK → Deal     |
| employeeId | INTEGER | No   | -       | FK → Employee |

**Relationships**:

- `belongsTo(Deal, { foreignKey: 'dealId', onDelete: 'CASCADE' })`
- `belongsTo(Employee, { foreignKey: 'employeeId', onDelete: 'CASCADE' })`

**Indexes**: Composite unique on `(dealId, employeeId)`

---

### 7.4 Meeting Domain

#### MeetingType

| Property      | Value                           |
| ------------- | ------------------------------- |
| **Model**     | `MeetingType`                   |
| **Table**     | `meeting_types`                 |
| **File**      | `meeting/meeting-type.model.ts` |
| **Interface** | `IMeetingTypeAttribute`         |
| **Paranoid**  | Yes                             |

| Field       | Type      | Null | Default | Notes         |
| ----------- | --------- | ---- | ------- | ------------- |
| id          | INTEGER   | No   | Auto    | PK            |
| name        | STRING    | No   | -       |               |
| description | TEXT      | Yes  | -       |               |
| color       | STRING(7) | Yes  | -       | Hex `#RRGGBB` |
| isActive    | BOOLEAN   | No   | true    |               |

**Relationships**:

- `hasMany(Meeting, { as: 'meetings', foreignKey: 'meetingTypeId' })`
- `hasMany(MeetingSummary, { as: 'summaries', foreignKey: 'meetingTypeId' })`

---

#### Meeting

| Property         | Value                      |
| ---------------- | -------------------------- |
| **Model**        | `Meeting`                  |
| **Table**        | `meetings`                 |
| **File**         | `meeting/meeting.model.ts` |
| **Interface**    | `IMeetingAttribute`        |
| **Paranoid**     | Yes                        |
| **Renamed from** | `lead_follow_up`           |

| Field            | Type             | Null | Default | Notes                       |
| ---------------- | ---------------- | ---- | ------- | --------------------------- |
| id               | INTEGER          | No   | Auto    | PK                          |
| dealId           | INTEGER          | Yes  | -       | FK → Deal                   |
| remark           | TEXT             | Yes  | -       |                             |
| nextFollowUpDate | DATE             | Yes  | -       |                             |
| addedById        | INTEGER          | Yes  | -       | FK → Employee               |
| updatedById      | INTEGER          | Yes  | -       | FK → Employee               |
| eventId          | TEXT             | Yes  | -       | External calendar event ref |
| meetingId        | STRING           | Yes  | -       | External meeting ref        |
| summaryId        | INTEGER          | Yes  | -       | FK → MeetingSummary         |
| sendReminder     | BOOLEAN          | No   | false   | Was `enum('yes','no')`      |
| remindTime       | TEXT             | Yes  | -       |                             |
| remindType       | ENUM(RemindType) | Yes  | -       | minute/hour/day             |
| reminders        | JSONB            | Yes  | -       |                             |
| status           | STRING           | Yes  | -       |                             |
| meetingTypeId    | INTEGER          | Yes  | -       | FK → MeetingType            |
| location         | STRING           | Yes  | -       |                             |
| meetingLink      | STRING           | Yes  | -       |                             |
| participants     | JSONB            | Yes  | -       |                             |

**Relationships**:

- `belongsTo(Deal, { as: 'deal', foreignKey: 'dealId', onDelete: 'CASCADE' })`
- `belongsTo(MeetingType, { as: 'meetingType', foreignKey: 'meetingTypeId', onDelete: 'SET NULL' })`
- `belongsTo(MeetingSummary, { as: 'summary', foreignKey: 'summaryId', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'updatedBy', foreignKey: 'updatedById', onDelete: 'SET NULL' })`

**Indexes**: `index(dealId)`, `index(meetingTypeId)`

---

#### MeetingSummary

| Property      | Value                              |
| ------------- | ---------------------------------- |
| **Model**     | `MeetingSummary`                   |
| **Table**     | `meeting_summaries`                |
| **File**      | `meeting/meeting-summary.model.ts` |
| **Interface** | `IMeetingSummaryAttribute`         |
| **Paranoid**  | Yes                                |

| Field         | Type    | Null | Default | Notes            |
| ------------- | ------- | ---- | ------- | ---------------- |
| id            | INTEGER | No   | Auto    | PK               |
| summaryObject | JSONB   | Yes  | -       |                  |
| meetingTypeId | INTEGER | Yes  | -       | FK → MeetingType |
| dealId        | INTEGER | Yes  | -       | FK → Deal        |

**Relationships**:

- `belongsTo(MeetingType, { as: 'meetingType', foreignKey: 'meetingTypeId', onDelete: 'SET NULL' })`
- `belongsTo(Deal, { as: 'deal', foreignKey: 'dealId', onDelete: 'CASCADE' })`
- `hasOne(Meeting, { as: 'meeting', foreignKey: 'summaryId' })`

---

### 7.5 Communication Domain

#### CommunicationActivity

| Property      | Value                                           |
| ------------- | ----------------------------------------------- |
| **Model**     | `CommunicationActivity`                         |
| **Table**     | `communication_activities`                      |
| **File**      | `communication/communication-activity.model.ts` |
| **Interface** | `ICommunicationActivityAttribute`               |
| **Paranoid**  | Yes                                             |

| Field                   | Type              | Null | Default | Notes              |
| ----------------------- | ----------------- | ---- | ------- | ------------------ |
| id                      | INTEGER           | No   | Auto    | PK                 |
| dealId                  | INTEGER           | Yes  | -       | FK → Deal          |
| leadId                  | INTEGER           | Yes  | -       | FK → Lead          |
| parentActivityId        | INTEGER           | Yes  | -       | FK → self (thread) |
| channelType             | ENUM(ChannelType) | No   | -       |                    |
| resolutionStatus        | STRING            | Yes  | -       |                    |
| resolutionAttempts      | INTEGER           | No   | 0       |                    |
| messageContent          | TEXT              | Yes  | -       |                    |
| senderInfo              | JSONB             | Yes  | -       |                    |
| timestamp               | DATE              | Yes  | -       | Message timestamp  |
| metadata                | JSONB             | Yes  | -       |                    |
| email                   | STRING            | Yes  | -       |                    |
| phoneNumber             | STRING            | Yes  | -       |                    |
| instagramUsername       | STRING            | Yes  | -       |                    |
| telegramUsername        | STRING            | Yes  | -       |                    |
| whatsappUsername        | STRING            | Yes  | -       |                    |
| firstName               | STRING            | Yes  | -       |                    |
| lastName                | STRING            | Yes  | -       |                    |
| messageType             | STRING            | Yes  | -       |                    |
| subject                 | STRING            | Yes  | -       |                    |
| lastResolutionAttemptAt | DATE              | Yes  | -       |                    |
| chatId                  | STRING            | Yes  | -       |                    |

**Relationships**:

- `belongsTo(Deal, { as: 'deal', foreignKey: 'dealId', onDelete: 'SET NULL' })`
- `belongsTo(Lead, { as: 'lead', foreignKey: 'leadId', onDelete: 'SET NULL' })`
- `belongsTo(CommunicationActivity, { as: 'parentActivity', foreignKey: 'parentActivityId', onDelete: 'SET NULL' })` (self-referential)
- `hasMany(CommunicationActivity, { as: 'replies', foreignKey: 'parentActivityId' })`
- `hasMany(CommunicationActivityFile, { as: 'files', foreignKey: 'activityId', onDelete: 'CASCADE' })`

**Indexes**: `index(dealId)`, `index(leadId)`, `index(channelType)`, `index(chatId)`

---

#### CommunicationActivityFile

| Property      | Value                                                |
| ------------- | ---------------------------------------------------- |
| **Model**     | `CommunicationActivityFile`                          |
| **Table**     | `communication_activity_files`                       |
| **File**      | `communication/communication-activity-file.model.ts` |
| **Interface** | `ICommunicationActivityFileAttribute`                |
| **Paranoid**  | No                                                   |

| Field      | Type    | Null | Default | Notes                      |
| ---------- | ------- | ---- | ------- | -------------------------- |
| id         | INTEGER | No   | Auto    | PK                         |
| activityId | INTEGER | No   | -       | FK → CommunicationActivity |
| fileUrl    | STRING  | No   | -       |                            |
| fileType   | STRING  | Yes  | -       |                            |
| fileSize   | INTEGER | Yes  | -       | Bytes                      |

**Relationships**:

- `belongsTo(CommunicationActivity, { as: 'activity', foreignKey: 'activityId', onDelete: 'CASCADE' })`

---

### 7.6 Task Management

#### TaskboardColumn

| Property      | Value                            |
| ------------- | -------------------------------- |
| **Model**     | `TaskboardColumn`                |
| **Table**     | `taskboard_columns`              |
| **File**      | `task/taskboard-column.model.ts` |
| **Interface** | `ITaskboardColumnAttribute`      |
| **Paranoid**  | Yes                              |

| Field      | Type    | Null | Default | Notes  |
| ---------- | ------- | ---- | ------- | ------ |
| id         | INTEGER | No   | Auto    | PK     |
| columnName | STRING  | No   | -       |        |
| slug       | STRING  | No   | -       | Unique |
| labelColor | STRING  | Yes  | -       |        |
| priority   | INTEGER | No   | 0       |        |

**Relationships**:

- `hasMany(Task, { as: 'tasks', foreignKey: 'boardColumnId' })`

**Indexes**: Unique on `slug`

---

#### TaskCategory

| Property      | Value                         |
| ------------- | ----------------------------- |
| **Model**     | `TaskCategory`                |
| **Table**     | `task_categories`             |
| **File**      | `task/task-category.model.ts` |
| **Interface** | `ITaskCategoryAttribute`      |
| **Paranoid**  | Yes                           |

| Field        | Type    | Null | Default | Notes         |
| ------------ | ------- | ---- | ------- | ------------- |
| id           | INTEGER | No   | Auto    | PK            |
| categoryName | STRING  | No   | -       |               |
| addedById    | INTEGER | Yes  | -       | FK → Employee |
| updatedById  | INTEGER | Yes  | -       | FK → Employee |

**Relationships**:

- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'updatedBy', foreignKey: 'updatedById', onDelete: 'SET NULL' })`
- `hasMany(Task, { as: 'tasks', foreignKey: 'taskCategoryId' })`

---

#### Task

| Property      | Value                |
| ------------- | -------------------- |
| **Model**     | `Task`               |
| **Table**     | `tasks`              |
| **File**      | `task/task.model.ts` |
| **Interface** | `ITaskAttribute`     |
| **Paranoid**  | Yes                  |

| Field           | Type               | Null | Default  | Notes                   |
| --------------- | ------------------ | ---- | -------- | ----------------------- |
| id              | INTEGER            | No   | Auto     | PK                      |
| taskShortCode   | STRING             | Yes  | -        |                         |
| heading         | STRING             | No   | -        |                         |
| description     | TEXT               | Yes  | -        |                         |
| dueDate         | DATE               | Yes  | -        |                         |
| startDate       | DATE               | Yes  | -        |                         |
| projectId       | INTEGER            | Yes  | -        | External ref (nullable) |
| taskCategoryId  | INTEGER            | Yes  | -        | FK → TaskCategory       |
| priority        | ENUM(TaskPriority) | No   | 'medium' |                         |
| status          | ENUM(TaskStatus)   | No   | 'to_do'  |                         |
| boardColumnId   | INTEGER            | Yes  | -        | FK → TaskboardColumn    |
| columnPriority  | INTEGER            | Yes  | 0        |                         |
| completedOn     | DATE               | Yes  | -        |                         |
| createdById     | INTEGER            | Yes  | -        | FK → Employee           |
| recurringTaskId | INTEGER            | Yes  | -        | FK → self               |
| dependentTaskId | INTEGER            | Yes  | -        | FK → self               |
| milestoneId     | INTEGER            | Yes  | -        | External ref            |
| isPrivate       | BOOLEAN            | No   | false    |                         |
| billable        | BOOLEAN            | No   | false    |                         |
| estimateHours   | INTEGER            | Yes  | 0        |                         |
| estimateMinutes | INTEGER            | Yes  | 0        |                         |
| addedById       | INTEGER            | Yes  | -        | FK → Employee           |
| updatedById     | INTEGER            | Yes  | -        | FK → Employee           |
| hash            | STRING(64)         | Yes  | -        |                         |
| repeat          | BOOLEAN            | No   | false    |                         |
| repeatComplete  | BOOLEAN            | No   | false    |                         |
| repeatCount     | INTEGER            | Yes  | 0        |                         |
| repeatType      | ENUM(RepeatType)   | Yes  | -        |                         |
| repeatCycles    | INTEGER            | Yes  | -        |                         |
| eventId         | TEXT               | Yes  | -        | External calendar ref   |
| approvalSend    | BOOLEAN            | No   | false    |                         |

**Relationships**:
| Direction | Target | FK | Alias | OnDelete |
|-----------|--------|----|-------|----------|
| belongsTo | TaskCategory | taskCategoryId | category | SET NULL |
| belongsTo | TaskboardColumn | boardColumnId | boardColumn | SET NULL |
| belongsTo | Employee | createdById | createdBy | SET NULL |
| belongsTo | Employee | addedById | addedBy | SET NULL |
| belongsTo | Employee | updatedById | updatedBy | SET NULL |
| belongsTo | Task | recurringTaskId | recurringTask | SET NULL |
| belongsTo | Task | dependentTaskId | dependentTask | SET NULL |
| hasMany | TaskHistory | taskId | histories | CASCADE |
| hasMany | TaskNote | taskId | notes | CASCADE |
| hasMany | Taskable | taskId | taskables | CASCADE |
| belongsToMany | Employee | through: TaskUser | assignees | CASCADE |

**Indexes**: `index(taskCategoryId)`, `index(boardColumnId)`, `index(status)`, `index(priority)`, `unique(taskShortCode)` (when not null)

---

#### TaskHistory

| Property      | Value                        |
| ------------- | ---------------------------- |
| **Model**     | `TaskHistory`                |
| **Table**     | `task_histories`             |
| **File**      | `task/task-history.model.ts` |
| **Interface** | `ITaskHistoryAttribute`      |
| **Paranoid**  | No                           |

| Field         | Type    | Null | Default | Notes                |
| ------------- | ------- | ---- | ------- | -------------------- |
| id            | INTEGER | No   | Auto    | PK                   |
| taskId        | INTEGER | No   | -       | FK → Task            |
| subTaskId     | INTEGER | Yes  | -       | FK → Task (subtask)  |
| employeeId    | INTEGER | Yes  | -       | FK → Employee        |
| details       | TEXT    | Yes  | -       |                      |
| boardColumnId | INTEGER | Yes  | -       | FK → TaskboardColumn |

**Relationships**:

- `belongsTo(Task, { as: 'task', foreignKey: 'taskId', onDelete: 'CASCADE' })`
- `belongsTo(Task, { as: 'subTask', foreignKey: 'subTaskId', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'employee', foreignKey: 'employeeId', onDelete: 'SET NULL' })`
- `belongsTo(TaskboardColumn, { as: 'boardColumn', foreignKey: 'boardColumnId', onDelete: 'SET NULL' })`

---

#### TaskNote

| Property      | Value                     |
| ------------- | ------------------------- |
| **Model**     | `TaskNote`                |
| **Table**     | `task_notes`              |
| **File**      | `task/task-note.model.ts` |
| **Interface** | `ITaskNoteAttribute`      |
| **Paranoid**  | Yes                       |

| Field       | Type    | Null | Default | Notes         |
| ----------- | ------- | ---- | ------- | ------------- |
| id          | INTEGER | No   | Auto    | PK            |
| taskId      | INTEGER | No   | -       | FK → Task     |
| employeeId  | INTEGER | Yes  | -       | FK → Employee |
| note        | TEXT    | No   | -       |               |
| addedById   | INTEGER | Yes  | -       | FK → Employee |
| updatedById | INTEGER | Yes  | -       | FK → Employee |

**Relationships**:

- `belongsTo(Task, { as: 'task', foreignKey: 'taskId', onDelete: 'CASCADE' })`
- `belongsTo(Employee, { as: 'employee', foreignKey: 'employeeId', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'updatedBy', foreignKey: 'updatedById', onDelete: 'SET NULL' })`

---

#### TaskUser (Join Table)

| Property      | Value                     |
| ------------- | ------------------------- |
| **Model**     | `TaskUser`                |
| **Table**     | `task_users`              |
| **File**      | `task/task-user.model.ts` |
| **Interface** | `ITaskUserAttribute`      |
| **Paranoid**  | No                        |

| Field      | Type    | Null | Default | Notes         |
| ---------- | ------- | ---- | ------- | ------------- |
| id         | INTEGER | No   | Auto    | PK            |
| taskId     | INTEGER | No   | -       | FK → Task     |
| employeeId | INTEGER | No   | -       | FK → Employee |

**Relationships**:

- `belongsTo(Task, { foreignKey: 'taskId', onDelete: 'CASCADE' })`
- `belongsTo(Employee, { foreignKey: 'employeeId', onDelete: 'CASCADE' })`

**Indexes**: Composite unique on `(taskId, employeeId)`

---

#### Taskable (Polymorphic Join)

| Property      | Value                    |
| ------------- | ------------------------ |
| **Model**     | `Taskable`               |
| **Table**     | `taskables`              |
| **File**      | `task/taskable.model.ts` |
| **Interface** | `ITaskableAttribute`     |
| **Paranoid**  | No                       |

| Field        | Type    | Null | Default | Notes                 |
| ------------ | ------- | ---- | ------- | --------------------- |
| id           | INTEGER | No   | Auto    | PK                    |
| taskId       | INTEGER | No   | -       | FK → Task             |
| taskableId   | INTEGER | No   | -       | Polymorphic target ID |
| taskableType | STRING  | No   | -       | Model name string     |

**Relationships**:

- `belongsTo(Task, { foreignKey: 'taskId', onDelete: 'CASCADE' })`
- No direct FK to target (polymorphic - resolved in application layer)

**Polymorphic targets**: `Deal`, `Lead`, `Property` (resolved via `taskableType` string matching)

**Indexes**: `index(taskId)`, composite `index(taskableId, taskableType)`

---

### 7.7 Property / Real Estate

#### Property

| Property      | Value                        |
| ------------- | ---------------------------- |
| **Model**     | `Property`                   |
| **Table**     | `properties`                 |
| **File**      | `property/property.model.ts` |
| **Interface** | `IPropertyAttribute`         |
| **Paranoid**  | Yes                          |

| Field               | Type          | Null | Default | Notes         |
| ------------------- | ------------- | ---- | ------- | ------------- |
| id                  | INTEGER       | No   | Auto    | PK            |
| developerProjectId  | INTEGER       | Yes  | -       | External ref  |
| projectLocationId   | INTEGER       | Yes  | -       | External ref  |
| productId           | INTEGER       | Yes  | -       | External ref  |
| addedById           | INTEGER       | Yes  | -       | FK → Employee |
| responsibleAgentId  | INTEGER       | Yes  | -       | FK → Employee |
| propertyType        | STRING        | Yes  | -       |               |
| primaryCategory     | STRING        | Yes  | -       |               |
| unitStyle           | STRING        | Yes  | -       |               |
| constructionStatus  | STRING        | Yes  | -       |               |
| viewTypes           | JSONB         | Yes  | -       |               |
| saleType            | STRING        | Yes  | -       |               |
| price               | STRING(255)   | Yes  | -       |               |
| minimalRentalPeriod | STRING        | Yes  | -       |               |
| rentPaymentInterval | STRING        | Yes  | -       |               |
| titleDeedType       | STRING        | Yes  | -       |               |
| titleDeedStage      | STRING        | Yes  | -       |               |
| status              | STRING        | Yes  | -       |               |
| isPublished         | BOOLEAN       | No   | false   |               |
| publishedAt         | DATE          | Yes  | -       |               |
| city                | STRING        | Yes  | -       |               |
| map                 | TEXT          | Yes  | -       |               |
| distances           | JSONB         | Yes  | -       |               |
| area                | STRING        | Yes  | -       |               |
| address             | TEXT          | Yes  | -       |               |
| latitude            | DECIMAL(10,8) | Yes  | -       |               |
| longitude           | DECIMAL(11,8) | Yes  | -       |               |
| landSize            | DECIMAL(10,2) | Yes  | -       |               |
| livingAreaSqm       | DECIMAL(10,2) | Yes  | -       |               |
| grossSqm            | DECIMAL(10,2) | Yes  | -       |               |
| terraceAreaSqm      | DECIMAL(10,2) | Yes  | -       |               |
| livingRoom          | STRING        | Yes  | -       |               |
| bedrooms            | STRING        | Yes  | -       |               |
| bathrooms           | INTEGER       | Yes  | -       |               |
| rooms               | INTEGER       | Yes  | -       |               |
| floorNumber         | INTEGER       | Yes  | -       |               |
| floorsInBuilding    | INTEGER       | Yes  | -       |               |
| balconyCount        | INTEGER       | Yes  | -       |               |
| balconyNetSqm       | DECIMAL(10,2) | Yes  | -       |               |
| buildingAge         | INTEGER       | Yes  | -       |               |
| completionDate      | DATEONLY      | Yes  | -       |               |
| furnitureStatus     | STRING        | Yes  | -       |               |
| heatingType         | STRING        | Yes  | -       |               |
| openToSwap          | BOOLEAN       | No   | false   |               |
| swapNotes           | TEXT          | Yes  | -       |               |
| currentOccupancy    | STRING        | Yes  | -       |               |
| withinSite          | BOOLEAN       | No   | false   |               |
| blockName           | STRING        | Yes  | -       |               |
| unitNumber          | STRING        | Yes  | -       |               |
| exteriorFeatures    | JSONB         | Yes  | -       |               |
| interiorFeatures    | JSONB         | Yes  | -       |               |
| locationFeatures    | JSONB         | Yes  | -       |               |
| outsideFeatures     | JSONB         | Yes  | -       |               |
| insideFeatures      | JSONB         | Yes  | -       |               |
| title               | STRING        | Yes  | -       |               |
| slug                | STRING(255)   | Yes  | -       | Unique        |
| description         | TEXT          | Yes  | -       |               |
| videoUrl            | STRING        | Yes  | -       |               |
| tour360Url          | STRING        | Yes  | -       |               |
| photos              | JSONB         | Yes  | -       |               |
| addOns              | JSONB         | Yes  | -       |               |
| ownerInfo           | JSONB         | Yes  | -       |               |
| legalInfo           | JSONB         | Yes  | -       |               |
| financialInfo       | JSONB         | Yes  | -       |               |
| documentsChecklist  | JSONB         | Yes  | -       |               |
| allow101evler       | BOOLEAN       | No   | false   |               |
| allowHangiev        | BOOLEAN       | No   | false   |               |
| landDetails         | JSONB         | Yes  | -       |               |

**Relationships**:

- `belongsTo(Employee, { as: 'addedBy', foreignKey: 'addedById', onDelete: 'SET NULL' })`
- `belongsTo(Employee, { as: 'responsibleAgent', foreignKey: 'responsibleAgentId', onDelete: 'SET NULL' })`
- `hasMany(PropertyAsset, { as: 'assets', foreignKey: 'propertyId', onDelete: 'CASCADE' })`

**Indexes**: `unique(slug)`, `index(status)`, `index(isPublished)`, `index(propertyType)`, `index(saleType)`

---

#### PropertyAsset

| Property      | Value                              |
| ------------- | ---------------------------------- |
| **Model**     | `PropertyAsset`                    |
| **Table**     | `property_assets`                  |
| **File**      | `property/property-asset.model.ts` |
| **Interface** | `IPropertyAssetAttribute`          |
| **Paranoid**  | Yes                                |

| Field       | Type                    | Null | Default | Notes         |
| ----------- | ----------------------- | ---- | ------- | ------------- |
| id          | INTEGER                 | No   | Auto    | PK            |
| propertyId  | INTEGER                 | No   | -       | FK → Property |
| name        | STRING                  | Yes  | -       |               |
| assetType   | ENUM(PropertyAssetType) | No   | -       |               |
| filePath    | STRING                  | Yes  | -       |               |
| externalUrl | STRING                  | Yes  | -       |               |
| mimeType    | STRING                  | Yes  | -       |               |
| fileSize    | BIGINT                  | Yes  | -       | Bytes         |
| tags        | JSONB                   | Yes  | -       |               |
| metadata    | JSONB                   | Yes  | -       |               |
| order       | INTEGER                 | No   | 0       | Sort order    |

**Relationships**:

- `belongsTo(Property, { as: 'property', foreignKey: 'propertyId', onDelete: 'CASCADE' })`

---

#### Package

| Property      | Value                       |
| ------------- | --------------------------- |
| **Model**     | `Package`                   |
| **Table**     | `packages`                  |
| **File**      | `property/package.model.ts` |
| **Interface** | `IPackageAttribute`         |
| **Paranoid**  | Yes                         |

| Field                   | Type          | Null | Default | Notes |
| ----------------------- | ------------- | ---- | ------- | ----- |
| id                      | INTEGER       | No   | Auto    | PK    |
| name                    | STRING        | No   | -       |       |
| value                   | DECIMAL(15,2) | Yes  | -       |       |
| description             | TEXT          | Yes  | -       |       |
| customerTypeName        | STRING        | Yes  | -       |       |
| customerTypeDescription | TEXT          | Yes  | -       |       |

**Relationships**:

- `belongsToMany(Deal, { through: DealPackage, as: 'deals', foreignKey: 'packageId', otherKey: 'dealId' })`

---

### 7.8 Settings

#### ApiToken

| Property      | Value                         |
| ------------- | ----------------------------- |
| **Model**     | `ApiToken`                    |
| **Table**     | `api_tokens`                  |
| **File**      | `settings/api-token.model.ts` |
| **Interface** | `IApiTokenAttribute`          |
| **Paranoid**  | Yes                           |

| Field       | Type       | Null | Default | Notes            |
| ----------- | ---------- | ---- | ------- | ---------------- |
| id          | INTEGER    | No   | Auto    | PK               |
| token       | STRING(64) | No   | -       | Unique           |
| name        | STRING     | No   | -       |                  |
| permissions | JSONB      | Yes  | -       |                  |
| isRevoked   | BOOLEAN    | No   | false   | Was `tinyint(1)` |

**Relationships**: None
**Indexes**: Unique on `token`

Note: Different from the existing `Application` model (which uses `apiKey`). `ApiToken` is for CRM-level API access tokens.

---

#### SmtpSetting

| Property      | Value                            |
| ------------- | -------------------------------- |
| **Model**     | `SmtpSetting`                    |
| **Table**     | `smtp_settings`                  |
| **File**      | `settings/smtp-setting.model.ts` |
| **Interface** | `ISmtpSettingAttribute`          |
| **Paranoid**  | No                               |

| Field           | Type                 | Null | Default | Notes               |
| --------------- | -------------------- | ---- | ------- | ------------------- |
| id              | INTEGER              | No   | Auto    | PK                  |
| mailDriver      | STRING               | Yes  | -       |                     |
| mailHost        | STRING               | Yes  | -       |                     |
| mailPort        | STRING               | Yes  | -       |                     |
| mailUsername    | STRING               | Yes  | -       |                     |
| mailPassword    | TEXT                 | Yes  | -       | Should be encrypted |
| mailFromName    | STRING               | Yes  | -       |                     |
| mailFromEmail   | STRING               | Yes  | -       |                     |
| mailEncryption  | ENUM(MailEncryption) | Yes  | -       |                     |
| isEmailVerified | BOOLEAN              | No   | false   |                     |
| isVerified      | BOOLEAN              | No   | false   |                     |
| mailConnection  | ENUM(MailConnection) | No   | 'sync'  |                     |

**Relationships**: None

---

#### LanguageSetting

| Property      | Value                                |
| ------------- | ------------------------------------ |
| **Model**     | `LanguageSetting`                    |
| **Table**     | `language_settings`                  |
| **File**      | `settings/language-setting.model.ts` |
| **Interface** | `ILanguageSettingAttribute`          |
| **Paranoid**  | No                                   |

| Field        | Type                | Null | Default   | Notes  |
| ------------ | ------------------- | ---- | --------- | ------ |
| id           | INTEGER             | No   | Auto      | PK     |
| languageCode | STRING              | No   | -         | Unique |
| languageName | STRING              | No   | -         |        |
| status       | ENUM(EnabledStatus) | No   | 'enabled' |        |
| flagCode     | STRING              | Yes  | -         |        |
| isRtl        | BOOLEAN             | No   | false     |        |

**Relationships**: None
**Indexes**: Unique on `languageCode`

Note: Different from existing `LanguageConfig` (which holds Brevo/Zoom configs). `LanguageSetting` is the CRM UI language catalog.

---

### 7.9 Custom Field Extensions

#### CustomFieldCondition

| Property      | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| **Model**     | `CustomFieldCondition`                                                      |
| **Table**     | `custom_field_conditions`                                                   |
| **File**      | `custom-field/custom-field-condition.model.ts` (extends EXISTING directory) |
| **Interface** | `ICustomFieldConditionAttribute`                                            |
| **Paranoid**  | No                                                                          |

| Field         | Type    | Null | Default | Notes                     |
| ------------- | ------- | ---- | ------- | ------------------------- |
| id            | INTEGER | No   | Auto    | PK                        |
| customFieldId | INTEGER | No   | -       | FK → CustomField (source) |
| targetFieldId | INTEGER | No   | -       | FK → CustomField (target) |
| operator      | STRING  | No   | -       | Condition operator        |
| value         | TEXT    | Yes  | -       | Condition value           |

**Relationships**:

- `belongsTo(CustomField, { as: 'sourceField', foreignKey: 'customFieldId', onDelete: 'CASCADE' })`
- `belongsTo(CustomField, { as: 'targetField', foreignKey: 'targetFieldId', onDelete: 'CASCADE' })`

**Purpose**: Defines field-to-field cascading dependencies (e.g., when Field A = X, update options of Field B). Different from ShowRuleSet which controls visibility.

**Indexes**: `index(customFieldId)`, `index(targetFieldId)`

---

### 7.10 Other

#### MetaConversionTrigger

| Property      | Value                                           |
| ------------- | ----------------------------------------------- |
| **Model**     | `MetaConversionTrigger`                         |
| **Table**     | `meta_conversion_triggers`                      |
| **File**      | `meta-conversion-trigger.model.ts` (root level) |
| **Interface** | `IMetaConversionTriggerAttribute`               |
| **Paranoid**  | No                                              |

| Field               | Type          | Null | Default | Notes              |
| ------------------- | ------------- | ---- | ------- | ------------------ |
| id                  | INTEGER       | No   | Auto    | PK                 |
| dealPipelineId      | INTEGER       | No   | -       | FK → DealPipeline  |
| dealPipelineStageId | INTEGER       | No   | -       | FK → PipelineStage |
| eventName           | STRING        | No   | -       | Meta event name    |
| value               | DECIMAL(15,2) | Yes  | -       |                    |
| isActive            | BOOLEAN       | No   | true    |                    |

**Relationships**:

- `belongsTo(DealPipeline, { as: 'pipeline', foreignKey: 'dealPipelineId', onDelete: 'CASCADE' })`
- `belongsTo(PipelineStage, { as: 'stage', foreignKey: 'dealPipelineStageId', onDelete: 'CASCADE' })`

---

#### UserReminderPreference

| Property      | Value                                            |
| ------------- | ------------------------------------------------ |
| **Model**     | `UserReminderPreference`                         |
| **Table**     | `user_reminder_preferences`                      |
| **File**      | `user-reminder-preference.model.ts` (root level) |
| **Interface** | `IUserReminderPreferenceAttribute`               |
| **Paranoid**  | No                                               |

| Field      | Type                     | Null | Default | Notes         |
| ---------- | ------------------------ | ---- | ------- | ------------- |
| id         | INTEGER                  | No   | Auto    | PK            |
| employeeId | INTEGER                  | No   | -       | FK → Employee |
| entityType | ENUM(ReminderEntityType) | No   | 'all'   |               |
| reminders  | JSONB                    | Yes  | -       |               |
| isActive   | BOOLEAN                  | No   | true    |               |

**Relationships**:

- `belongsTo(Employee, { as: 'employee', foreignKey: 'employeeId', onDelete: 'CASCADE' })`

---

## 8. Cross-Domain Relationship Map

```
                              ┌─────────────────────────────────────┐
                              │           EXISTING MODELS            │
                              │                                     │
                              │  Employee ◄──── Department           │
                              │     │              │                 │
                              │     │          Role ◄── Permission   │
                              │     │                                │
                              │  User    CustomField    Form         │
                              └──┬───────────┬──────────────────────┘
                                 │           │
            ┌────────────────────┤           │
            │                    │           │
            ▼                    ▼           ▼
    ┌───────────────┐   ┌──────────────┐  ┌─────────────────────┐
    │  LEAD DOMAIN  │   │ DEAL DOMAIN  │  │ CUSTOM FIELD EXT    │
    │               │   │              │  │                     │
    │ Lead ─────────┼──►│ Deal         │  │ CustomFieldCondition│
    │  ├ LeadCategory│   │  ├ DealFile  │  └─────────────────────┘
    │  ├ LeadSource │   │  ├ DealHistory│
    │  ├ LeadStatus │   │  ├ DealNote  │
    │  ├ LeadAgent  │   │  ├ DealPackage ──► Package
    │  ├ LeadMarketing  │  ├ DealParticipant ──► Employee
    │  └ DealPipeline│  │  └ DealWatcher ──► Employee
    │     └ PipelineStage  │              │
    │       └ MetaConversionTrigger       │
    └───────┬───────┘   └──────┬─────────┘
            │                  │
            │    ┌─────────────┤
            │    │             │
            ▼    ▼             ▼
    ┌──────────────┐   ┌──────────────┐
    │  MEETING     │   │ COMMUNICATION│
    │              │   │              │
    │ Meeting      │   │ CommActivity │
    │ MeetingSummary   │  └ CommActivityFile
    │ MeetingType  │   │              │
    └──────────────┘   └──────────────┘

    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
    │  TASK DOMAIN │   │  PROPERTY    │   │  SETTINGS    │
    │              │   │              │   │              │
    │ Task ────────┼──►│ Property     │   │ ApiToken     │
    │  ├ TaskCategory  │  └ PropertyAsset  │ SmtpSetting  │
    │  ├ TaskHistory│  │              │   │ LanguageSetting
    │  ├ TaskNote  │   │ Package      │   └──────────────┘
    │  ├ TaskUser ──► Employee        │
    │  └ Taskable (poly → Deal,Lead,Property)
    │ TaskboardColumn  └──────────────┘
    └──────────────┘

    ┌──────────────┐
    │  OTHER       │
    │              │
    │ Currency ◄── Deal
    │ Country (lookup)
    │ UserReminderPreference ──► Employee
    └──────────────┘
```

---

## 9. FK Reference Matrix

Shows which new models reference which existing/new models via foreign keys.

### References to Existing Models

| New Model              | → Employee                          | → User   | → CustomField                |
| ---------------------- | ----------------------------------- | -------- | ---------------------------- |
| Lead                   | addedById, leadOwnerId, updatedById | clientId | -                            |
| LeadCategory           | addedById, updatedById              | -        | -                            |
| LeadSource             | addedById, updatedById              | -        | -                            |
| LeadAgent              | employeeId, addedById, updatedById  | -        | -                            |
| DealPipeline           | addedById                           | -        | -                            |
| Deal                   | agentId, addedById, updatedById     | -        | -                            |
| DealFile               | employeeId, addedById, updatedById  | -        | -                            |
| DealHistory            | createdById, agentId                | -        | -                            |
| DealNote               | addedById, updatedById              | -        | -                            |
| DealParticipant        | employeeId                          | -        | -                            |
| DealWatcher            | employeeId                          | -        | -                            |
| Meeting                | addedById, updatedById              | -        | -                            |
| Task                   | createdById, addedById, updatedById | -        | -                            |
| TaskHistory            | employeeId                          | -        | -                            |
| TaskNote               | employeeId, addedById, updatedById  | -        | -                            |
| TaskUser               | employeeId                          | -        | -                            |
| TaskCategory           | addedById, updatedById              | -        | -                            |
| Property               | addedById, responsibleAgentId       | -        | -                            |
| UserReminderPreference | employeeId                          | -        | -                            |
| CustomFieldCondition   | -                                   | -        | customFieldId, targetFieldId |

### Cross-References Between New Models

| Source Model              | → Target Model          | FK                               |
| ------------------------- | ----------------------- | -------------------------------- |
| Lead                      | → LeadSource            | sourceId                         |
| Lead                      | → LeadStatus            | statusId                         |
| Lead                      | → LeadCategory          | categoryId                       |
| LeadAgent                 | → LeadCategory          | leadCategoryId                   |
| LeadMarketing             | → Lead                  | leadId                           |
| PipelineStage             | → DealPipeline          | dealPipelineId                   |
| Deal                      | → Lead                  | leadId                           |
| Deal                      | → DealPipeline          | dealPipelineId                   |
| Deal                      | → PipelineStage         | pipelineStageId                  |
| Deal                      | → LeadCategory          | categoryId                       |
| Deal                      | → Currency              | currencyId                       |
| DealFile                  | → Deal                  | dealId                           |
| DealHistory               | → Deal                  | dealId                           |
| DealHistory               | → PipelineStage         | dealStageFromId, dealStageToId   |
| DealHistory               | → DealFile              | fileId                           |
| DealHistory               | → Task                  | taskId                           |
| DealHistory               | → Meeting               | followUpId                       |
| DealHistory               | → DealNote              | noteId                           |
| DealNote                  | → Deal                  | dealId                           |
| DealPackage               | → Deal, Package         | dealId, packageId                |
| DealParticipant           | → Deal                  | dealId                           |
| DealWatcher               | → Deal                  | dealId                           |
| Meeting                   | → Deal                  | dealId                           |
| Meeting                   | → MeetingType           | meetingTypeId                    |
| Meeting                   | → MeetingSummary        | summaryId                        |
| MeetingSummary            | → MeetingType           | meetingTypeId                    |
| MeetingSummary            | → Deal                  | dealId                           |
| CommunicationActivity     | → Deal                  | dealId                           |
| CommunicationActivity     | → Lead                  | leadId                           |
| CommunicationActivity     | → self                  | parentActivityId                 |
| CommunicationActivityFile | → CommunicationActivity | activityId                       |
| Task                      | → TaskCategory          | taskCategoryId                   |
| Task                      | → TaskboardColumn       | boardColumnId                    |
| Task                      | → self                  | recurringTaskId, dependentTaskId |
| TaskHistory               | → Task                  | taskId, subTaskId                |
| TaskHistory               | → TaskboardColumn       | boardColumnId                    |
| TaskNote                  | → Task                  | taskId                           |
| TaskUser                  | → Task                  | taskId                           |
| Taskable                  | → Task                  | taskId                           |
| PropertyAsset             | → Property              | propertyId                       |
| MetaConversionTrigger     | → DealPipeline          | dealPipelineId                   |
| MetaConversionTrigger     | → PipelineStage         | dealPipelineStageId              |
