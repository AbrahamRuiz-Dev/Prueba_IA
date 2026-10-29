import {
  isWebGPUAvailable,
  listCachedModels,
  storageEstimate,
  formatBytes,
  clearAllModelCache
} from 'runonweb/core'

import { emojify } from 'runonweb/emoji'
import { removeBackground } from 'runonweb/remove-bg'
import { translate } from 'runonweb/translate'
import { detect } from 'runonweb/detect'
import { embed, cosineSimilarity } from 'runonweb/embed'
import { transcribe } from 'runonweb/stt'
import { caption } from 'runonweb/caption'

// ==========================================
// 1. STATE & GLOBAL PROGRESS
// ==========================================
const progressContainer = document.getElementById('global-progress-bar-container')
const progressStatusText = document.getElementById('progress-status-text')
const progressPercent = document.getElementById('progress-percent')
const progressFill = document.getElementById('progress-fill')

function updateProgress(info) {
  if (!info) return
  progressContainer.classList.remove('hidden')

  const pct = Math.min(100, Math.max(0, Math.round((info.progress ?? 0) * 100)))
  progressPercent.textContent = `${pct}%`
  progressFill.style.width = `${pct}%`

  let label = 'Cargando modelo...'
  if (info.status === 'initiate') label = `Iniciando descarga: ${info.file ?? ''}`
  else if (info.status === 'download' || info.status === 'progress') label = `Descargando: ${info.file ?? ''} (${pct}%)`
  else if (info.status === 'done') label = `Descarga completada: ${info.file ?? ''}`
  else if (info.status === 'ready') label = 'Modelo listo en memoria'

  progressStatusText.textContent = label

  if (info.status === 'ready' || pct >= 100) {
    setTimeout(() => {
      progressContainer.classList.add('hidden')
      updateCacheStatus()
    }, 1200)
  }
}

function hideProgress() {
  progressContainer.classList.add('hidden')
}

// ==========================================
// 2. DEVICE & CACHE INITIALIZATION
// ==========================================
async function initSystemInfo() {
  const badge = document.getElementById('device-badge')
  try {
    const hasGpu = await isWebGPUAvailable()
    badge.className = hasGpu ? 'status-badge webgpu' : 'status-badge wasm'
    badge.querySelector('.status-text').textContent = hasGpu
      ? 'WebGPU Activo (GPU ⚡)'
      : 'WASM Activo (CPU 🟡)'
  } catch {
    badge.className = 'status-badge wasm'
    badge.querySelector('.status-text').textContent = 'WASM Activo'
  }

  await updateCacheStatus()
}

async function updateCacheStatus() {
  const cacheLabel = document.getElementById('cache-size')
  try {
    const est = await storageEstimate()
    if (est && est.usage > 0) {
      cacheLabel.textContent = formatBytes(est.usage)
    } else {
      cacheLabel.textContent = '0 MB'
    }
  } catch {
    cacheLabel.textContent = 'N/D'
  }
}

// Modal Cache View
const cacheModal = document.getElementById('cache-modal')
const btnCacheInfo = document.getElementById('btn-cache-info')
const btnCloseModal = document.getElementById('btn-close-modal')
const btnModalDone = document.getElementById('btn-modal-done')
const btnClearCache = document.getElementById('btn-clear-cache')
const modalCacheList = document.getElementById('modal-cache-list')

btnCacheInfo.addEventListener('click', async () => {
  cacheModal.classList.remove('hidden')
  modalCacheList.innerHTML = '<p class="text-muted">Consultando modelos en caché...</p>'
  try {
    const models = await listCachedModels()
    if (!models || models.length === 0) {
      modalCacheList.innerHTML = '<p class="text-muted">No hay modelos almacenados en caché todavía.</p>'
    } else {
      modalCacheList.innerHTML = models.map(m => `
        <div class="cache-item">
          <strong>${m.id}</strong>
          <span>${formatBytes(m.bytes)} (${m.files?.length ?? 0} archivos)</span>
        </div>
      `).join('')
    }
  } catch (err) {
    modalCacheList.innerHTML = `<p class="text-muted">Error al leer la caché: ${err.message}</p>`
  }
})

const closeModal = () => cacheModal.classList.add('hidden')
btnCloseModal.addEventListener('click', closeModal)
btnModalDone.addEventListener('click', closeModal)

