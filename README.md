# Series Tracker API (Backend)

Backend REST para el proyecto full stack. Expone JSON y no renderiza HTML.

## Stack
- Go + net/http
- SQLite
- `database/sql` + `modernc.org/sqlite`

## Requisitos
- Go 1.22+
- SQLite (se crea automaticamente el archivo `.db`)

## Configuracion
1. Copia `.env.example` y define tus valores:

```bash
cp .env.example .env
```

Variables necesarias:
- `SQLITE_PATH`: ruta del archivo sqlite (default `series.db`)
- `PORT`: puerto del API (default `8080`)

## Ejecutar
```bash
go mod tidy
go run .
```

## Endpoints principales
- `GET /series`
- `GET /series/:id`
- `POST /series`
- `PUT /series/:id`
- `DELETE /series/:id`
- `POST /series/:id/rating`
- `GET /series/:id/rating`
- `POST /upload-image` (multipart, max 1MB)

## Query params en listado
`GET /series?page=1&limit=10&q=naruto&sort=name&order=asc`

## CORS
CORS es una politica de seguridad del navegador que bloquea peticiones entre origenes distintos si el servidor no las autoriza; este backend habilita `Access-Control-Allow-Origin: *`, metodos `GET,POST,PUT,DELETE,OPTIONS` y header `Content-Type` para desarrollo.

## OpenAPI / Swagger
- Spec: `GET /openapi.yaml`
- UI: `GET /docs`

## Ejemplo JSON para crear serie
```json
{
  "name": "Breaking Bad",
  "current_episode": 1,
  "total_episodes": 62,
  "image_url": "https://..."
}
```

## HTTP codes usados
- `200`: lectura/actualizacion
- `201`: creado (serie/rating/upload)
- `204`: eliminado
- `400`: input invalido
- `404`: recurso no existe
- `405`: metodo no permitido
- `500`: error interno

## Screenshot
Agrega aqui una captura de la API funcionando (Swagger o cliente consumiendo API).

## Reflexion
(Completar para la entrega) Esta arquitectura separada facilita reutilizar el backend en web, movil o CLI sin reescribir logica de negocio.
