package api

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// problemListFilter 题目列表的过滤条件。
// DirID: 0=全部, -1=未分类（directory_id IS NULL）, >0=指定目录。
// Tags 为 AND 语义：题目必须同时包含全部标签（json_each 精确匹配）。
// Keyword 对标题 / 题目 ID 做模糊搜索。
type problemListFilter struct {
	DirID   int64
	Tags    []string
	Keyword string
}

// parseProblemListFilter 从查询参数解析过滤条件：dirId / tags（逗号分隔）/ q。
func parseProblemListFilter(c *fiber.Ctx) problemListFilter {
	f := problemListFilter{DirID: int64(c.QueryInt("dirId", 0))}
	if f.DirID < -1 {
		f.DirID = 0
	}
	if tagsRaw := strings.TrimSpace(c.Query("tags")); tagsRaw != "" {
		for _, part := range strings.Split(tagsRaw, ",") {
			tag := strings.TrimSpace(part)
			if tag != "" {
				f.Tags = append(f.Tags, tag)
			}
		}
	}
	f.Keyword = strings.TrimSpace(c.Query("q"))
	return f
}

// buildProblemFilterSQL 构建 WHERE 子句（不含 WHERE 关键字，首段固定为 p.space_id=?）与对应参数。
func buildProblemFilterSQL(spaceID int64, f problemListFilter) (string, []interface{}) {
	where := "p.space_id=?"
	args := []interface{}{spaceID}
	switch {
	case f.DirID == -1:
		where += " AND p.directory_id IS NULL"
	case f.DirID > 0:
		where += " AND p.directory_id=?"
		args = append(args, f.DirID)
	}
	for _, tag := range f.Tags {
		where += ` AND EXISTS (SELECT 1 FROM json_each(p.tags_json) WHERE json_each.value=?)`
		args = append(args, tag)
	}
	if f.Keyword != "" {
		like := "%" + f.Keyword + "%"
		where += " AND (p.title LIKE ? OR CAST(p.id AS TEXT) LIKE ?)"
		args = append(args, like, like)
	}
	return where, args
}
