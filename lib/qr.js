// QR code endpoint for the performer page URL.
//
// Reusable PNDS core: renders a PNG that performers scan to reach the
// performer page. The monitor page loads it via a plain <img> tag.
// Node-native variant: works with the raw `http` servers of this project
// (no Express) — the returned handler takes (request, response).

const QRCode = require('qrcode')

const DEFAULT_WIDTH = 480
const DEFAULT_MARGIN = 1

function qrHandler(url, { width = DEFAULT_WIDTH, margin = DEFAULT_MARGIN } = {}) {
  return (request, response) => {
    QRCode.toBuffer(url, {
      type: 'png',
      width,
      margin,
      errorCorrectionLevel: 'M',
    })
      .then(buffer => {
        response.writeHead(200, {
          'content-type': 'image/png',
          'cache-control': 'no-store',
        })
        response.end(buffer)
      })
      .catch(error => {
        console.error('[qr] generation failed:', error)
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        response.end('QR generation failed.')
      })
  }
}

module.exports = {
  qrHandler,
}
