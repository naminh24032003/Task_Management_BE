# =============================================================================
# Dev Environment - Terraform Backend (S3 + DynamoDB)
# =============================================================================
# Before running terraform init, you must create these manually:
#   1. S3 bucket: task-management-terraform-state
#   2. DynamoDB table: task-management-terraform-locks (partition key: LockID)
#
# aws s3 mb s3://task-management-terraform-state --region ap-southeast-1
# aws dynamodb create-table \
#   --table-name task-management-terraform-locks \
#   --attribute-definitions AttributeName=LockID,AttributeType=S \
#   --key-schema AttributeName=LockID,KeyType=HASH \
#   --billing-mode PAY_PER_REQUEST \
#   --region ap-southeast-1
# =============================================================================

terraform {
  backend "s3" {
    bucket         = "task-management-terraform-state"
    key            = "environments/dev/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "task-management-terraform-locks"
    encrypt        = true
  }
}
