package api

import (
	"net/http"
	"strconv"
	"testing"
)

func TestSpaceAdminListSearchAndDeleteMembers(t *testing.T) {
	app, database := newTestApp(t, false)

	spaceAdminID := seedUser(t, database, "space_member_admin", "memberadmin123")
	memberID := seedUser(t, database, "space_member_existing", "memberexisting123")
	candidateID := seedUser(t, database, "space_member_candidate", "membercandidate123")
	otherID := seedUser(t, database, "another_user", "anotheruser123")

	spaceID := mustCreateSpace(t, database, "Space-Members-Manage")
	mustAddMember(t, database, spaceID, spaceAdminID, "space_admin")
	mustAddMember(t, database, spaceID, memberID, "member")

	cookie := mustLogin(t, app, "space_member_admin", "memberadmin123")

	listResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/members", cookie, nil)
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("expected list 200, got %d", listResp.StatusCode)
	}
	listEnv := decodeEnvelope[[]map[string]interface{}](t, listResp)
	if len(listEnv.Data) != 2 {
		t.Fatalf("expected 2 initial members, got %d", len(listEnv.Data))
	}
	if int64(listEnv.Data[0]["userId"].(float64)) != spaceAdminID {
		t.Fatalf("expected first member to be the space admin, got %+v", listEnv.Data[0])
	}

	searchResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/member-candidates?q=space_member_can", cookie, nil)
	if searchResp.StatusCode != http.StatusOK {
		t.Fatalf("expected search 200, got %d", searchResp.StatusCode)
	}
	searchEnv := decodeEnvelope[[]map[string]interface{}](t, searchResp)
	if len(searchEnv.Data) != 1 {
		t.Fatalf("expected 1 search candidate, got %d: %+v", len(searchEnv.Data), searchEnv.Data)
	}
	if int64(searchEnv.Data[0]["id"].(float64)) != candidateID {
		t.Fatalf("expected candidate id %d, got %+v", candidateID, searchEnv.Data[0])
	}

	addResp := doJSONRequest(t, app, http.MethodPost, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/members", cookie, map[string]interface{}{
		"userId": candidateID,
		"role":   "member",
	})
	if addResp.StatusCode != http.StatusOK {
		t.Fatalf("expected add 200, got %d", addResp.StatusCode)
	}
	addResp.Body.Close()

	verifyResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/members", cookie, nil)
	if verifyResp.StatusCode != http.StatusOK {
		t.Fatalf("expected verify list 200, got %d", verifyResp.StatusCode)
	}
	verifyEnv := decodeEnvelope[[]map[string]interface{}](t, verifyResp)
	if len(verifyEnv.Data) != 3 {
		t.Fatalf("expected 3 members after add, got %d", len(verifyEnv.Data))
	}

	deleteResp := doJSONRequest(t, app, http.MethodDelete, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/members/"+strconv.FormatInt(candidateID, 10), cookie, nil)
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected delete 200, got %d", deleteResp.StatusCode)
	}
	deleteResp.Body.Close()

	finalResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/members", cookie, nil)
	if finalResp.StatusCode != http.StatusOK {
		t.Fatalf("expected final list 200, got %d", finalResp.StatusCode)
	}
	finalEnv := decodeEnvelope[[]map[string]interface{}](t, finalResp)
	if len(finalEnv.Data) != 2 {
		t.Fatalf("expected 2 members after delete, got %d", len(finalEnv.Data))
	}

	searchByIDResp := doJSONRequest(t, app, http.MethodGet, "/api/spaces/"+strconv.FormatInt(spaceID, 10)+"/member-candidates?q="+strconv.FormatInt(otherID, 10), cookie, nil)
	if searchByIDResp.StatusCode != http.StatusOK {
		t.Fatalf("expected search-by-id 200, got %d", searchByIDResp.StatusCode)
	}
	searchByIDEnv := decodeEnvelope[[]map[string]interface{}](t, searchByIDResp)
	if len(searchByIDEnv.Data) != 1 || int64(searchByIDEnv.Data[0]["id"].(float64)) != otherID {
		t.Fatalf("expected candidate otherID=%d, got %+v", otherID, searchByIDEnv.Data)
	}
}

