const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.json':'application/json'};
const server=http.createServer((req,res)=>{let u=decodeURIComponent(req.url.split('?')[0]); if(u==='/' ) u='/index.html'; let file=path.join(root,u); if(!fs.existsSync(file)||!fs.statSync(file).isFile()) file=path.join(root,'public',u); if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end('Not found');return;} res.setHeader('Content-Type',mime[path.extname(file).toLowerCase()]||'application/octet-stream'); fs.createReadStream(file).pipe(res);});
const port=process.env.PORT||5173; server.listen(port,'127.0.0.1',()=>console.log(`ARIEL running at http://localhost:${port}`));
