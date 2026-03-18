# Deploying Destink to k3s

This guide walks through deploying the full Destink stack on a single-node k3s cluster with TLS via cert-manager and Let's Encrypt.

**Assumption:** k3s is already installed and running. `kubectl cluster-info` returns a live endpoint.

---

## 1. Prerequisites

Before starting, confirm you have:

- k3s running — `kubectl cluster-info` succeeds
- `helm` v3+ installed — `helm version` returns output
- Docker installed — for building images locally
- A domain name with an A record pointing to your server's public IP
- API keys ready: Anthropic, Exa, Reddit, LinkedIn

Check helm:

```bash
helm version
```

If helm is not installed, see [helm.sh/docs/intro/install](https://helm.sh/docs/intro/install/).

---

## 2. Build and Load Images

Build all three images from the project root:

```bash
docker build -f docker/Dockerfile.web -t destink-web:0.1.0 .
docker build -f docker/Dockerfile.daemon -t destink-daemon:0.1.0 .
docker build -f docker/Dockerfile.jobs -t destink-jobs:0.1.0 .
```

For a single-node cluster, import the images directly into k3s (no registry required):

```bash
docker save destink-web:0.1.0 | sudo k3s ctr images import -
docker save destink-daemon:0.1.0 | sudo k3s ctr images import -
docker save destink-jobs:0.1.0 | sudo k3s ctr images import -
```

Each `k3s ctr images import` prints the image digest when it succeeds.

> **Multi-node clusters:** Push images to a container registry instead. Update `web.image.repository`, `daemon.image.repository`, and `jobs.image.repository` in your values file to the registry path.

---

## 3. Create Namespace

```bash
kubectl create namespace destink
```

---

## 4. Configure Values

Copy the chart's default values and customize for your deployment:

```bash
cp deploy/helm/destink/values.yaml my-values.yaml
```

Edit `my-values.yaml`. The key fields to change:

```yaml
# Set image tags to match what you built
web:
  image:
    repository: destink-web
    tag: "0.1.0"
    pullPolicy: Never        # images were imported locally, never pull

daemon:
  image:
    repository: destink-daemon
    tag: "0.1.0"
    pullPolicy: Never

jobs:
  image:
    repository: destink-jobs
    tag: "0.1.0"
    pullPolicy: Never

# Use the bundled PostgreSQL or point to an external database
postgresql:
  enabled: true              # set false and configure externalDatabase.url for external DB

# Ingress — enable after domain is pointing to your server
ingress:
  enabled: true
  host: "your-domain.com"   # replace with your actual domain
  tls: false                 # set true after cert-manager is configured
  clusterIssuer: "letsencrypt-prod"

# API keys and application secrets — all required
env:
  ANTHROPIC_API_KEY: "sk-ant-..."
  ENCRYPTION_KEY: "a-32-char-random-string"
  EXA_API_KEY: "..."
  REDDIT_CLIENT_ID: "..."
  REDDIT_CLIENT_SECRET: "..."
  LINKEDIN_CLIENT_ID: "..."
  LINKEDIN_CLIENT_SECRET: "..."
  LINKEDIN_REDIRECT_URI: "https://your-domain.com/api/auth/callback/linkedin"
  NEXT_PUBLIC_APP_URL: "https://your-domain.com"
  AUTH_SECRET: "a-random-secret-string"
```

Generate `ENCRYPTION_KEY` and `AUTH_SECRET` with:

```bash
openssl rand -hex 32
```

> **Important:** Do not commit `my-values.yaml` to git. It contains secrets. Add it to `.gitignore`.

---

## 5. Install with Helm

```bash
helm install destink deploy/helm/destink \
  --namespace destink \
  -f my-values.yaml
```

Helm will:
1. Create a Kubernetes Secret from the `env` section in your values
2. Run the database migration Job (a pre-install hook) — waits for it to complete before continuing
3. Create Deployments for `destink-web` and `destink-daemon`
4. Create the CronJobs for publishing, research, and daily summaries
5. Create a Service and Ingress for the web application

---

## 6. Verify Deployment

Check that all pods started:

```bash
kubectl -n destink get pods
```

Check that the migration Job completed:

```bash
kubectl -n destink get jobs
```

The `destink-db-migrate` job should show `1/1` completions.

Wait for the web deployment to become ready:

```bash
kubectl -n destink rollout status deployment/destink-web
kubectl -n destink rollout status deployment/destink-daemon
```

Check web logs to confirm Next.js started:

```bash
kubectl -n destink logs deployment/destink-web
```

Look for output like `ready started server on 0.0.0.0:3021`.

Test the health endpoint with a port-forward:

```bash
kubectl -n destink port-forward svc/destink-web 3021:80
```

In a second terminal:

```bash
curl http://localhost:3021/api/health
```

Expected response: `{"status":"ok"}`. Press `Ctrl+C` to stop the port-forward.

**Troubleshooting pods not starting:** Check pod logs and events:

```bash
kubectl -n destink describe pod <pod-name>
kubectl -n destink logs <pod-name>
```

---

## 7. Configure TLS with cert-manager

Install cert-manager into the cluster:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.17.2/cert-manager.yaml
```

Wait for cert-manager pods to become ready:

```bash
kubectl -n cert-manager rollout status deployment/cert-manager
kubectl -n cert-manager rollout status deployment/cert-manager-webhook
kubectl -n cert-manager rollout status deployment/cert-manager-cainjector
```

Create a ClusterIssuer for Let's Encrypt. Save the following to `letsencrypt-issuer.yaml` — replace the email address:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: traefik
```

Apply the issuer:

```bash
kubectl apply -f letsencrypt-issuer.yaml
```

Verify the issuer is ready:

```bash
kubectl get clusterissuer letsencrypt-prod
```

The `READY` column should show `True`.

Now enable TLS in `my-values.yaml`:

```yaml
ingress:
  enabled: true
  host: "your-domain.com"
  tls: true
  clusterIssuer: "letsencrypt-prod"
```

Upgrade the Helm release to apply the TLS configuration:

```bash
helm upgrade destink deploy/helm/destink \
  --namespace destink \
  -f my-values.yaml
```

cert-manager will automatically request a certificate from Let's Encrypt. Watch it appear:

```bash
kubectl -n destink get certificate
```

Once the certificate shows `READY: True`, HTTPS is active. Visit `https://your-domain.com` to confirm.

---

## 8. Upgrading

When you build new versions of the application:

**1. Build and import new images:**

```bash
docker build -f docker/Dockerfile.web -t destink-web:0.2.0 .
docker build -f docker/Dockerfile.daemon -t destink-daemon:0.2.0 .
docker build -f docker/Dockerfile.jobs -t destink-jobs:0.2.0 .

docker save destink-web:0.2.0 | sudo k3s ctr images import -
docker save destink-daemon:0.2.0 | sudo k3s ctr images import -
docker save destink-jobs:0.2.0 | sudo k3s ctr images import -
```

**2. Update the image tag in `my-values.yaml`:**

```yaml
web:
  image:
    tag: "0.2.0"
daemon:
  image:
    tag: "0.2.0"
jobs:
  image:
    tag: "0.2.0"
```

**3. Run the upgrade:**

```bash
helm upgrade destink deploy/helm/destink \
  -n destink \
  -f my-values.yaml
```

Helm automatically runs the migration Job before updating the Deployments. Zero-downtime rolling update is used for the web and daemon deployments.

---

## 9. Troubleshooting

**Migration Job fails:**

```bash
kubectl -n destink logs job/destink-db-migrate
```

Common causes: wrong `DATABASE_URL` (check the Secret), migration file syntax error, or database not yet accepting connections.

**Web pod not ready (readiness probe failing):**

```bash
kubectl -n destink logs deployment/destink-web
kubectl -n destink describe pod <pod-name>
```

Confirm the pod's `HOSTNAME` resolves to `0.0.0.0` — the Next.js server must listen on all interfaces.

**CronJobs not running:**

```bash
kubectl -n destink get cronjobs
kubectl -n destink get jobs
```

Check that `READY` is not suspended. If last schedule time is blank, the schedule expression may be invalid or the cluster clock is skewed.

**TLS certificate not issuing:**

```bash
kubectl -n destink describe certificate destink-tls
kubectl -n cert-manager logs deployment/cert-manager
```

Common causes: domain not pointing to the server's IP yet, HTTP-01 challenge blocked by firewall (port 80 must be open), or ClusterIssuer not ready.

**Daemon's internal cron conflicts with k8s CronJobs (double-scheduling):**

The daemon runs node-cron internally. To disable the daemon's internal cron and rely entirely on k8s CronJobs:

```yaml
# In my-values.yaml
env:
  DISABLE_INTERNAL_CRON: "true"
```

Or disable specific k8s CronJobs if you prefer the daemon to manage scheduling:

```yaml
cronJobs:
  publish:
    enabled: false
  research:
    enabled: false
  dailySummary:
    enabled: false
```

**View all Destink resources:**

```bash
kubectl -n destink get all
```

---

## Reference: Values Summary

| Value | Default | Description |
|-------|---------|-------------|
| `web.image.tag` | `latest` | Web image version |
| `daemon.image.tag` | `latest` | Daemon image version |
| `jobs.image.tag` | `latest` | Jobs image version |
| `postgresql.enabled` | `true` | Use bundled PostgreSQL |
| `externalDatabase.url` | `""` | External DB URL (when postgresql.enabled=false) |
| `ingress.enabled` | `false` | Enable Ingress resource |
| `ingress.host` | `""` | Domain name for Ingress |
| `ingress.tls` | `false` | Enable TLS via cert-manager |
| `ingress.clusterIssuer` | `letsencrypt-prod` | cert-manager ClusterIssuer name |
| `cronJobs.publish.enabled` | `true` | Enable publish CronJob |
| `cronJobs.research.enabled` | `true` | Enable research CronJob |
| `cronJobs.dailySummary.enabled` | `true` | Enable daily summary CronJob |

The full values file with all options is at `deploy/helm/destink/values.yaml`.
