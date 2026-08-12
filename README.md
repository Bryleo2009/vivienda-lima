# Plan Casa · Bry + Tía

Web móvil/PWA para explicar y seguir el plan de compra de vivienda familiar en Lima.

## Ver localmente

```bash
cd vivienda-familiar-lima
python -m http.server 8080
```

Abrir `http://localhost:8080`.

> No abrir `index.html` con doble clic: el navegador puede bloquear la lectura de `data/dashboard.json` por `file://`.

## Publicar gratis en GitHub Pages

1. Crea un repositorio y sube esta carpeta.
2. En **Settings → Pages**, selecciona **Deploy from a branch** y la rama `main`, carpeta `/ (root)`.
3. En **Actions**, habilita workflows si GitHub lo solicita.
4. El workflow `.github/workflows/daily-update.yml` revisará las fuentes cada día.

## Qué se actualiza automáticamente

El script `scripts/update_data.py`:
- comprueba que las fuentes sigan disponibles;
- calcula un hash del contenido para detectar cambios;
- intenta descubrir nuevas publicaciones usando datos estructurados JSON-LD;
- agrega candidatos automáticos sin reemplazar las propiedades curadas;
- actualiza la fecha de revisión;
- conserva los últimos datos válidos si una web bloquea scraping.

Esto es intencional: no se deben cambiar requisitos financieros usando regex frágiles. Cuando una fuente oficial cambia, `data/source_state.json` deja constancia para revisar el dato.

## Actualizar propiedades

Edita `data/dashboard.json` → `properties`. Cada tarjeta acepta:

```json
{
  "title":"Dúplex 4 dormitorios",
  "district":"Pueblo Libre",
  "category":"Dúplex",
  "type":"Usado",
  "price":408000,
  "bedrooms":4,
  "area_m2":114,
  "parking":false,
  "multifamily":false,
  "score":5,
  "why":"Por qué conviene",
  "source":"https://..."
}
```

## Nota financiera

Los cálculos son referenciales. La capacidad real depende de la evaluación de cada banco, TCEA, seguros, deudas existentes, edad, estabilidad laboral y tasación del inmueble.