btnClearCache.addEventListener('click', async () => {
  if (confirm('¿Seguro que deseas eliminar todos los modelos descargados en la caché local?')) {
    modalCacheList.innerHTML = '<p class="text-muted">Eliminando archivos de caché...</p>'
    await clearAllModelCache()
    await updateCacheStatus()
    modalCacheList.innerHTML = '<p class="text-muted">Caché eliminada con éxito.</p>'
  }
})

// ==========================================
// 3. TABS CONTROLLER
// ==========================================
const tabButtons = document.querySelectorAll('.tab-btn')
const tabPanes = document.querySelectorAll('.tab-pane')

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab')
    tabButtons.forEach(b => b.classList.remove('active'))
    tabPanes.forEach(p => p.classList.remove('active'))

    btn.classList.add('active')
    document.getElementById(targetTab)?.classList.add('active')
  })
})

// Quick fill chip buttons
document.querySelectorAll('.chip-btn[data-fill]').forEach(chip => {
  chip.addEventListener('click', () => {
    const targetInput = document.getElementById(chip.getAttribute('data-fill'))
    if (targetInput) {
      targetInput.value = chip.getAttribute('data-text')
    }
  })
})

// ==========================================
// 4. SAMPLE IMAGES GENERATOR (OFFLINE & INSTANT)
// ==========================================
function generateSampleImageBlob(type) {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 400
  const ctx = canvas.getContext('2d')

  if (type === 'person') {
    // Colorful background
    const grad = ctx.createLinearGradient(0, 0, 480, 400)
    grad.addColorStop(0, '#f97316')
    grad.addColorStop(1, '#ec4899')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 480, 400)

    // Body & Head (Silhouette for background removal)
    ctx.fillStyle = '#1e293b'
    // Head
    ctx.beginPath()
    ctx.arc(240, 150, 65, 0, Math.PI * 2)
    ctx.fill()
    // Shoulders
    ctx.beginPath()
    ctx.ellipse(240, 340, 130, 110, 0, 0, Math.PI * 2)
    ctx.fill()

    // Glasses
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.strokeRect(200, 135, 30, 22)
    ctx.strokeRect(250, 135, 30, 22)
    ctx.beginPath()
    ctx.moveTo(230, 146)
    ctx.lineTo(250, 146)
    ctx.stroke()
  } else if (type === 'cat') {
    // Sky blue background
    ctx.fillStyle = '#38bdf8'
    ctx.fillRect(0, 0, 480, 400)

    // Cat Face
    ctx.fillStyle = '#f59e0b'
    ctx.beginPath()
    ctx.arc(240, 220, 90, 0, Math.PI * 2)
    ctx.fill()

    // Ears
    ctx.beginPath()
    ctx.moveTo(160, 170)
    ctx.lineTo(190, 90)
    ctx.lineTo(220, 145)
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(320, 170)
    ctx.lineTo(290, 90)
    ctx.lineTo(260, 145)
    ctx.fill()

    // Eyes
    ctx.fillStyle = '#1e293b'
    ctx.beginPath()
    ctx.arc(205, 205, 12, 0, Math.PI * 2)
    ctx.arc(275, 205, 12, 0, Math.PI * 2)
    ctx.fill()

    // Nose
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(240, 235, 8, 0, Math.PI * 2)
    ctx.fill()
  } else if (type === 'car') {
    // Green landscape background
    ctx.fillStyle = '#10b981'
    ctx.fillRect(0, 0, 480, 400)

    // Red Car body
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.roundRect(100, 210, 280, 70, [15, 15, 0, 0])
    ctx.fill()

    // Cabin
    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    ctx.roundRect(160, 140, 160, 75, [25, 25, 0, 0])
    ctx.fill()

    // Windows
    ctx.fillStyle = '#e0f2fe'
    ctx.fillRect(175, 155, 60, 45)
    ctx.fillRect(245, 155, 60, 45)

    // Wheels
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.arc(160, 285, 30, 0, Math.PI * 2)
    ctx.arc(320, 285, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#9ca3af'
    ctx.beginPath()
    ctx.arc(160, 285, 12, 0, Math.PI * 2)
    ctx.arc(320, 285, 12, 0, Math.PI * 2)
    ctx.fill()
  } else if (type === 'street') {
    // City street
    ctx.fillStyle = '#334155'
    ctx.fillRect(0, 0, 480, 260)
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 260, 480, 140)

    // Person
    ctx.fillStyle = '#f43f5e'
    ctx.beginPath()
    ctx.arc(120, 220, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(110, 236, 20, 60)

    // Car on street
    ctx.fillStyle = '#3b82f6'
    ctx.fillRect(220, 280, 160, 45)
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(250, 325, 16, 0, Math.PI * 2)
    ctx.arc(350, 325, 16, 0, Math.PI * 2)
    ctx.fill()

    // Traffic light
    ctx.fillStyle = '#111827'
    ctx.fillRect(40, 110, 28, 70)
    ctx.fillStyle = '#ef4444'
    ctx.beginPath(); ctx.arc(54, 125, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#eab308'
    ctx.beginPath(); ctx.arc(54, 145, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#22c55e'
    ctx.beginPath(); ctx.arc(54, 165, 8, 0, Math.PI*2); ctx.fill();
  } else if (type === 'desk') {
    // Office / Desk
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, 480, 400)
    // Table
    ctx.fillStyle = '#78350f'
    ctx.fillRect(40, 240, 400, 140)

    // Laptop
    ctx.fillStyle = '#64748b'
    ctx.fillRect(160, 160, 160, 100)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(170, 170, 140, 80)
    ctx.fillStyle = '#94a3b8'
    ctx.fillRect(140, 260, 200, 10)

    // Coffee mug
    ctx.fillStyle = '#e11d48'
    ctx.fillRect(360, 210, 35, 45)
  } else {
    // Nature / landscape
    ctx.fillStyle = '#60a5fa'
    ctx.fillRect(0, 0, 480, 220)
    ctx.fillStyle = '#15803d'
    ctx.beginPath()
    ctx.moveTo(0, 220)
    ctx.bezierCurveTo(120, 160, 240, 250, 480, 180)
    ctx.lineTo(480, 400)
    ctx.lineTo(0, 400)
    ctx.fill()

    // Sun
    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    ctx.arc(380, 80, 35, 0, Math.PI * 2)
    ctx.fill()
  }

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png')
  })
}

