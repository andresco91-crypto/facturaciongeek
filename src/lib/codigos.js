// Busca el código numérico más alto del catálogo y devuelve el siguiente,
// respetando la misma cantidad de dígitos (ej: si el mayor es "000994",
// el siguiente es "000995"). Si no hay códigos numéricos en el catálogo,
// usa un código temporal basado en la fecha como respaldo.
export function generarSiguienteCodigo(productos) {
  let maxNum = 0
  let maxLen = 6

  for (const p of productos) {
    const c = String(p.codigo || '').trim()
    if (/^\d+$/.test(c)) {
      const num = parseInt(c, 10)
      if (num > maxNum) {
        maxNum = num
        maxLen = c.length
      }
    }
  }

  if (maxNum === 0) {
    return 'NUEVO-' + Date.now().toString().slice(-8)
  }

  return String(maxNum + 1).padStart(maxLen, '0')
}
