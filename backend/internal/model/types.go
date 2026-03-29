package model

import "time"

type GlobalRole string

const (
	GlobalRoleSystemAdmin GlobalRole = "system_admin"
	GlobalRoleUser        GlobalRole = "user"
)

type SpaceRole string

const (
	SpaceRoleAdmin  SpaceRole = "space_admin"
	SpaceRoleMember SpaceRole = "member"
)

type ProblemType string

const (
	ProblemTypeProgramming  ProblemType = "programming"
	ProblemTypeSingleChoice ProblemType = "single_choice"
	ProblemTypeTrueFalse    ProblemType = "true_false"
)

type SubmitType string

const (
	SubmitTypeRun       SubmitType = "run"
	SubmitTypeTest      SubmitType = "test"
	SubmitTypeSubmit    SubmitType = "submit"
	SubmitTypeObjective SubmitType = "objective"
)

type SubmissionStatus string

const (
	SubmissionStatusQueued  SubmissionStatus = "queued"
	SubmissionStatusRunning SubmissionStatus = "running"
	SubmissionStatusDone    SubmissionStatus = "done"
	SubmissionStatusFailed  SubmissionStatus = "failed"
)

type Verdict string

const (
	VerdictPending Verdict = "PENDING"
	VerdictOK      Verdict = "OK"
	VerdictAC      Verdict = "AC"
	VerdictWA      Verdict = "WA"
	VerdictCE      Verdict = "CE"
	VerdictRE      Verdict = "RE"
	VerdictTLE     Verdict = "TLE"
	VerdictMLE     Verdict = "MLE"
)

type User struct {
	ID           int64      `json:"id"`
	Username     string     `json:"username"`
	PasswordHash string     `json:"-"`
	GlobalRole   GlobalRole `json:"globalRole"`
	CreatedAt    time.Time  `json:"createdAt"`
}

type Space struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedBy   int64     `json:"createdBy"`
	CreatedAt   time.Time `json:"createdAt"`
}

type RootProblem struct {
	ID             int64       `json:"id"`
	Type           ProblemType `json:"type"`
	Title          string      `json:"title"`
	StatementMD    string      `json:"statementMd"`
	BodyJSON       string      `json:"bodyJson"`
	AnswerJSON     string      `json:"answerJson"`
	TimeLimitMS    int         `json:"timeLimitMs"`
	MemoryLimitMiB int         `json:"memoryLimitMiB"`
	CreatedBy      int64       `json:"createdBy"`
	CreatedAt      time.Time   `json:"createdAt"`
}

type Submission struct {
	ID           int64            `json:"id"`
	UserID       int64            `json:"userId"`
	SpaceID      int64            `json:"spaceId"`
	ProblemID    int64            `json:"problemId"`
	QuestionType ProblemType      `json:"questionType"`
	Language     string           `json:"language"`
	SourceCode   string           `json:"sourceCode"`
	InputData    string           `json:"inputData"`
	SubmitType   SubmitType       `json:"submitType"`
	Status       SubmissionStatus `json:"status"`
	Verdict      Verdict          `json:"verdict"`
	TimeMS       int              `json:"timeMs"`
	MemoryKiB    int              `json:"memoryKiB"`
}

type ImageTag struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedBy int64     `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

type ImageTagLink struct {
	ImageURL  string    `json:"imageUrl"`
	TagID     int64     `json:"tagId"`
	CreatedAt time.Time `json:"createdAt"`
}
