docker build -t task-service:v2 -f service/task-service/Dockerfile .
minikube image load task-service:v2
kubectl set image deployment/task-service task-service=task-service:v2 -n dev
kubectl rollout restart deployment/task-service -n dev
kubectl rollout status deployment/task-service -n dev