// ==========================================
// 5. TAB: EMOJI (runonweb/emoji)
// ==========================================
const btnRunEmoji = document.getElementById('btn-run-emoji')
const emojiInput = document.getElementById('emoji-input')
const emojiOutput = document.getElementById('emoji-output')
const timeEmoji = document.getElementById('time-emoji')

btnRunEmoji.addEventListener('click', async () => {
  const text = emojiInput.value.trim()
  if (!text) return

  btnRunEmoji.disabled = true
  btnRunEmoji.innerHTML = '<span class="spinner-small"></span> Procesando...'
  const startTime = performance.now()

  try {
    const result = await emojify(text, {
      onProgress: updateProgress
    })
    const elapsed = Math.round(performance.now() - startTime)
    emojiOutput.textContent = result.text || '✨'
    timeEmoji.textContent = `⏱️ ${elapsed} ms`
  } catch (err) {
    emojiOutput.textContent = '❌ Error: ' + err.message
  } finally {
    btnRunEmoji.disabled = false
    btnRunEmoji.innerHTML = '<span class="btn-icon">⚡</span> Convertir a Emojis'
    hideProgress()
  }
})

// ==========================================
// 6. TAB: QUITAR FONDO (runonweb/remove-bg)
// ==========================================
const bgDropzone = document.getElementById('bg-dropzone')
const bgFileInput = document.getElementById('bg-file-input')
const btnRunBg = document.getElementById('btn-run-bg')
const btnDownloadBg = document.getElementById('btn-download-bg')
const bgPreviewGrid = document.getElementById('bg-preview-grid')
const bgOriginalImg = document.getElementById('bg-original-img')
const bgResultImg = document.getElementById('bg-result-img')
const timeBg = document.getElementById('time-bg')

let currentBgImage = null
let currentResultBlob = null

function setBgSourceImage(fileOrBlob) {
  currentBgImage = fileOrBlob
  const url = URL.createObjectURL(fileOrBlob)
  bgOriginalImg.src = url
  bgPreviewGrid.style.display = 'grid'
  bgResultImg.src = ''
  btnRunBg.disabled = false
  btnDownloadBg.style.display = 'none'
  timeBg.textContent = ''
}

bgFileInput.addEventListener('change', (e) => {
  if (e.target.files?.[0]) setBgSourceImage(e.target.files[0])
})

