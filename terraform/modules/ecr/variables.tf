variable "project_name" {
  description = "Project name prefix for ECR repos"
  type        = string
  default     = "task-management"
}

variable "service_names" {
  description = "List of microservice names"
  type        = list(string)
  default     = ["user-service", "task-service", "notification-service", "bff-service"]
}

variable "scan_on_push" {
  description = "Enable image scanning on push"
  type        = bool
  default     = true
}

variable "image_retention_count" {
  description = "Number of images to retain per repo"
  type        = number
  default     = 10
}

variable "force_delete" {
  description = "Force delete repos even with images"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags"
  type        = map(string)
  default     = {}
}
