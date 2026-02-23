package pagination

const (
	// DefaultLimit is the default number of items per page
	DefaultLimit int32 = 20
	// MaxLimit is the maximum number of items per page
	MaxLimit int32 = 100
)

// CursorRequest represents a cursor-based pagination request
type CursorRequest struct {
	Cursor   string
	Limit    int32
	SortBy   string
	SortDesc bool
}

// CursorResponse represents a cursor-based pagination response
type CursorResponse[T any] struct {
	Items      []T    `json:"items"`
	NextCursor string `json:"next_cursor"`
	HasMore    bool   `json:"has_more"`
	TotalCount int64  `json:"total_count"`
}

// NormalizeLimit ensures the limit is within valid bounds
func NormalizeLimit(limit int32) int32 {
	if limit <= 0 {
		return DefaultLimit
	}
	if limit > MaxLimit {
		return MaxLimit
	}
	return limit
}