bgDropzone.addEventListener('dragover', (e) => {
  e.preventDefault(); bgDropzone.classList.add('drag-over')
})
bgDropzone.addEventListener('dragleave', () => bgDropzone.classList.remove('drag-over'))
bgDropzone.addEventListener('drop', (e) => {
  e.preventDefault()
  bgDropzone.classList.remove('drag-over')
  if (e.dataTransfer.files?.[0]) setBgSourceImage(e.dataTransfer.files[0])
})

document.getElementById('btn-sample-person').addEventListener('click', async () => {
  const blob = await generateSampleImageBlob('person')
  setBgSourceImage(blob)
})
document.getElementById('btn-sample-cat').addEventListener('click', async () => {
  const blob = await generateSampleImageBlob('cat')
  setBgSourceImage(blob)
})
document.getElementById('btn-sample-car').addEventListener('click', async () => {
  const blob = await generateSampleImageBlob('car')
  setBgSourceImage(blob)
})

btnRunBg.addEventListener('click', async () => {
  if (!currentBgImage) return
  btnRunBg.disabled = true
  btnRunBg.innerHTML = '<span class="spinner-small"></span> Eliminando fondo...'
  const startTime = performance.now()

  try {
    const pngBlob = await removeBackground(currentBgImage, {
      onProgress: updateProgress
    })
    currentResultBlob = pngBlob
    const elapsed = Math.round(performance.now() - startTime)
    bgResultImg.src = URL.createObjectURL(pngBlob)
    btnDownloadBg.style.display = 'inline-flex'
    timeBg.textContent = `⏱️ ${elapsed} ms`
  } catch (err) {
    alert('Error al quitar el fondo: ' + err.message)
  } finally {
    btnRunBg.disabled = false
    btnRunBg.innerHTML = '<span class="btn-icon">✂️</span> Quitar Fondo'
    hideProgress()
  }
})

btnDownloadBg.addEventListener('click', () => {
  if (!currentResultBlob) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(currentResultBlob)
  a.download = 'sin-fondo.png'
  a.click()
})

// ==========================================
// 7. TAB: TRADUCTOR (runonweb/translate)
// ==========================================
const transFrom = document.getElementById('trans-from')
const transTo = document.getElementById('trans-to')
const btnSwapLang = document.getElementById('btn-swap-lang')
const transInput = document.getElementById('trans-input')
const transOutput = document.getElementById('trans-output')
const btnRunTrans = document.getElementById('btn-run-trans')
const btnCopyTrans = document.getElementById('btn-copy-trans')
const timeTrans = document.getElementById('time-trans')

btnSwapLang.addEventListener('click', () => {
  const tmp = transFrom.value
  transFrom.value = transTo.value
  transTo.value = tmp
})

btnRunTrans.addEventListener('click', async () => {
  const text = transInput.value.trim()
  if (!text) return

  btnRunTrans.disabled = true
  btnRunTrans.innerHTML = '<span class="spinner-small"></span> Traduciendo...'
  transOutput.value = 'Traduciendo...'
  const startTime = performance.now()

  try {
    const result = await translate(text, {
      from: transFrom.value,
      to: transTo.value,
      onProgress: updateProgress
    })
    const elapsed = Math.round(performance.now() - startTime)
    transOutput.value = result.text
    timeTrans.textContent = `⏱️ ${elapsed} ms`
  } catch (err) {
    transOutput.value = 'Error en traducción: ' + err.message
  } finally {
    btnRunTrans.disabled = false
    btnRunTrans.innerHTML = '<span class="btn-icon">🌐</span> Traducir'
    hideProgress()
  }
})

btnCopyTrans.addEventListener('click', () => {
  if (transOutput.value) {
    navigator.clipboard.writeText(transOutput.value)
    btnCopyTrans.textContent = '✅ Copiado'
    setTimeout(() => { btnCopyTrans.textContent = '📋 Copiar' }, 2000)
  }
})

// ==========================================
// 8. TAB: DETECCIÓN DE OBJETOS (runonweb/detect)
// ==========================================
const detectFileInput = document.getElementById('detect-file-input')
const detectDropzone = document.getElementById('detect-dropzone')
const btnRunDetect = document.getElementById('btn-run-detect')
const detectCanvas = document.getElementById('detect-canvas')
const detectCanvasWrapper = document.getElementById('detect-canvas-wrapper')
const detectionsUl = document.getElementById('detections-ul')
const detectCount = document.getElementById('detect-count')
const detectThreshold = document.getElementById('detect-threshold')
const threshVal = document.getElementById('thresh-val')
const timeDetect = document.getElementById('time-detect')

