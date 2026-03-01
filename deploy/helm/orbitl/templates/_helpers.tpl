{{/*
Expand the name of the chart.
*/}}
{{- define "orbitl.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "orbitl.fullname" -}}
{{- if .Release.Name }}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels applied to all resources.
*/}}
{{- define "orbitl.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "orbitl.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels used for Deployment/Service matching.
*/}}
{{- define "orbitl.selectorLabels" -}}
app.kubernetes.io/name: {{ include "orbitl.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Construct the DATABASE_URL for use in secrets.
- When postgresql.enabled is true: build connection string from bundled postgres values.
- When postgresql.enabled is false: use externalDatabase.url verbatim.
*/}}
{{- define "orbitl.databaseUrl" -}}
{{- if .Values.postgresql.enabled -}}
{{- printf "postgresql://%s:%s@%s-postgresql:5432/%s" .Values.postgresql.user .Values.postgresql.password (include "orbitl.fullname" .) .Values.postgresql.database -}}
{{- else -}}
{{- .Values.externalDatabase.url -}}
{{- end -}}
{{- end }}
