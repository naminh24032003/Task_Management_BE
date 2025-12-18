terraform {
  backend "s3" {
    bucket         = "task-mgmt-dev-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "task-mgmt-terraform-locks"
  }
}