let currentDetectImage = null
let loadedImageElement = null

detectThreshold.addEventListener('input', () => {
  threshVal.textContent = detectThreshold.value
})

function setDetectImage(fileOrBlob) {
  currentDetectImage = fileOrBlob
  const url = URL.createObjectURL(fileOrBlob)
  const img = new Image()
  img.onload = () => {
    loadedImageElement = img
    detectCanvas.width = img.width
    detectCanvas.height = img.height
    const ctx = detectCanvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    detectCanvasWrapper.style.display = 'grid'
    btnRunDetect.disabled = false
    detectionsUl.innerHTML = '<li class="text-muted">Presiona Detectar Objetos</li>'
    detectCount.textContent = '0'
  }
  img.src = url
}

detectFileInput.addEventListener('change', (e) => {
  if (e.target.files?.[0]) setDetectImage(e.target.files[0])
})
detectDropzone.addEventListener('drop', (e) => {
  e.preventDefault()
  if (e.dataTransfer.files?.[0]) setDetectImage(e.dataTransfer.files[0])
})
detectDropzone.addEventListener('dragover', (e) => e.preventDefault())

document.getElementById('btn-detect-sample-street').addEventListener('click', async () => {
  const blob = await generateSampleImageBlob('street')
  setDetectImage(blob)
})
document.getElementById('btn-detect-sample-desk').addEventListener('click', async () => {
  const blob = await generateSampleImageBlob('desk')
  setDetectImage(blob)
})

btnRunDetect.addEventListener('click', async () => {
  if (!currentDetectImage || !loadedImageElement) return
  btnRunDetect.disabled = true
  btnRunDetect.innerHTML = '<span class="spinner-small"></span> Analizando...'
  const startTime = performance.now()

  try {
    const threshold = parseFloat(detectThreshold.value)
    const objects = await detect(currentDetectImage, {
      threshold,
      onProgress: updateProgress
    })
    const elapsed = Math.round(performance.now() - startTime)
    timeDetect.textContent = `⏱️ ${elapsed} ms`

    // Redraw original image
    const ctx = detectCanvas.getContext('2d')
    ctx.clearRect(0, 0, detectCanvas.width, detectCanvas.height)
    ctx.drawImage(loadedImageElement, 0, 0)

    detectCount.textContent = objects.length

    if (objects.length === 0) {
      detectionsUl.innerHTML = '<li class="text-muted">No se detectaron objetos con el umbral seleccionado.</li>'
      return
    }

    detectionsUl.innerHTML = objects.map(o => `
      <li class="detection-tag-item">
        <span><strong>${o.label}</strong></span>
        <span>${Math.round(o.score * 100)}%</span>
      </li>
    `).join('')

    // Draw boxes
    objects.forEach((obj, idx) => {
      const { xmin, ymin, xmax, ymax } = obj.box
      const width = xmax - xmin
      const height = ymax - ymin

      // Draw box
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 3
      ctx.strokeRect(xmin, ymin, width, height)

      // Draw tag background
      const label = `${obj.label} ${Math.round(obj.score * 100)}%`
      ctx.font = 'bold 14px sans-serif'
      const textWidth = ctx.measureText(label).width
      ctx.fillStyle = '#3b82f6'
      ctx.fillRect(xmin, Math.max(0, ymin - 22), textWidth + 12, 22)

      // Draw text
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, xmin + 6, Math.max(16, ymin - 6))
    })
  } catch (err) {
    alert('Error al detectar objetos: ' + err.message)
  } finally {
    btnRunDetect.disabled = false
    btnRunDetect.innerHTML = '<span class="btn-icon">🔍</span> Detectar Objetos'
    hideProgress()
  }
})

// ==========================================
// 9. TAB: SIMILITUD SEMÁNTICA (runonweb/embed)
// ==========================================
const embedText1 = document.getElementById('embed-text1')
const embedText2 = document.getElementById('embed-text2')
const btnRunEmbed = document.getElementById('btn-run-embed')
const embedResultCard = document.getElementById('embed-result-card')
const simPercentage = document.getElementById('sim-percentage')
const simBarFill = document.getElementById('sim-bar-fill')
const simInterpretation = document.getElementById('sim-interpretation')
const timeEmbed = document.getElementById('time-embed')

