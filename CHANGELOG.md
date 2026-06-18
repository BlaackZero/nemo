# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-18

### Added

- Sidebar **Repo Memory** con listado de memorias por repositorio.
- Creación, edición y eliminación de memorias `.md` y `.json`.
- Almacenamiento externo en `~/.repo-memory-store` o `globalStorage`.
- Identificación configurable del repo (`workspaceName` o `pathHash`).
- Inyección de contexto en Copilot Chat con fallback a portapapeles.
- Tests unitarios e integración con `@vscode/test-electron`.
- CI con GitHub Actions.
