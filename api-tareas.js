const http = require('http');
const url = require('url');
const fs = require('fs');

/* ================= CONFIG ================= */

const PORT = 3000;
const API_KEY = '123456';
const LOG_FILE = 'logs.txt';

/* ================= DB EN MEMORIA ================= */

let tareas = [
  {
    id: 1,
    titulo: 'Aprender Node.js',
    descripcion: 'Practicar servidor HTTP',
    prioridad: 'alta',
    completada: false,
    fecha: new Date().toISOString()
  }
];

let siguienteId = 2;

/* ================= HELPERS ================= */

function enviarJSON(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY'
  });
  res.end(JSON.stringify(data, null, 2));
}

function obtenerBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject('JSON inválido');
      }
    });
  });
}

function logOperacion(req, mensaje) {
  const log = `[${new Date().toISOString()}] ${req.method} ${req.url} - ${mensaje}\n`;
  fs.appendFileSync(LOG_FILE, log);
}

/* ================= AUTH ================= */

function autenticar(req, res) {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    enviarJSON(res, { error: 'No autorizado' }, 401);
    return false;
  }
  return true;
}

/* ================= VALIDACIÓN ================= */

function validarTarea(data) {
  const errores = [];

  if (!data.titulo || typeof data.titulo !== 'string') {
    errores.push('El título es obligatorio');
  }

  const prioridades = ['alta', 'media', 'baja'];
  if (data.prioridad && !prioridades.includes(data.prioridad)) {
    errores.push('Prioridad inválida');
  }

  return errores;
}

/* ================= SERVER ================= */

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url, true);

  try {

    /* ===== INTERFAZ WEB ===== */
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Gestión de Tareas</title>
<style>
body { font-family: Arial; max-width: 700px; margin: auto; }
input, select, button { padding: 5px; margin: 5px; }
li { margin: 6px 0; }
</style>
</head>
<body>

<h1>📝 Gestión de Tareas</h1>

<input id="titulo" placeholder="Título">
<select id="prioridad">
  <option value="media">Media</option>
  <option value="alta">Alta</option>
  <option value="baja">Baja</option>
</select>
<button onclick="crear()">Crear</button>

<ul id="lista"></ul>

<script>
const API_KEY = '123456';

function cargar() {
  fetch('/api/tareas', {
    headers: { 'X-API-KEY': API_KEY }
  })
  .then(r => r.json())
  .then(data => {
    lista.innerHTML = '';
    data.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t.titulo + ' (' + t.prioridad + ')';
      lista.appendChild(li);
    });
  });
}

function crear() {
  fetch('/api/tareas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY
    },
    body: JSON.stringify({
      titulo: titulo.value,
      prioridad: prioridad.value
    })
  }).then(cargar);
}

cargar();
</script>

</body>
</html>
`);
    }

    /* ===== API AUTH ===== */
    if (pathname.startsWith('/api')) {
      if (!autenticar(req, res)) return;
    }

    /* ===== GET tareas ===== */
    if (req.method === 'GET' && pathname === '/api/tareas') {
      logOperacion(req, 'Listar tareas');
      return enviarJSON(res, tareas);
    }

    /* ===== POST tarea ===== */
    if (req.method === 'POST' && pathname === '/api/tareas') {
      const data = await obtenerBody(req);
      const errores = validarTarea(data);

      if (errores.length) {
        return enviarJSON(res, { errores }, 400);
      }

      const tarea = {
        id: siguienteId++,
        titulo: data.titulo,
        descripcion: data.descripcion || '',
        prioridad: data.prioridad || 'media',
        completada: false,
        fecha: new Date().toISOString()
      };

      tareas.push(tarea);
      logOperacion(req, 'Crear tarea');
      return enviarJSON(res, tarea, 201);
    }

    /* ===== ESTADÍSTICAS ===== */
    if (req.method === 'GET' && pathname === '/api/estadisticas') {
      const porPrioridad = {};
      const completadasPorDia = {};

      tareas.forEach(t => {
        porPrioridad[t.prioridad] = (porPrioridad[t.prioridad] || 0) + 1;

        if (t.completada) {
          const dia = t.fecha.split('T')[0];
          completadasPorDia[dia] = (completadasPorDia[dia] || 0) + 1;
        }
      });

      logOperacion(req, 'Ver estadísticas');
      return enviarJSON(res, { porPrioridad, completadasPorDia });
    }

    enviarJSON(res, { error: 'Ruta no encontrada' }, 404);

  } catch (err) {
    enviarJSON(res, { error: err.toString() }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
process.on('SIGINT', () => {
  console.log('\n👋 Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor detenido correctamente');
    process.exit(0);
  });
});
