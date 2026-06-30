package api

import (
	"database/sql"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type directoryPayload struct {
	Name     string `json:"name"`
	ParentID *int64 `json:"parentId"`
	OrderNo  int    `json:"orderNo"`
}

type problemDirectoryPayload struct {
	DirectoryID *int64 `json:"directoryId"`
}

func (a *API) handleListProblemDirectories(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}

	rows, err := a.DB.Query(`
	SELECT id, name, COALESCE(parent_id, 0), order_no, created_at
	FROM problem_directories
	WHERE space_id=?
	ORDER BY order_no ASC, id ASC`, spaceID)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]fiber.Map, 0)
	for rows.Next() {
		var id, parentID, orderNo int64
		var name string
		var createdAt interface{}
		if err := rows.Scan(&id, &name, &parentID, &orderNo, &createdAt); err != nil {
			return err
		}
		var parentIDPtr *int64
		if parentID > 0 {
			parentIDPtr = &parentID
		}
		items = append(items, fiber.Map{
			"id":        id,
			"name":      name,
			"parentId":  parentIDPtr,
			"orderNo":   orderNo,
			"createdAt": createdAt,
		})
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return respondData(c, items)
}

func (a *API) handleCreateProblemDirectory(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}

	var req directoryPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return respondError(c, fiber.StatusBadRequest, "name required")
	}

	// Get next order_no for the parent
	var maxOrder sql.NullInt64
	err = a.DB.QueryRow(`
	SELECT MAX(order_no) FROM problem_directories WHERE space_id=? AND COALESCE(parent_id, 0)=COALESCE(?, 0)`,
		spaceID, req.ParentID).Scan(&maxOrder)
	if err != nil {
		return err
	}
	orderNo := 0
	if maxOrder.Valid {
		orderNo = int(maxOrder.Int64) + 1
	}

	res, err := a.DB.Exec(`
	INSERT INTO problem_directories(space_id, name, parent_id, order_no)
	VALUES(?, ?, ?, ?)`, spaceID, req.Name, req.ParentID, orderNo)
	if err != nil {
		return err
	}
	dirID, _ := res.LastInsertId()
	return respondData(c, fiber.Map{"id": dirID, "name": req.Name, "parentId": req.ParentID, "orderNo": orderNo})
}

func (a *API) handleUpdateProblemDirectory(c *fiber.Ctx) error {
	dirID, err := parseIDParam(c, "dirId")
	if err != nil {
		return err
	}

	var req directoryPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}
	req.Name = strings.TrimSpace(req.Name)

	// Build dynamic UPDATE
	setClauses := make([]string, 0)
	args := make([]interface{}, 0)
	if req.Name != "" {
		setClauses = append(setClauses, "name=?")
		args = append(args, req.Name)
	}
	if req.ParentID != nil {
		if *req.ParentID == dirID {
			return respondError(c, fiber.StatusBadRequest, "cannot move directory into itself")
		}
		setClauses = append(setClauses, "parent_id=?")
		args = append(args, *req.ParentID)
	}
	if req.OrderNo != 0 {
		setClauses = append(setClauses, "order_no=?")
		args = append(args, req.OrderNo)
	}
	if len(setClauses) == 0 {
		return respondError(c, fiber.StatusBadRequest, "nothing to update")
	}
	args = append(args, dirID)

	_, err = a.DB.Exec(`
	UPDATE problem_directories
	SET `+strings.Join(setClauses, ", ")+`
	WHERE id=?`, args...)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleDeleteProblemDirectory(c *fiber.Ctx) error {
	dirID, err := parseIDParam(c, "dirId")
	if err != nil {
		return err
	}

	// Get the space_id of this directory to scope children
	var spaceID int64
	err = a.DB.QueryRow(`SELECT space_id FROM problem_directories WHERE id=?`, dirID).Scan(&spaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return respondError(c, fiber.StatusNotFound, "directory not found")
		}
		return err
	}

	tx, err := a.DB.BeginTx(c.Context(), nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Move child directories to parent (or make them root)
	_, err = tx.Exec(`
		UPDATE problem_directories
		SET parent_id = (SELECT parent_id FROM problem_directories WHERE id=?)
		WHERE parent_id=? AND space_id=?`, dirID, dirID, spaceID)
	if err != nil {
		return err
	}

	// Move problems in this directory to uncategorized (NULL directory_id)
	_, err = tx.Exec(`UPDATE space_problems SET directory_id=NULL WHERE directory_id=? AND space_id=?`, dirID, spaceID)
	if err != nil {
		return err
	}

	// Delete the directory
	res, err := tx.Exec(`DELETE FROM problem_directories WHERE id=?`, dirID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return respondError(c, fiber.StatusNotFound, "directory not found")
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}

func (a *API) handleUpdateProblemDirectoryID(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	problemID, err := parseIDParam(c, "problemId")
	if err != nil {
		return err
	}

	var req problemDirectoryPayload
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	_, err = a.DB.Exec(`UPDATE space_problems SET directory_id=? WHERE id=? AND space_id=?`, req.DirectoryID, problemID, spaceID)
	if err != nil {
		return err
	}
	return respondData(c, fiber.Map{"ok": true})
}