btnRunEmbed.addEventListener('click', async () => {
  const t1 = embedText1.value.trim()
  const t2 = embedText2.value.trim()
  if (!t1 || !t2) return

  btnRunEmbed.disabled = true
  btnRunEmbed.innerHTML = '<span class="spinner-small"></span> Comparando...'
  const startTime = performance.now()

  try {
    const { embeddings } = await embed([t1, t2], {
      onProgress: updateProgress
    })
    const sim = cosineSimilarity(embeddings[0], embeddings[1])
    const elapsed = Math.round(performance.now() - startTime)

    const pct = Math.max(0, Math.min(100, Math.round(sim * 100)))
    simPercentage.textContent = `${pct}%`
    simBarFill.style.width = `${pct}%`
    embedResultCard.style.display = 'flex'
    timeEmbed.textContent = `⏱️ ${elapsed} ms`

    if (pct > 80) {
      simInterpretation.textContent = '🟢 Significado casi idéntico o muy cercano.'
    } else if (pct > 50) {
      simInterpretation.textContent = '🟡 Conceptos relacionados o contexto similar.'
    } else {
      simInterpretation.textContent = '⚪ Oraciones no relacionadas o con poco significado en común.'
    }
  } catch (err) {
    alert('Error calculando embeddings: ' + err.message)
  } finally {
    btnRunEmbed.disabled = false
    btnRunEmbed.innerHTML = '<span class="btn-icon">📐</span> Comparar Similitud'
    hideProgress()
  }
})

document.getElementById('btn-sim-dog').addEventListener('click', () => {
  embedText1.value = 'El perro corre alegremente por el parque persiguiendo la pelota.'
  embedText2.value = 'Un cachorro juguetón salta en el césped detrás de un juguete.'
})
document.getElementById('btn-sim-diff').addEventListener('click', () => {
  embedText1.value = 'Una manzana madura y jugosa cayó del árbol.'
  embedText2.value = 'El ordenador portátil necesita una actualización de controladores gráficos.'
})
document.getElementById('btn-sim-lang').addEventListener('click', () => {
  embedText1.value = 'Hello world, how are you today?'
  embedText2.value = 'Hola mundo, ¿cómo estás el día de hoy?'
})

// ==========================================
// 10. TAB: VOZ A TEXTO (runonweb/stt)
// ==========================================
const btnMicToggle = document.getElementById('btn-mic-toggle')
const recordText = document.getElementById('record-text')
const recordTimer = document.getElementById('record-timer')
const audioFileInput = document.getElementById('audio-file-input')
const audioDropzone = document.getElementById('audio-dropzone')
const audioPlayback = document.getElementById('audio-playback')
const audioPlayerContainer = document.getElementById('audio-player-container')
const btnRunStt = document.getElementById('btn-run-stt')
const sttOutput = document.getElementById('stt-output')
const timeStt = document.getElementById('time-stt')

let mediaRecorder = null
let audioChunks = []
let recordedAudioBlob = null
let currentAudioTarget = null
let recordInterval = null
let recordSeconds = 0

function setAudioTarget(blobOrFile) {
  currentAudioTarget = blobOrFile
  audioPlayback.src = URL.createObjectURL(blobOrFile)
  audioPlayerContainer.style.display = 'block'
  btnRunStt.disabled = false
  sttOutput.textContent = 'Audio listo. Haz clic en "Transcribir Audio".'
}

audioFileInput.addEventListener('change', (e) => {
  if (e.target.files?.[0]) setAudioTarget(e.target.files[0])
})
audioDropzone.addEventListener('dragover', (e) => e.preventDefault())
audioDropzone.addEventListener('drop', (e) => {
  e.preventDefault()
  if (e.dataTransfer.files?.[0]) setAudioTarget(e.dataTransfer.files[0])
})

