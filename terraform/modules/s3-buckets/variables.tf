variable "buckets" {
  description = "Map of S3 buckets to create"
  type = map(object({
    name                = string
    versioning_enabled  = bool
    force_destroy       = bool
    tags                = map(string)
    lifecycle_rules = optional(list(object({
      id              = string
      enabled         = bool
      expiration_days = optional(number)
      transitions = optional(list(object({
        days          = number
        storage_class = string
      })))
    })))
  }))
}

variable "tags" {
  description = "Common tags to apply to all buckets"
  type        = map(string)
  default     = {}
}
