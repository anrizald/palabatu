// Package cloudinary streams problem/avatar images to Cloudinary and
// destroys them by their stored URL, mirroring the cloudinary.v2 calls in
// palabatu-be/routes/api.ts.
package cloudinary

import (
	"context"
	"io"
	"log"
	"os"
	"regexp"
	"strings"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

var client *cloudinary.Cloudinary

func Connect() {
	cld, err := cloudinary.NewFromParams(
		os.Getenv("CLOUDINARY_CLOUD_NAME"),
		os.Getenv("CLOUDINARY_API_KEY"),
		os.Getenv("CLOUDINARY_API_SECRET"),
	)
	if err != nil {
		log.Fatalf("unable to configure cloudinary: %v", err)
	}
	client = cld
}

// UploadStream uploads file to the given folder and returns its secure URL.
func UploadStream(ctx context.Context, file io.Reader, folder string) (string, error) {
	resp, err := client.Upload.Upload(ctx, file, uploader.UploadParams{Folder: folder})
	if err != nil {
		return "", err
	}
	return resp.SecureURL, nil
}

var versionPrefix = regexp.MustCompile(`^v\d+/`)

// DestroyByURL derives a Cloudinary public_id from a stored secure URL
// (strip everything up to and including "/upload/", drop a leading
// "vNNN/" version segment, drop the file extension) and destroys the
// asset. Mirrors the derive-then-destroy logic in DELETE /problems/:id in
// the Node route. A URL with no "/upload/" segment is left alone.
func DestroyByURL(ctx context.Context, url string) error {
	parts := strings.SplitN(url, "/upload/", 2)
	if len(parts) < 2 {
		return nil
	}

	publicID := versionPrefix.ReplaceAllString(parts[1], "")
	if idx := strings.LastIndex(publicID, "."); idx != -1 {
		publicID = publicID[:idx]
	}

	_, err := client.Upload.Destroy(ctx, uploader.DestroyParams{PublicID: publicID})
	return err
}
