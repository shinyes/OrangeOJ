package api

import "testing"

func TestEvaluateObjectiveAnswer(t *testing.T) {
	ok, err := evaluateObjectiveAnswer("single_choice", `{"answer":"B"}`, "b")
	if err != nil {
		t.Fatalf("single choice error: %v", err)
	}
	if !ok {
		t.Fatalf("expected single choice answer to be correct")
	}

	ok, err = evaluateObjectiveAnswer("true_false", `{"answer":true}`, false)
	if err != nil {
		t.Fatalf("true false error: %v", err)
	}
	if ok {
		t.Fatalf("expected true/false answer to be wrong")
	}
}
