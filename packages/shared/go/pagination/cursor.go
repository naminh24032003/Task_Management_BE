package pagination

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
)

// cursorData holds the internal cursor state
type cursorData struct {
	ID    string `json:"id"`
	Value string `json:"value"`
}

// EncodeCursor encodes a document ID and sort field value into a base64 cursor string
func EncodeCursor(id string, sortValue string) string {
	data := cursorData{
		ID:    id,
		Value: sortValue,
	}

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return ""
	}

	return base64.URLEncoding.EncodeToString(jsonBytes)
}

// DecodeCursor decodes a base64 cursor string back into document ID and sort field value
func DecodeCursor(cursor string) (id string, sortValue string, err error) {
	if cursor == "" {
		return "", "", fmt.Errorf("empty cursor")
	}

	jsonBytes, err := base64.URLEncoding.DecodeString(cursor)
	if err != nil {
		return "", "", fmt.Errorf("invalid cursor encoding: %w", err)
	}

	var data cursorData
	if err := json.Unmarshal(jsonBytes, &data); err != nil {
		return "", "", fmt.Errorf("invalid cursor data: %w", err)
	}

	if data.ID == "" {
		return "", "", fmt.Errorf("cursor missing document ID")
	}

	return data.ID, data.Value, nil
}
