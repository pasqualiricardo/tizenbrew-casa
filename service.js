// Servicio de diagnóstico de la tele. Lo arranca TizenBrew dentro de su proceso de Node.js
// (v4.4.3 en Tizen 3), así que va en ES5. Solo lectura: memoria, carga, discos y procesos.
// Responde en http://<tele>:8099/diag para que la app y la red de casa lo puedan consultar.
'use strict';

var http = require('http');
var fs = require('fs');
var os = require('os');
var execFile = require('child_process').execFile;

var PUERTO = 8099;
// Solo la propia tele (la app "Casa" pide a 127.0.0.1) y la Mac de casa pueden consultarlo.
var CLIENTES = ['127.0.0.1', '::ffff:127.0.0.1', '::1', '192.168.0.121', '::ffff:192.168.0.121'];
// Origen de la app "Casa" (el puente): el único al que el navegador le deja leer la respuesta.
var ORIGEN_APP = 'http://192.168.0.8:8090';

function leer(ruta) {
  try {
    return fs.readFileSync(ruta, 'utf8');
  } catch (e) {
    return null;
  }
}

function meminfo() {
  var texto = leer('/proc/meminfo');
  var out = {};
  if (!texto) return null;
  texto.split('\n').forEach(function (linea) {
    var m = linea.match(/^(\w+):\s+(\d+)/);
    if (m) out[m[1]] = parseInt(m[2], 10);
  });
  return out;
}

// El sandbox de Tizen puede ocultar procesos de otros usuarios: se lista lo que se pueda leer.
function procesos() {
  var lista = [];
  var pids;
  try {
    pids = fs.readdirSync('/proc');
  } catch (e) {
    return lista;
  }
  pids.forEach(function (pid) {
    if (!/^\d+$/.test(pid)) return;
    var st = leer('/proc/' + pid + '/status');
    if (!st) return;
    var nombre = st.match(/^Name:\s+(.+)$/m);
    var rss = st.match(/^VmRSS:\s+(\d+)/m);
    if (nombre && rss) lista.push({ pid: parseInt(pid, 10), name: nombre[1], rssKb: parseInt(rss[1], 10) });
  });
  lista.sort(function (a, b) { return b.rssKb - a.rssKb; });
  return lista.slice(0, 20);
}

function discos(listo) {
  execFile('df', ['-k'], { timeout: 3000 }, function (err, stdout) {
    var out = [];
    var vistos = {};
    (stdout || '').split('\n').slice(1).forEach(function (linea) {
      var c = linea.trim().split(/\s+/);
      if (c.length < 6 || !/^\d+$/.test(c[1])) return;
      var totalKb = parseInt(c[1], 10);
      if (totalKb < 50 * 1024 || /^(tmpfs|devtmpfs|none|udev)$/.test(c[0]) || vistos[c[0]]) return;
      vistos[c[0]] = true;
      out.push({ mount: c[5], totalKb: totalKb, usedKb: parseInt(c[2], 10), pct: parseInt(c[4], 10) });
    });
    listo(out);
  });
}

function diag(listo) {
  var datos = {
    ts: Date.now(),
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    cpus: os.cpus().length,
    cpuModel: (os.cpus()[0] || {}).model,
    node: process.version,
    release: os.release(),
    meminfo: meminfo(),
    procesos: procesos()
  };
  discos(function (lista) {
    datos.storage = lista;
    listo(datos);
  });
}

var servidor = http.createServer(function (req, res) {
  if (CLIENTES.indexOf(req.socket.remoteAddress) < 0) {
    res.statusCode = 403;
    res.end();
    return;
  }
  if (req.headers.origin === ORIGEN_APP) res.setHeader('Access-Control-Allow-Origin', ORIGEN_APP);
  if (req.method === 'GET' && req.url.indexOf('/diag') === 0) {
    diag(function (datos) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(datos));
    });
    return;
  }
  res.statusCode = 404;
  res.end('tizenbrew-casa');
});

// Si TizenBrew lanza el servicio dos veces, el segundo encuentra el puerto ocupado y no hace nada.
servidor.on('error', function () {});
servidor.listen(PUERTO, '0.0.0.0');
