ALL API KEYS REQUIRE the X-API-KEY header for auth

/v1/qualification/templates
GET

Query Params
page integer
limit integer
status enum: draft, published, archived

All query params are required

Response

{
"success": true,
"message": "Qualification templates fetched.",
"data": {
"result": [
{
"id": 3,
"name": "HIBARR Third Script",
"description": null,
"status": "published",
"version": 1,
"createdAt": "2026-06-25T08:02:52.953Z",
"updatedAt": "2026-06-25T08:03:28.394Z"
}
],
"totalCount": 1,
"currentPage": 1,
"totalPages": 1,
"previousPage": null,
"nextPage": null,
"previusUrl": null,
"nextUrl": null
}
}

---

/v1/qualification/templates
POST

Payload

{
"name": "string",
"description": "string"
}
Response
{
"success": true,
"message": "Qualification template created.",
"data": {
"id": 4,
"name": "string",
"description": "string",
"status": "draft",
"version": 0,
"updatedAt": "2026-07-06T07:09:54.542Z",
"createdAt": "2026-07-06T07:09:54.542Z"
}
}

---

/v1/qualification/templates/{templateId}
DELETE
Response
{
"success": true,
"message": "Qualification template archived.",
"data": {
"id": 4,
"name": "string",
"description": "string",
"status": "archived",
"version": 0,
"createdAt": "2026-07-06T07:09:54.542Z",
"updatedAt": "2026-07-06T07:12:48.398Z"
}
}

---

/v1/qualification/templates/{templateId}
GET

Response
{
"success": true,
"message": "Qualification template fetched.",
"data": {
"id": 3,
"name": "HIBARR Third Script",
"description": null,
"status": "published",
"version": 1,
"createdAt": "2026-06-25T08:02:52.953Z",
"updatedAt": "2026-06-25T08:03:28.394Z"
}
}

---

/v1/qualification/templates/{templateId}
PUT

Payload
{
"name": "HIBARR Third Script",
"description": "string"
}

Response

{
"success": true,
"message": "Qualification template updated.",
"data": {
"id": 3,
"name": "HIBARR Third Script",
"description": "string",
"status": "published",
"version": 1,
"createdAt": "2026-06-25T08:02:52.953Z",
"updatedAt": "2026-07-06T07:15:26.516Z"
}
}

---

/v1/qualification/templates/{templateId}/tree
GET
Response
{
"success": true,
"message": "Qualification template tree fetched.",
"data": {
"templateId": 3,
"templateVersion": 1,
"segments": [
{
"id": 42,
"templateId": 3,
"key": "hibarr_third_script_say_0",
"order": 0,
"type": "say",
"body": "Welcome to HIBARR",
"prompt": null,
"answerType": null,
"required": true,
"outcomeKey": null,
"ctaLabel": null,
"parentOptionId": null,
"createdAt": "2026-06-27T14:01:00.584Z",
"updatedAt": "2026-06-27T14:01:00.584Z",
"options": []
},
{
"id": 43,
"templateId": 3,
"key": "hibarr_third_script_question_1",
"order": 1,
"type": "question",
"body": null,
"prompt": "I need to know your age {{lead.firstName}}",
"answerType": "single_select",
"category": "main",
"required": true,
"outcomeKey": null,
"ctaLabel": null,
"parentOptionId": null,
"createdAt": "2026-06-27T14:01:20.977Z",
"updatedAt": "2026-06-27T14:01:48.481Z",
"options": [
{
"id": 24,
"segmentId": 43,
"value": "join_the_cage",
"label": "Join the cage",
"order": 0,
"createdAt": "2026-06-27T14:01:48.720Z",
"updatedAt": "2026-06-27T14:01:48.720Z"
},
{
"id": 25,
"segmentId": 43,
"value": "entere_the_room",
"label": "Entere the room",
"order": 1,
"createdAt": "2026-06-27T14:01:48.946Z",
"updatedAt": "2026-06-27T14:01:48.946Z"
}
]
},
{
"id": 41,
"templateId": 3,
"key": "hibarr_third_script_outcome_0",
"order": 2,
"type": "outcome",
"body": "Yes this is the best route",
"prompt": null,
"answerType": null,
"required": true,
"outcomeKey": "book_meeting",
"ctaLabel": "Bye bye",
"parentOptionId": 24,
"createdAt": "2026-06-25T08:03:16.636Z",
"updatedAt": "2026-06-27T14:02:41.207Z",
"options": []
}
]
}
}

`category` is question-only (`"main"` today, or `null` when unset). It is **not** the same as segment `type` (`say` | `question` | `instruction` | `outcome`). CRM uses `category: "main"` (with `isEntryQuestion` / `entryQuestionKey` fallbacks) to identify the branching entry question. Non-question segments must not set `category` (OL returns 400).

---

# Other Endpoints

---

