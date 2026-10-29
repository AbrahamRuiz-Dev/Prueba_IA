# RunOnWeb AI Local Playground ⚡

Frontend interactivo para probar modelos de Inteligencia Artificial que se ejecutan **100% en local dentro del navegador**, utilizando [RunOnWeb](https://runonweb.ai) con aceleración **WebGPU** y soporte de **WebAssembly (WASM)**.

---

## 🚀 Modelos y Tareas incluidos

1. **✨ Texto a Emojis (`runonweb/emoji`):**
   - Micro-modelo T5 de tan solo **~3.9 MB**.
   - Ideal para probar la descarga y respuesta instantánea.
2. **✂️ Quitar Fondo (`runonweb/remove-bg`):**
   - Segmentación de primer plano con el modelo BEN2.
   - Incluye selector de fotos de prueba integradas (sin necesidad de buscar archivos) o subida propia.
   - Vista comparativa lado a lado y descarga en PNG con canal alfa transparente.
3. **🌐 Traductor (`runonweb/translate`):**
   - Basado en los modelos locales de Mozilla Firefox Bergamot en WASM.
   - Traducción multilingüe rápida (español, inglés, francés, alemán, italiano, portugués).
4. **🔍 Detección de Objetos (`runonweb/detect`):**
   - Modelo RF-DETR Nano.
   - Dibuja recuadros delimitadores (bounding boxes), etiquetas y porcentajes de confianza sobre canvas interactivo.
5. **📐 Similitud Semántica y Embeddings (`runonweb/embed`):**
   - Vectorización de texto con MiniLM (`all-MiniLM-L6-v2`).
   - Medidor visual del % de similitud coseno entre dos oraciones.
6. **🎙️ Voz a Texto (`runonweb/stt`):**
   - Transcripción local basada en Whisper.
   - Permite **grabar directamente desde el micrófono** o subir un archivo de audio (.mp3, .wav, .webm).
7. **👁️ Descripción de Imágenes (`runonweb/caption`):**
   - Modelo de visión Liquid Vision LFM2.5.
   - Generación de alt-text o descripciones detalladas en español e inglés.

---

## 🛠️ Herramientas adicionales en la interfaz

- **Detector de WebGPU:** Muestra si tu navegador está acelerando la inferencia por GPU o mediante CPU/WASM.
- **Barra de Progreso Global:** Muestra el porcentaje y nombre de archivo durante la primera descarga de pesos del modelo.
- **Gestor de Caché:** Monitorea el espacio consumido por los modelos descargados y permite vaciar la caché local con un clic.

---

## 📦 Instrucciones para ejecutar

```bash
# 1. Instalar dependencias (ya instaladas)
npm install

# 2. Iniciar el servidor de desarrollo
npm run dev
```

Abre en tu navegador `http://localhost:5173`.
