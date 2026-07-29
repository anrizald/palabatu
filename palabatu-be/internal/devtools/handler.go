package devtools

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"palabatu-be/internal/middleware"
)

// Routes registers the devtools domain's routes on the /api group, all
// behind RequireAuth+RequireOwner via one Group call rather than repeating
// the chain on every route -- see middleware.RequireOwner's doc comment for
// why this isn't the same Council/Associate gate internal/report uses.
func Routes(rg *gin.RouterGroup) {
	dev := rg.Group("/dev", middleware.RequireAuth, middleware.RequireOwner)

	dev.GET("/export/:table", handleExport)
	dev.GET("/analytics", handleAnalytics)
	dev.GET("/testers/search", handleSearchTesters)
	dev.POST("/testers/:id/toggle", handleToggleTester)
}

func handleExport(c *gin.Context) {
	table := c.Param("table")

	data, err := Export(c.Request.Context(), table)
	switch {
	case err == nil:
	case errors.Is(err, ErrInvalidTable):
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid export table"})
		return
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}

	if c.Query("format") != "csv" {
		c.JSON(http.StatusOK, data)
		return
	}

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.csv"`, table))
	_ = writeCSV(c.Writer, data)
}

// writeCSV renders any slice-of-struct export type as CSV, using each
// field's json tag as its header -- shared across all five export types
// instead of a bespoke writer per type, since they only ever differ in
// shape, not in how they need to be written.
func writeCSV(w io.Writer, data any) error {
	v := reflect.ValueOf(data)
	if v.Kind() != reflect.Slice {
		return fmt.Errorf("writeCSV: expected a slice, got %s", v.Kind())
	}

	cw := csv.NewWriter(w)
	defer cw.Flush()

	elemType := v.Type().Elem()
	headers := make([]string, elemType.NumField())
	for i := range headers {
		headers[i] = csvFieldName(elemType.Field(i))
	}
	if err := cw.Write(headers); err != nil {
		return err
	}

	for i := 0; i < v.Len(); i++ {
		item := v.Index(i)
		row := make([]string, elemType.NumField())
		for j := range row {
			row[j] = csvCellString(item.Field(j).Interface())
		}
		if err := cw.Write(row); err != nil {
			return err
		}
	}
	return nil
}

func csvFieldName(f reflect.StructField) string {
	name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
	if name == "" {
		return f.Name
	}
	return name
}

func csvCellString(v any) string {
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Ptr {
		if rv.IsNil() {
			return ""
		}
		v = rv.Elem().Interface()
	}
	switch t := v.(type) {
	case time.Time:
		return t.Format(time.RFC3339)
	case []string:
		return strings.Join(t, ";")
	default:
		return fmt.Sprint(t)
	}
}

func handleAnalytics(c *gin.Context) {
	data, err := GetAnalytics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, data)
}

func handleSearchTesters(c *gin.Context) {
	candidates, err := SearchTesterCandidates(c.Request.Context(), c.Query("q"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
		return
	}
	c.JSON(http.StatusOK, candidates)
}

func handleToggleTester(c *gin.Context) {
	isTester, err := ToggleTester(c.Request.Context(), c.Param("id"))
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"is_tester": isTester})
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server error"})
	}
}
