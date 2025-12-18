package query

// GetUserQuery represents a query to get user by ID
type GetUserQuery struct {
	UserID string
}

// NewGetUserQuery creates a new query
func NewGetUserQuery(userID string) *GetUserQuery {
	return &GetUserQuery{
		UserID: userID,
	}
}

// GetUserByEmailQuery represents a query to get user by email
type GetUserByEmailQuery struct {
	Email string
}

// NewGetUserByEmailQuery creates a new query
func NewGetUserByEmailQuery(email string) *GetUserByEmailQuery {
	return &GetUserByEmailQuery{
		Email: email,
	}
}

// ListUsersQuery represents a query to list users with pagination
type ListUsersQuery struct {
	Offset int
	Limit  int
}

// NewListUsersQuery creates a new query
func NewListUsersQuery(offset, limit int) *ListUsersQuery {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return &ListUsersQuery{
		Offset: offset,
		Limit:  limit,
	}
}
