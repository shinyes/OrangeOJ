package api

import (
	"time"

	"orangeoj/backend/internal/model"

	"github.com/gofiber/fiber/v2"
)

// ImageTagResponse 标签响应结构
type ImageTagResponse struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedBy int64     `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

// ImageTagLinkResponse 标签关联响应结构
type ImageTagLinkResponse struct {
	ImageURL string             `json:"imageUrl"`
	Tags     []ImageTagResponse `json:"tags"`
}

// CreateImageTag 创建新标签
// POST /api/image-tags
func (a *API) CreateImageTag(c *fiber.Ctx) error {
	user, err := getUser(c)
	if err != nil {
		return respondError(c, fiber.StatusUnauthorized, "authentication required")
	}

	var req struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	if req.Name == "" {
		return respondError(c, fiber.StatusBadRequest, "name is required")
	}

	if req.Color == "" {
		req.Color = "#3498db"
	}

	tx, err := a.DB.Begin()
	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "database error")
	}
	defer tx.Rollback()

	var tagID int64
	err = tx.QueryRow(`
		INSERT INTO image_tags (name, color, created_by, created_at)
		VALUES (?, ?, ?, ?)
	`, req.Name, req.Color, user.ID, time.Now()).Scan(&tagID)

	if err != nil {
		if isUniqueErr(err) {
			return respondError(c, fiber.StatusConflict, "tag name already exists")
		}
		return respondError(c, fiber.StatusInternalServerError, "failed to create tag")
	}

	var tag model.ImageTag
	err = tx.QueryRow(`
		SELECT id, name, color, created_by, created_at
		FROM image_tags WHERE id = ?
	`, tagID).Scan(&tag.ID, &tag.Name, &tag.Color, &tag.CreatedBy, &tag.CreatedAt)

	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "failed to fetch created tag")
	}

	if err := tx.Commit(); err != nil {
		return respondError(c, fiber.StatusInternalServerError, "database error")
	}

	return c.JSON(ImageTagResponse{
		ID:        tag.ID,
		Name:      tag.Name,
		Color:     tag.Color,
		CreatedBy: tag.CreatedBy,
		CreatedAt: tag.CreatedAt,
	})
}

// ListImageTags 获取所有标签
// GET /api/image-tags
func (a *API) ListImageTags(c *fiber.Ctx) error {
	rows, err := a.DB.Query(`
		SELECT id, name, color, created_by, created_at
		FROM image_tags
		ORDER BY name
	`)
	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "database error")
	}
	defer rows.Close()

	tags := []ImageTagResponse{}
	for rows.Next() {
		var tag ImageTagResponse
		if err := rows.Scan(&tag.ID, &tag.Name, &tag.Color, &tag.CreatedBy, &tag.CreatedAt); err != nil {
			continue
		}
		tags = append(tags, tag)
	}

	return c.JSON(tags)
}

// DeleteImageTag 删除标签
// DELETE /api/image-tags/:id
func (a *API) DeleteImageTag(c *fiber.Ctx) error {
	_, err := getUser(c)
	if err != nil {
		return respondError(c, fiber.StatusUnauthorized, "authentication required")
	}

	tagID, err := c.ParamsInt("id")
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid tag id")
	}

	_, err = a.DB.Exec(`DELETE FROM image_tags WHERE id = ?`, tagID)
	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "failed to delete tag")
	}

	return c.SendStatus(204)
}

// LinkImageTag 为图片添加标签
// POST /api/image-tags/link
func (a *API) LinkImageTag(c *fiber.Ctx) error {
	_, err := getUser(c)
	if err != nil {
		return respondError(c, fiber.StatusUnauthorized, "authentication required")
	}

	var req struct {
		ImageURL string `json:"imageUrl"`
		TagID    int64  `json:"tagId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	if req.ImageURL == "" || req.TagID == 0 {
		return respondError(c, fiber.StatusBadRequest, "imageUrl and tagId are required")
	}

	// Verify tag exists
	var tagExists int
	err = a.DB.QueryRow(`SELECT COUNT(*) FROM image_tags WHERE id = ?`, req.TagID).Scan(&tagExists)
	if err != nil || tagExists == 0 {
		return respondError(c, fiber.StatusNotFound, "tag not found")
	}

	_, err = a.DB.Exec(`
		INSERT OR IGNORE INTO image_tag_links (image_url, tag_id, created_at)
		VALUES (?, ?, ?)
	`, req.ImageURL, req.TagID, time.Now())

	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "failed to link tag")
	}

	return c.SendStatus(204)
}

// UnlinkImageTag 移除图片的标签
// DELETE /api/image-tags/unlink
func (a *API) UnlinkImageTag(c *fiber.Ctx) error {
	_, err := getUser(c)
	if err != nil {
		return respondError(c, fiber.StatusUnauthorized, "authentication required")
	}

	var req struct {
		ImageURL string `json:"imageUrl"`
		TagID    int64  `json:"tagId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid request")
	}

	if req.ImageURL == "" || req.TagID == 0 {
		return respondError(c, fiber.StatusBadRequest, "imageUrl and tagId are required")
	}

	_, err = a.DB.Exec(`
		DELETE FROM image_tag_links
		WHERE image_url = ? AND tag_id = ?
	`, req.ImageURL, req.TagID)

	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "failed to unlink tag")
	}

	return c.SendStatus(204)
}

// GetImageTags 获取图片的所有标签
// GET /api/image-tags/image/:imageUrl
func (a *API) GetImageTags(c *fiber.Ctx) error {
	imageURL := c.Params("imageUrl")
	if imageURL == "" {
		return respondError(c, fiber.StatusBadRequest, "imageUrl is required")
	}

	rows, err := a.DB.Query(`
		SELECT t.id, t.name, t.color, t.created_by, t.created_at
		FROM image_tags t
		INNER JOIN image_tag_links l ON t.id = l.tag_id
		WHERE l.image_url = ?
		ORDER BY t.name
	`, imageURL)

	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "database error")
	}
	defer rows.Close()

	tags := []ImageTagResponse{}
	for rows.Next() {
		var tag ImageTagResponse
		if err := rows.Scan(&tag.ID, &tag.Name, &tag.Color, &tag.CreatedBy, &tag.CreatedAt); err != nil {
			continue
		}
		tags = append(tags, tag)
	}

	return c.JSON(ImageTagLinkResponse{
		ImageURL: imageURL,
		Tags:     tags,
	})
}

// GetImagesByTag 获取带有指定标签的所有图片
// GET /api/image-tags/tag/:id/images
func (a *API) GetImagesByTag(c *fiber.Ctx) error {
	tagID, err := c.ParamsInt("id")
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, "invalid tag id")
	}

	rows, err := a.DB.Query(`
		SELECT l.image_url
		FROM image_tag_links l
		WHERE l.tag_id = ?
		ORDER BY l.created_at DESC
	`, tagID)

	if err != nil {
		return respondError(c, fiber.StatusInternalServerError, "database error")
	}
	defer rows.Close()

	images := []string{}
	for rows.Next() {
		var imageURL string
		if err := rows.Scan(&imageURL); err != nil {
			continue
		}
		images = append(images, imageURL)
	}

	return c.JSON(images)
}
