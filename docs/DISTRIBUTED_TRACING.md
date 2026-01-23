# Distributed Tracing Setup

This document describes how to setup and use distributed tracing with OpenTelemetry and Grafana Tempo for measuring latency from Kong to MongoDB.

## Architecture Overview

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│    Kong     │───▶│ BFF Service │───▶│ User Service │───▶│   MongoDB   │
│  (Gateway)  │    │  (GraphQL)  │    │   (gRPC)     │    │  (Database) │
└──────┬──────┘    └──────┬──────┘    └──────┬───────┘    └─────────────┘
       │                  │                  │
       │   W3C Trace      │   W3C Trace      │
       │   Context        │   Context        │
       ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    OpenTelemetry Collector                            │
│                    (otel-collector.tracing:4317)                     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   Grafana Tempo     │
                    │ (tempo.tracing:3200)│
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Grafana        │
                    │   (Trace View UI)   │
                    └─────────────────────┘
```

## Components

### 1. OpenTelemetry SDK (Services)
Automatically instruments:
- **HTTP requests** (Kong → BFF)
- **GraphQL operations** (BFF)
- **gRPC calls** (BFF → User Service)
- **MongoDB queries** (User Service → DB)
- **Redis operations** (caching)

### 2. OpenTelemetry Collector
Central hub that:
- Receives traces from all services via OTLP (gRPC/HTTP)
- Batches and processes traces
- Exports to Grafana Tempo

### 3. Grafana Tempo
Trace storage backend that:
- Stores all distributed traces
- Provides query API for Grafana
- Correlates traces with service topology

### 4. Kong OpenTelemetry Plugin
Generates trace context for incoming requests and propagates W3C trace headers.

## Deployment

### Step 1: Deploy Tracing Infrastructure

```powershell
# From project root
.\scripts\deploy-tracing.ps1
```

This deploys:
- Grafana Tempo (trace storage)
- OpenTelemetry Collector (trace aggregator)

### Step 2: Configure Grafana Data Source

1. Port-forward to Grafana:
   ```bash
   kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-grafana 3000:80
   ```

2. Login to Grafana (http://localhost:3000)
   - Username: `admin`
   - Password: `prom-operator`

3. Add Tempo Data Source:
   - Go to **Configuration > Data Sources**
   - Click **Add data source**
   - Select **Tempo**
   - Set URL: `http://tempo.tracing.svc.cluster.local:3200`
   - Click **Save & Test**

### Step 3: Enable Kong OpenTelemetry Plugin

```yaml
# Apply Kong plugin configuration
kubectl apply -f - <<EOF
apiVersion: configuration.konghq.com/v1
kind: KongClusterPlugin
metadata:
  name: opentelemetry-tracing
  annotations:
    kubernetes.io/ingress.class: kong
  labels:
    global: "true"
config:
  endpoint: "http://otel-collector.tracing.svc.cluster.local:4318/v1/traces"
  resource_attributes:
    service.name: kong-gateway
  header_type: "w3c"
  batch_span_count: 200
  batch_flush_delay: 3
plugin: opentelemetry
EOF
```

### Step 4: Rebuild Services

```bash
# Rebuild with tracing enabled
npm install  # Install OpenTelemetry packages

# Build Docker images
docker build -t user-service:trace -f service/user-service/Dockerfile .
docker build -t bff-service:trace -f service/bff-service/Dockerfile .

# Push to registry and redeploy
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | `user-service` / `bff-service` | Service name in traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector.tracing:4317` | OTLP collector endpoint |
| `OTEL_TRACES_SAMPLER` | `always_on` | Trace sampling strategy |
| `OTEL_DEBUG` | `false` | Enable debug logging |

## Viewing Traces

### Via Grafana UI

1. Open Grafana → **Explore**
2. Select **Tempo** data source
3. Use **Search** or **TraceQL**:

```traceql
# Find traces for register operation
{ service.name = "user-service" && name =~ ".*Register.*" }

# Find slow traces (> 500ms)
{ duration > 500ms }

# Find traces with errors
{ status = error }
```

### Understanding Trace Data

Each trace shows:
- **Total Duration**: Kong → DB round trip time
- **Span Breakdown**:
  - `kong-gateway`: Time at API gateway
  - `bff-service.graphql`: GraphQL processing
  - `bff-service.grpc.UserService/RegisterUser`: gRPC call to user service
  - `user-service.grpc.handler`: gRPC request handling
  - `user-service.db.users.insertOne`: MongoDB write operation

### Example: Register User Flow

```
├─ kong-gateway [2ms]
│  └─ bff-service.POST /graphql [150ms]
│     └─ graphql.mutation.register [145ms]
│        └─ grpc.UserService/RegisterUser [140ms]
│           ├─ user-service.handler.RegisterUser [135ms]
│           │  ├─ db.users.findOne (check existing) [15ms]
│           │  ├─ bcrypt.hash [80ms]
│           │  └─ db.users.insertOne [35ms]
│           └─ db.connection.checkout [2ms]
```

## Custom Spans

For manual span creation in business logic:

```typescript
import { TracingService } from './infrastructure/tracing';

@Injectable()
export class RegisterUserHandler {
  constructor(private readonly tracing: TracingService) {}

  async execute(command: RegisterUserCommand) {
    return this.tracing.createAsyncSpan(
      'RegisterUserHandler.execute',
      async (span) => {
        span.setAttribute('user.email', command.email);
        
        // Trace specific operation
        const hashedPassword = await this.tracing.createAsyncSpan(
          'password.hash',
          async () => bcrypt.hash(command.password, 10),
          { 'bcrypt.rounds': 10 }
        );
        
        // ... rest of logic
      },
      { 'command.type': 'RegisterUser' }
    );
  }
}
```

## Troubleshooting

### No Traces Appearing

1. Check OTEL Collector is running:
   ```bash
   kubectl get pods -n tracing
   kubectl logs -n tracing -l app=otel-collector
   ```

2. Check service is exporting traces:
   ```bash
   kubectl logs <pod-name> | grep -i "opentelemetry\|otel\|trace"
   ```

3. Verify endpoint connectivity:
   ```bash
   kubectl exec <pod-name> -- wget -qO- http://otel-collector.tracing:4317
   ```

### High Latency in Traces

- Check MongoDB indexes
- Check gRPC connection pooling
- Review slow span attributes

## Performance Considerations

- **Sampling**: For production, consider probabilistic sampling:
  ```env
  OTEL_TRACES_SAMPLER=parentbased_traceidratio
  OTEL_TRACES_SAMPLER_ARG=0.1  # 10% sampling
  ```
  
- **Batch Size**: Adjust based on traffic:
  ```yaml
  batch_span_count: 200
  batch_flush_delay: 3
  ```

## Related Links

- [OpenTelemetry for Node.js](https://opentelemetry.io/docs/instrumentation/js/)
- [Grafana Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [Kong OpenTelemetry Plugin](https://docs.konghq.com/hub/kong-inc/opentelemetry/)
