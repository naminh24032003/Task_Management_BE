{{- define "microservice.name" -}}
{{- default .Chart.Name .Values.nameOverride -}}
{{- end }}

{{- define "microservice.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{ .Values.fullnameOverride }}
{{- else -}}
{{ printf "%s-%s" .Release.Name (include "microservice.name" .)
   | trunc 63 | trimSuffix "-" }}
{{- end -}}
{{- end }}
