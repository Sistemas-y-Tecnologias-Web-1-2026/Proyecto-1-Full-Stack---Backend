# Series Tracker — Backend 🎬

Backend REST API construido en Go (sin frameworks) con SQLite.

## Screenshot

### API corriendo
Agrega aqui una captura de la API funcionando.

## Links
- Aplicación en producción: https://proyecto-1-full-stack-backend.onrender.com
- Repositorio frontend: (agregar enlace)

## Cómo correr el proyecto localmente

### Requisitos
- Go 1.22+

### Instalación
```bash
git clone https://github.com/Sistemas-y-Tecnologias-Web-1-2026/Proyecto-1-Full-Stack---Backend.git
cd Proyecto-1-Full-Stack---Backend
go mod tidy
go run .
```

Variables de entorno opcionales:
- `PORT` (default: `8080`)
- `SQLITE_PATH` (default: `series.db`)

## Estructura del proyecto

```
.
├── main.go          # API REST, CORS, validaciones, SQLite
├── openapi.yaml     # Contrato OpenAPI
├── go.mod
├── go.sum
└── README.md
```

## Endpoints

### Series
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/series` | Listar series |
| GET | `/series/{id}` | Obtener serie por ID |
| POST | `/series` | Crear serie |
| PUT | `/series/{id}` | Editar serie |
| DELETE | `/series/{id}` | Eliminar serie |

### Ratings
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/series/{id}/rating` | Agregar rating (0–10) |
| GET | `/series/{id}/rating` | Obtener resumen de rating |

### Imagen
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/upload-image` | Subir imagen (max 1MB) |

### Query params en GET /series
| Parámetro | Ejemplo | Descripción |
|-----------|---------|-------------|
| `q` | `?q=dark` | Buscar por nombre |
| `sort` | `?sort=name` | Ordenar por columna |
| `order` | `?order=desc` | Dirección (`asc`/`desc`) |
| `page` | `?page=2` | Página actual |
| `limit` | `?limit=10` | Tamaño de página |

## OpenAPI y Swagger
- Spec: `/openapi.yaml`
- UI: `/docs`

## Códigos HTTP usados
- `200` lectura/actualización
- `201` creación
- `204` eliminación
- `400` input inválido
- `404` no encontrado
- `405` método no permitido
- `500` error interno

## CORS

CORS es la política de seguridad del navegador para peticiones entre orígenes distintos. Este backend permite:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## Reflection

Go con la librería estándar permitió construir una API clara y sin dependencias pesadas. Separar backend y frontend hizo más simple mantener responsabilidades y evolucionar cada parte por separado.
