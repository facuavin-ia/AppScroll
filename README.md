# AppScroll

Feed vertical estilo Reels/TikTok **solo con contenido curado por vos**.

- **Mi rubro**: 🍱 Meal prep · 🎬 Edición con IA · 🐙 Repos GitHub · 🧰 Herramientas
- **Amigos**: 🔥 Retos · 🃏 Juegos de cartas · 😂 Virales

## Feed curado por Claude
`feed.json` lo genera Claude buscando con vidIQ los videos de TikTok e Instagram que más superaron la media de su creador en las últimas semanas, por categoría. Cada video muestra vistas, cuántas veces superó la media (`x`) y **por qué funcionó** (hook/formato), útil como referencia de edición.
Para actualizarlo: pedile a Claude *"actualizá el feed.json de AppScroll con virales de las últimas semanas"*. La app lo sincroniza sola al abrir (o Ajustes → Recargar feed); tus 💡 y 🧠 se conservan.

## Cómo se usa
- Scroll vertical con snap; el video visible se reproduce solo (y se pausa al salir).
- ＋ agrega links de **YouTube Shorts, TikTok, Instagram Reels o .mp4**. Si instalás la app (PWA) podés usar *Compartir → AppScroll* desde otras apps.
- 💡 marca el video como **idea a tener en cuenta** (pestaña Ideas, con nota y exportación a `.md`).
- 🧠 lo manda a la **cola de Claude**. Claude lee el repo de GitHub (descripción, estrellas, README) y te dice relevancia 0‑10, por qué, cómo usarlo en DaVinci/AE/CapCut, si va a tu **cerebro de edición** y una idea de contenido.
  - Con API key de Anthropic (Ajustes): analiza dentro de la app.
  - Sin key: **Exportar para Claude** / **Copiar prompt** y lo pegás en Claude o Claude Code.
- Ajustes: tu perfil (contexto para Claude), respaldo JSON, borrar demos.

## Correr
```bash
python3 -m http.server 8000   # abrir http://localhost:8000
```
O publicarlo gratis con GitHub Pages (Settings → Pages → branch).
