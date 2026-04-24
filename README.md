# Series Tracker — Backend 🎬

Backend REST API construido en Go (sin frameworks) con SQLite.

## Screenshot

### API corriendo
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/e349a6b2-4d8c-4222-96ce-d45034de5450" />


## Links
- Aplicación en producción: https://proyecto-1-full-stack-backend-production.up.railway.app/series
- Repositorio frontend: https://github.com/Sistemas-y-Tecnologias-Web-1-2026/Proyecto-1-Full-Stack---Frontend

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

## Seed manual de series

En la raiz del proyecto hay un script `load.py` que carga series manualmente en la API y toma imagenes reales desde Wikipedia para no depender de placeholders.

```bash
API_URL=https://proyecto-1-full-stack-backend-production.up.railway.app/series python3 load.py
```

Si queres cargar datos en local:

```bash
API_URL=http://localhost:8080/series python3 load.py
```

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

## Challenges implementados

### API y Backend
| Challenge | Puntos |
|-----------|--------|
| Spec de OpenAPI/Swagger escrita y precisa (contrato de API en YAML/JSON) | 20 |
| Swagger UI corriendo y servido desde el backend | 20 |
| Códigos HTTP correctos (201, 204, 404, 400, etc.) | 20 |
| Validación server-side con respuestas de error en JSON descriptivas | 20 |
| Paginación en `GET /series` con `?page=` y `?limit=` | 30 |
| Búsqueda por nombre con `?q=` | 15 |
| Ordenamiento con `?sort=` y `?order=ascdesc | 15 |

### Challenges adicionales
| Challenge | Puntos |
|-----------|--------|
| Sistema de rating con tabla propia en DB y endpoints REST propios | 30 |
| Subida de imágenes (máximo 1MB) | 30 |

Total implementado: 200 puntos

## Reflexion

Go permitió construir una API clara y sin dependencias pesadas. Separar backend y frontend hizo más simple mantener responsabilidades y evolucionar cada parte por separado.
