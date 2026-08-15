package api

import (
	"sort"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// handleGetProblemDirectoryCounts 返回空间内每个目录下的题目数量与未分类数量。
// 返回格式：{ "counts": { "<dirId>": n, ... }, "uncategorized": n }
func (a *API) handleGetProblemDirectoryCounts(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	rows, err := a.DB.Query(`
SELECT COALESCE(directory_id, 0), COUNT(*)
FROM space_problems
WHERE space_id=?
GROUP BY COALESCE(directory_id, 0)`, spaceID)
	if err != nil {
		return err
	}
	defer rows.Close()

	counts := make(map[string]int64)
	uncategorized := int64(0)
	for rows.Next() {
		var dirID, count int64
		if err := rows.Scan(&dirID, &count); err != nil {
			return err
		}
		if dirID == 0 {
			uncategorized = count
		} else {
			counts[strconv.FormatInt(dirID, 10)] = count
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return respondData(c, fiber.Map{"counts": counts, "uncategorized": uncategorized})
}

type problemTagCount struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}

// handleGetProblemTags 返回空间内全部题目标签及出现次数（次数降序、名称升序）。
func (a *API) handleGetProblemTags(c *fiber.Ctx) error {
	spaceID, err := parseIDParam(c, "spaceId")
	if err != nil {
		return err
	}
	rows, err := a.DB.Query(`SELECT tags_json FROM space_problems WHERE space_id=?`, spaceID)
	if err != nil {
		return err
	}
	defer rows.Close()

	agg := make(map[string]int64)
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return err
		}
		for _, tag := range decodeProblemTags(raw) {
			agg[tag]++
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	list := make([]problemTagCount, 0, len(agg))
	for tag, count := range agg {
		list = append(list, problemTagCount{Tag: tag, Count: count})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Count != list[j].Count {
			return list[i].Count > list[j].Count
		}
		return list[i].Tag < list[j].Tag
	})
	return respondData(c, list)
}
