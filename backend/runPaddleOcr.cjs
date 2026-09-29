const { spawn } = require('child_process');
const path = require('path');

function executePaddleOcr(imageBase64OrPath) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.resolve(__dirname, 'paddle_ocr.py');
    const isFilePath = typeof imageBase64OrPath === 'string' && !imageBase64OrPath.startsWith('data:') && imageBase64OrPath.length < 500;

    const args = isFilePath ? [pythonScript, imageBase64OrPath] : [pythonScript];
    const py = spawn('python', args, {
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    py.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    py.on('error', (err) => {
      resolve({ success: false, error: 'Python PaddleOCR gagal dijalankan: ' + err.message });
    });

    py.on('close', (code) => {
      if (code !== 0) {
        return resolve({
          success: false,
          error: stderr || `PaddleOCR keluar dengan kode ${code}`
        });
      }
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch (e) {
        resolve({
          success: false,
          error: 'Gagal membaca output JSON dari PaddleOCR: ' + stdout
        });
      }
    });

    if (!isFilePath) {
      py.stdin.write(imageBase64OrPath);
      py.stdin.end();
    }
  });
}

module.exports = { executePaddleOcr };