/v1/registration/consultation/calendly

POST

Payload

{
"firstName": "string",
"lastName": "string",
"email": "user@example.com",
"dateOfBirth": "2025-01-01T00:00:00.000Z",
"city": "string",
"state": "string",
"zipCode": "string",
"utmInfo": {
"utmSource": "string",
"utmMedium": "string",
"utmCampaign": "string",
"utmTerm": "string",
"utmContent": "string",
"agt": 1
},
"meetingId": "string",
"ipAddress": "string",
"userAgent": "string",
"facebookClickID": "string",
"facebookBrowserID": "string",
"facebookLeadID": "string",
"phone": "string",
"language": "en",
"score": 1.1,
"country": "string",
"interestedIn": [
"string"
],
"budget": "string",
"period": "string",
"kickoffMeetingDate": "string",
"message": "string",
"reasonForTheMeeting": "string",
"pipelineId": 1.1,
"leadSourceId": 1.1,
"dealOwnerId": 1.1,
"dealWatchers": [
1.1
],
"meetingDetails": {
"meetingDate": "string",
"meetingTypeId": "string",
"meetingLocation": "string",
"meetingLink": "string",
"meetingId": "string"
},
"gender": "male",
"customFields": {}
}

---

/v1/internal/{webinarId}/sessions/next

GET

Response

{
  "success": true,
  "data": [
    {
      "id": "session-123",
      "title": "Weekly Webinar",
      "startsAt": "2026-07-10T18:00:00.000Z",
      "timezone": "Europe/Berlin"
    }
  ]
}

---

/v1/internal/registration/webinar/session/{sessionId}
POST

Payload
{
"firstName": "string",
"lastName": "string",
"gender": "male",
"email": "user@example.com",
"phone": "string",
"language": "de",
"utmInfo": {
"utmSource": "string",
"utmMedium": "string",
"utmCampaign": "string",
"utmTerm": "string",
"utmContent": "string",
"agt": 1
}
}

Response

{
  "success": true,
  "message": "Webinar session registration completed."
}

---

# CRM qualification complete (local)

OL does **not** receive selected outcomes. CRM owns session completion.

`POST /account/lead-qualifications/{id}/complete`

```json
{
  "outcomes": ["bookMeeting", "inviteWebinar"],
  "outcome_comment": "Optional agent note",
  "selected_branch_keys": ["join_the_cage"],
  "actions": [
    { "type": "book_consultation", "config": { "calendlyUrl": "https://calendly.com/..." } },
    { "type": "invite_webinar", "config": { "webinarId": "123" } }
  ]
}
```

Legacy shim: a single `outcome` string is still accepted and normalized to `outcomes: [outcome]`.

Behavior:

1. CRM UI gathers distinct `outcomeKey`s from outcome segments (and their `actions[]`, with legacy key→action fallback).
2. Agent multi-selects ≥1 outcome and may add `outcome_comment`.
3. Complete persists outcomes + lifecycle winner **without** running registrations.
4. CRM seeds `lead_qualification_action_runs` from the `actions` payload (deduped by type).
5. Agent then runs actions from the post-complete panel (click each; modals for payloads).

Lifecycle winner priority remains:
`bookMeeting` > `inviteWebinar` > `callback` > `noFit`.

---

# CRM qualification action catalog (for OL authoring)

`GET /api/qualification-actions` (API token auth, scope `api.qualification-actions.index`)

Also available to the CRM session as `GET /account/qualification-actions`.

```json
{
  "version": 1,
  "actions": [
    {
      "type": "book_consultation",
      "label": "Book consultation",
      "status": "available",
      "requiresRuntimePayload": false,
      "optionalConfigKeys": ["calendlyUrl"]
    },
    {
      "type": "invite_webinar",
      "label": "Invite to webinar",
      "status": "available",
      "requiresRuntimePayload": true,
      "optionalConfigKeys": ["webinarId"]
    },
    {
      "type": "create_task",
      "label": "Create task",
      "status": "coming_soon",
      "requiresRuntimePayload": true,
      "optionalConfigKeys": []
    }
  ]
}
```

OL stores chosen `type` (+ optional config) on outcome segments as `actions[]`. CRM executes available types after complete.

`POST /account/lead-qualifications/{id}/actions/{actionRunId}/execute`

```json
{
  "payload": { "webinarSessionId": "…", "webinarSessionLabel": "…" },
  "error": null
}
```

In this CRM pass, client performs Calendly/webinar registration then patches the run status.

## Smoke checklist (`crm.lead-qualification-tab` on)

1. Published OL template with ≥2 outcome segments (and/or `actions[]`).
2. Start qualification → answer through to outcome step → multi-select → Complete.
3. Actions panel appears; run `book_consultation` / `invite_webinar`; other types disabled or no-op.
4. Confirm lead lifecycle matches outcome winner; action runs persist on the qualification.

