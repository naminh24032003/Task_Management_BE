output "bucket_ids" {
  description = "Map of bucket names to IDs"
  value       = { for k, v in aws_s3_bucket.main : k => v.id }
}

output "bucket_arns" {
  description = "Map of bucket names to ARNs"
  value       = { for k, v in aws_s3_bucket.main : k => v.arn }
}
