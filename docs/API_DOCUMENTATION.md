# attlic - Backend API Specification & Reference

## Base URL
- Development: `http://localhost:3000`
- Production: `https://<CLOUD_RUN_SERVICE_URL>`

All requests must use JSON bodies with `Content-Type: application/json`.
Standard Rate Limiting applies to all `/api/*` endpoints (exemption for `/api/health`).

---

## 1. Assessments API

### `GET /api/assessments`
Retrieves assessments filtered by recruiter context.
- **Query Parameters**:
  - `organizationId` (string, optional): Filter by organization ID.
  - `recruiterEmail` (string, optional): Filter by recruiter email address.
  - `recruiterId` (string, optional): Filter by recruiter UID.
  - `all` (boolean, optional): Return all assessments (admin view).
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "assessments": [ ... ]
  }
  ```

### `GET /api/assessments/code/:code`
Public candidate endpoint to look up an assessment by its code.
- **Security Notice**: This endpoint sanitizes the returned assessment. All `correctOptionIds`, `correctAnswers`, `isCorrect: true` on options, and question `explanation` fields are removed.
- **Parameters**: `code` (string): Assessment code (case-insensitive).
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "assessment": {
      "id": "assess_123",
      "code": "CAMPUS-2026-CS",
      "title": "Software Engineering Campus Assessment",
      "sections": [ ... ]
    }
  }
  ```
- **Response `404 Not Found`**:
  ```json
  {
    "success": false,
    "error": "NOT_FOUND",
    "message": "Assessment with code \"XYZ\" not found."
  }
  ```

### `POST /api/assessments`
Creates or updates an assessment in persistent storage.
- **Body**: Complete `Assessment` object with `id` and `code`.
- **Response `200 OK`**: `{ "success": true, "assessment": { ... } }`

### `PUT /api/assessments/:id`
Updates an existing assessment by ID.
- **Body**: Partial or complete update fields.
- **Response `200 OK`**: `{ "success": true, "assessment": { ... } }`

### `DELETE /api/assessments/:id`
Deletes an assessment by ID.
- **Response `200 OK`**: `{ "success": true }`

---

## 2. Examination & Candidate Submissions API

### `POST /api/assessments/code/:code/submit`
Authoritative server-side evaluation and submission endpoint.
- **Parameters**: `code` (string): Assessment code.
- **Body**:
  ```json
  {
    "candidate": {
      "id": "cand-123",
      "name": "Jane Doe",
      "email": "jane@university.edu",
      "rollNumber": "CS2026-081",
      "college": "State University",
      "branch": "Computer Science"
    },
    "answers": {
      "q1": {
        "questionId": "q1",
        "selectedOptionIds": ["opt_1"],
        "visited": true
      }
    },
    "tabSwitchCount": 0,
    "violationLogs": [],
    "startedAt": "2026-11-06T14:00:00Z"
  }
  ```
- **Evaluation Logic**: Server matches candidate choices against true assessment answer keys, computes positive/negative marks, percentage, and pass/fail status.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "attempt": {
      "id": "attempt-1700000000-123",
      "assessmentId": "assess_123",
      "assessmentCode": "CAMPUS-2026-CS",
      "score": 40,
      "totalMarks": 50,
      "percentage": 80,
      "passed": true,
      "submittedAt": "2026-11-06T14:45:00Z"
    }
  }
  ```
- **Response `409 Conflict` (Duplicate Submission)**:
  ```json
  {
    "success": false,
    "error": "DUPLICATE_SUBMISSION",
    "message": "An attempt has already been submitted for this candidate email. Multiple submissions are restricted."
  }
  ```

### `GET /api/attempts`
Queries candidate attempts for recruiter dashboards and live proctoring.
- **Query Parameters**:
  - `organizationId` (string, optional)
  - `recruiterEmail` (string, optional)
  - `assessmentId` (string, optional)
- **Response `200 OK`**: `{ "success": true, "attempts": [ ... ] }`

---

## 3. Google Forms Simple & OAuth Importers

### `POST /api/google-forms/extract-simple`
Extracts examination schema from any public Google Form URL without requiring Google OAuth scopes or API enablement.
- **Body**: `{ "formUrl": "https://docs.google.com/forms/d/e/.../viewform" }`
- **Response `200 OK`**: Standardized JSON structure with sections and questions.

### `POST /api/google-forms/validate-json`
Validates a standardized assessment JSON file before importing.
- **Body**: `{ "jsonContent": "..." }`
- **Response `200 OK`**: `{ "isValid": true, "errors": [], "warnings": [] }`

---

## 4. System Health

### `GET /api/health`
Monitors server operational status. Excluded from rate limits.
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "service": "attlic-assessment-engine",
    "version": "2.0.0"
  }
  ```
