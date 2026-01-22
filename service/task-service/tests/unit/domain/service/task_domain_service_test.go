package service_test

import (
	"context"
	"task-service/internal/domain/service"
	"testing"
)

func TestValidateTaskCreation(t *testing.T) {
	svc := service.NewTaskDomainService(nil) // Repo not needed for title/projectId validation

	tests := []struct {
		name      string
		title     string
		projectID string
		wantErr   bool
	}{
		{"valid", "Task 1", "proj-1", false},
		{"empty title", "", "proj-1", true},
		{"empty project", "Task 1", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := svc.ValidateTaskCreation(context.Background(), tt.title, tt.projectID)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateTaskCreation() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
