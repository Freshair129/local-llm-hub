import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 8088;
const BASE_DIR = path.resolve('.');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

const server = http.createServer((req, res) => {
  const safePath = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(BASE_DIR, safePath);

  // Security check: stay within BASE_DIR
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found');
    }

    if (stats.isDirectory()) {
      fs.readdir(filePath, { withFileTypes: true }, (err, files) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('500 Error');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        let html = `<html><head><title>Index of ${safePath}</title><style>body{font-family:sans-serif;padding:24px;background:#0d1117;color:#c9d1d9;}a{color:#58a6ff;text-decoration:none;font-size:16px;line-height:2;}a:hover{text-decoration:underline;}ul{list-style:none;padding:0;}</style></head><body>`;
        html += `<h2>📁 Index of ${safePath}</h2><hr/><ul>`;
        if (safePath !== '/' && safePath !== '\\') {
          html += `<li><a href="../">⬅️ .. (Parent Directory)</a></li>`;
        }
        for (const f of files) {
          const isDir = f.isDirectory();
          const name = f.name + (isDir ? '/' : '');
          html += `<li><a href="${encodeURIComponent(f.name)}${isDir ? '/' : ''}">${isDir ? '📁' : '📄'} ${name}</a></li>`;
        }
        html += `</ul><hr/><p style="color:#8b949e;font-size:12px;">Local LLM Hub LAN File Server</p></body></html>`;
        res.end(html);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LAN File Server running at http://0.0.0.0:${PORT}`);
});
