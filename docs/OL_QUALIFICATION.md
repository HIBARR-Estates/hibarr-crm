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
  "webinar_session_label": "Weekly Webinar"
}
```

Legacy shim: a single `outcome` string is still accepted and normalized to `outcomes: [outcome]`.

Behavior:

1. CRM UI gathers distinct `outcomeKey`s from all tree segments with `type === "outcome"` (options nested under outcomes are ignored).
2. Agent multi-selects ≥1 outcome and may add `outcome_comment`.
3. CRM runs registration side effects for each selected actionable outcome (`bookMeeting` → Calendly; `inviteWebinar` → webinar session), then calls complete once.
4. CRM stores full `outcomes[]` + comment; scalar `outcome` is the **lifecycle winner** via priority:
   `bookMeeting` > `inviteWebinar` > `callback` > `noFit`
   (lifecycle: `qualified` > `nurturing` > `callback` > `not_fit`).

## Smoke checklist (`crm.lead-qualification-tab` on)

1. Published OL template with ≥2 outcome segments (distinct `outcomeKey`s).
2. Start qualification → answer through to an outcome step.
3. Multi-select two outcomes + optional comment → Complete.
4. Confirm lead lifecycle matches the higher-priority selected outcome.
5. Answers review / completed recap shows all selected outcomes + comment.

