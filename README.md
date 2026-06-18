# Repo Memory

Extensión de VS Code para gestionar memorias de contexto (reglas, prompts, notas) **por repositorio**, almacenadas **fuera del workspace** para evitar conflictos con Git.

## Problema que resuelve

Cuando trabajas con Copilot o agentes de IA, sueles repetir contexto del proyecto: convenciones, arquitectura, reglas de estilo, etc. Repo Memory guarda ese contexto en archivos `.md` o `.json` en una carpeta externa, organizada por repositorio.

## Requisitos

- VS Code **1.90+**
- GitHub Copilot Chat (opcional, para inyección directa en el chat)

## Flujo de trabajo

1. Abre una carpeta de workspace en VS Code.
2. Abre el panel **Repo Memory** en la barra de actividad.
3. Pulsa **+** para crear una memoria (Markdown o JSON).
4. Edita el contenido como cualquier archivo de texto.
5. Usa **Inyectar en Chat** para prefijar el contexto en Copilot Chat antes de hacer tu pregunta.

Al cambiar de workspace, la lista de memorias se actualiza automáticamente.

## Almacenamiento

Por defecto las memorias se guardan en:

```text
~/.repo-memory-store/{repo-id}/
```

También puedes usar el almacenamiento global de la extensión desde settings.

## Configuración

| Setting | Valores | Default | Descripción |
|---------|---------|---------|-------------|
| `repoMemory.storageLocation` | `home`, `globalStorage` | `home` | Dónde guardar las memorias |
| `repoMemory.repoIdStrategy` | `workspaceName`, `pathHash` | `workspaceName` | Cómo identificar cada repo |

- **`workspaceName`**: usa el nombre del workspace (simple, puede colisionar si dos repos tienen el mismo nombre).
- **`pathHash`**: añade un hash de la ruta absoluta para evitar colisiones.

## Desarrollo

```bash
npm install
npm run compile
npm test
npm run package
```

Presiona **F5** en VS Code para abrir una ventana de extensión.

## Roadmap v1.1

- Chat Participant `@repomemory`
- Soporte multi-root workspace
- Plantillas de memoria
- Memoria activa + atajo de teclado
- Export/import entre máquinas

## Licencia

MIT
