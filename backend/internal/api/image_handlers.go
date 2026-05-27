package api

import (
	"crypto/rand"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
)

const uploadDir = "./uploads"
const maxUploadSize = 10 << 20 // 10 MiB

var allowedImageTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/gif":  true,
	"image/webp": true,
	"image/svg+xml": true,
}

func init() {
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		panic("failed to create uploads directory: " + err.Error())
	}
}

func (a *API) handleUploadImage(c *fiber.Ctx) error {
	file, err := c.FormFile("image")
	if err != nil {
		return respondError(c, fiber.StatusBadRequest, "missing image file")
	}
	if file.Size > maxUploadSize {
		return respondError(c, fiber.StatusBadRequest, "图片不能超过 10MB")
	}
	contentType := file.Header.Get("Content-Type")
	if !allowedImageTypes[contentType] {
		return respondError(c, fiber.StatusBadRequest, "不支持的图片格式，仅支持 PNG/JPEG/GIF/WebP/SVG")
	}
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = extensionFromContentType(contentType)
	}
	if !validImageExt(ext) {
		return respondError(c, fiber.StatusBadRequest, "不支持的图片扩展名")
	}
	filename, err := randFilename(ext)
	if err != nil {
		return err
	}
	dst, err := os.Create(filepath.Join(uploadDir, filename))
	if err != nil {
		return err
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		return err
	}
	url := "/api/uploads/" + filename
	md := "![](" + url + ")"
	return respondData(c, fiber.Map{"url": url, "markdown": md})
}

func extensionFromContentType(ct string) string {
	switch ct {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "image/svg+xml":
		return ".svg"
	}
	return ""
}

func validImageExt(ext string) bool {
	switch strings.ToLower(ext) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg":
		return true
	}
	return false
}

func randFilename(ext string) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x%s", b, ext), nil
}

func (a *API) handleCleanupOrphanedImages(c *fiber.Ctx) error {
	entries, err := os.ReadDir(uploadDir)
	if err != nil {
		return err
	}
	deleted := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		filename := entry.Name()
		if !validImageExt(filepath.Ext(filename)) {
			continue
		}

		var count int
		a.DB.QueryRow(`SELECT COUNT(*) FROM space_problems WHERE statement_md LIKE '%'||?||'%' OR body_json LIKE '%'||?||'%' OR answer_json LIKE '%'||?||'%'`, filename, filename, filename).Scan(&count)
		if count > 0 {
			continue
		}

		a.DB.QueryRow(`SELECT COUNT(*) FROM image_tag_links WHERE image_url LIKE '%'||?||'%'`, filename).Scan(&count)
		if count > 0 {
			continue
		}

		os.Remove(filepath.Join(uploadDir, filename))
		deleted++
	}
	return respondData(c, fiber.Map{"deleted": deleted})
}

func validateSingleFile(upload *multipart.FileHeader, maxBytes int64, allowed map[string]bool) error {
	if upload.Size > maxBytes {
		return fmt.Errorf("文件超过大小限制")
	}
	ct := upload.Header.Get("Content-Type")
	if !allowed[ct] {
		return fmt.Errorf("不支持的文件类型: %s", ct)
	}
	return nil
}