btnMicToggle.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    // Start Recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunks = []
      mediaRecorder = new MediaRecorder(stream)

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data)
      }

      mediaRecorder.onstop = () => {
        recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        setAudioTarget(recordedAudioBlob)
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRecorder.start()
      btnMicToggle.classList.add('recording')
      recordText.textContent = 'Detener Grabación'

      recordSeconds = 0
      recordTimer.textContent = '00:00'
      recordInterval = setInterval(() => {
        recordSeconds++
        const m = String(Math.floor(recordSeconds / 60)).padStart(2, '0')
        const s = String(recordSeconds % 60).padStart(2, '0')
        recordTimer.textContent = `${m}:${s}`
      }, 1000)
    } catch (err) {
      alert('No se pudo acceder al micrófono: ' + err.message)
    }
  } else {
    // Stop recording
    mediaRecorder.stop()
    btnMicToggle.classList.remove('recording')
    recordText.textContent = 'Iniciar Grabación'
    clearInterval(recordInterval)
  }
})

btnRunStt.addEventListener('click', async () => {
  if (!currentAudioTarget) return
  btnRunStt.disabled = true
  btnRunStt.innerHTML = '<span class="spinner-small"></span> Transcribiendo con Whisper...'
  sttOutput.textContent = 'Transcribiendo audio...'
  const startTime = performance.now()

  try {
    const result = await transcribe(currentAudioTarget, {
      onProgress: updateProgress,
      onPartial: (partial) => {
        sttOutput.textContent = partial
      }
    })
    const elapsed = Math.round(performance.now() - startTime)
    sttOutput.textContent = result.text || '(No se detectó voz clara en el audio)'
    timeStt.textContent = `⏱️ ${elapsed} ms`
  } catch (err) {
    sttOutput.textContent = 'Error al transcribir: ' + err.message
  } finally {
    btnRunStt.disabled = false
    btnRunStt.innerHTML = '<span class="btn-icon">📝</span> Transcribir Audio'
    hideProgress()
  }
})

// ==========================================
// 11. TAB: DESCRIPCIÓN DE IMAGEN (runonweb/caption)
// ==========================================
const captionFileInput = document.getElementById('caption-file-input')
const captionDropzone = document.getElementById('caption-dropzone')
const captionPreviewWrapper = document.getElementById('caption-preview-wrapper')
const captionPreviewImg = document.getElementById('caption-preview-img')
const captionLang = document.getElementById('caption-lang')
const captionDetail = document.getElementById('caption-detail')
const btnRunCaption = document.getElementById('btn-run-caption')
const captionOutput = document.getElementById('caption-output')
const timeCaption = document.getElementById('time-caption')

let currentCaptionImage = null

function setCaptionImage(fileOrBlob) {
  currentCaptionImage = fileOrBlob
  captionPreviewImg.src = URL.createObjectURL(fileOrBlob)
  captionPreviewWrapper.style.display = 'block'
  btnRunCaption.disabled = false
  captionOutput.textContent = 'Presiona "Generar Descripción"'
}

captionFileInput.addEventListener('change', (e) => {
  if (e.target.files?.[0]) setCaptionImage(e.target.files[0])
})
captionDropzone.addEventListener('dragover', (e) => e.preventDefault())
captionDropzone.addEventListener('drop', (e) => {
  e.preventDefault()
  if (e.dataTransfer.files?.[0]) setCaptionImage(e.dataTransfer.files[0])
})

document.getElementById('btn-caption-sample-nature').addEventListener('click', async () => {
  const blob = await generateSampleImageBlob('nature')
  setCaptionImage(blob)
})
document.getElementById('btn-caption-sample-coffee').addEventListener('click', async () => {
  const blob = await generateSampleImageBlob('desk')
  setCaptionImage(blob)
})

btnRunCaption.addEventListener('click', async () => {
  if (!currentCaptionImage) return
  btnRunCaption.disabled = true
  btnRunCaption.innerHTML = '<span class="spinner-small"></span> Analizando imagen...'
  captionOutput.textContent = 'Generando descripción...'
  const startTime = performance.now()

  try {
    const result = await caption(currentCaptionImage, {
      language: captionLang.value,
      detail: captionDetail.value,
      onProgress: updateProgress
    })
    const elapsed = Math.round(performance.now() - startTime)
    captionOutput.textContent = result.text || 'Sin descripción'
    timeCaption.textContent = `⏱️ ${elapsed} ms`
  } catch (err) {
    captionOutput.textContent = 'Error: ' + err.message
  } finally {
    btnRunCaption.disabled = false
    btnRunCaption.innerHTML = '<span class="btn-icon">👁️</span> Generar Descripción'
    hideProgress()
  }
})

// Start system detection
initSystemInfo()
