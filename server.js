// ================================================================
//  server.js  –  API REST  |  Supervisión de Hidrocarburos
//  Osinergmin – Detalle de Acciones de Supervisión
// ================================================================
//  npm install express firebase-admin cookie-parser cors dotenv
//
//  .env:
//    PORT=3000
//    FIREBASE_CREDENTIAL=./serviceAccountKey.json
//    NODE_ENV=development
// ================================================================

require("dotenv").config();
const express      = require("express");
const admin        = require("firebase-admin");
const cookieParser = require("cookie-parser");
const cors         = require("cors");
const path         = require("path");

// ── Firebase Admin ────────────────────────────────────────────
const serviceAccount = require(
  path.resolve(process.env.FIREBASE_CREDENTIAL || "./serviceAccountKey.json")
);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db         = admin.firestore();
const COLECCION  = "detalles";   // nombre de tu colección en Firestore

// ── Express ───────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));   // sirve login.html, index.html, app.js

const PORT = process.env.PORT || 3000;

// ================================================================
//  MIDDLEWARE DE AUTENTICACIÓN
//  Lee la cookie "session" y verifica con Firebase Admin
// ================================================================
async function auth(req, res, next) {
  const cookie = req.cookies.session || "";
  if (!cookie) return res.status(401).json({ error: "No autenticado" });

  try {
    req.user = await admin.auth().verifySessionCookie(cookie, true);
    next();
  } catch {
    res.clearCookie("session");
    res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}

// ================================================================
//  VALIDADOR del cuerpo del registro
//  Devuelve { valido, errores } con los campos reales del Excel
// ================================================================
function validarRegistro(body) {
  const requeridos = [
    "accion",
    "accionEspecifica",
    "subAccionEspecifica",
    "tipoAgente",
    "actividad",
    "provincia",
    "distrito",
    "tipoTransporte",
    "numSupervisores",
    "empresaSupervisora",
    "nroExpediente",
    "cartaLinea",
    "contrato",
    "supervisor",
    "calidadEntregable",
    "detalleCalidad",
    "cumplimientoPlazos",
  ];

  const errores = requeridos.filter(
    (k) => body[k] === undefined || body[k] === null || body[k] === ""
  );

  return { valido: errores.length === 0, errores };
}

// ================================================================
//  RUTAS DE AUTENTICACIÓN
// ================================================================

// POST /api/login
// Body: { idToken }  ← obtenido del cliente con signInWithEmailAndPassword
app.post("/api/login", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: "idToken requerido" });

  try {
    const decoded    = await admin.auth().verifyIdToken(idToken);
    const expiresIn  = 60 * 60 * 24 * 5 * 1000;  // 5 días
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

    res.cookie("session", sessionCookie, {
      maxAge:   expiresIn,
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      ok:   true,
      user: { uid: decoded.uid, email: decoded.email },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(401).json({ error: "Token inválido" });
  }
});

// POST /api/logout
app.post("/api/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ ok: true });
});

// GET /api/me  ←  saber si la sesión sigue activa
app.get("/api/me", auth, (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email });
});


// Redirigir raíz al login
app.get("/", (req, res) => {
  res.redirect("/login.html");
});
// ================================================================
//  CRUD  /api/detalle
//
//  Estructura de cada documento en Firestore:
//  {
//    accion              : "23 Preoperativa y denuncias",
//    accionEspecifica    : "23.1 Otorgamiento RH en instalaciones",
//    subAccionEspecifica : "Modificación de Registro",
//    tipoAgente          : "EVP combustibles de uso automotor",
//    actividad           : "Estación de servicios / Grifos",
//    provincia           : "06 Leoncio Prado",
//    distrito            : "06 Mariano Damaso Beraun",
//    tipoTransporte      : "Gabinete",
//    numSupervisores     : 1,
//    empresaSupervisora  : "EVALUACION Y SUPERVISION EN ENERGIA E.I.R.L",
//    nroExpediente       : "202600032265",
//    cartaLinea          : "1264272-1",
//    observaciones       : "",
//    contrato            : "SUP2600049",
//    supervisor          : "ING DARWIN UZURIAGA CLAUDIO",
//    calidadEntregable   : "Buena",
//    detalleCalidad      : "Sin errores de forma y fondo",
//    cumplimientoPlazos  : "Cumple con los plazos",
//    creadoEn            : Timestamp,
//    actualizadoEn       : Timestamp,
//    creadoPor           : "uid del usuario"
//  }
// ================================================================

// ── GET /api/detalle  → listar todos ─────────────────────────
app.get("/api/detalle", auth, async (req, res) => {
  try {
    const { accion, provincia, limite = "100" } = req.query;

    let query = db.collection(COLECCION).orderBy("creadoEn", "desc");

    if (accion)    query = query.where("accion", "==", accion);
    if (provincia) query = query.where("provincia", "==", provincia);

    query = query.limit(parseInt(limite));

    const snap = await query.get();
    const datos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    res.json({ ok: true, total: datos.length, datos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener registros" });
  }
});

// ── GET /api/detalle/:id  → obtener uno ──────────────────────
app.get("/api/detalle/:id", auth, async (req, res) => {
  try {
    const doc = await db.collection(COLECCION).doc(req.params.id).get();

    if (!doc.exists) return res.status(404).json({ error: "Registro no encontrado" });

    res.json({ ok: true, dato: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener registro" });
  }
});

// ── POST /api/detalle  → crear ───────────────────────────────
app.post("/api/detalle", auth, async (req, res) => {
  const { valido, errores } = validarRegistro(req.body);
  if (!valido) {
    return res.status(400).json({ error: "Campos requeridos faltantes", campos: errores });
  }

  try {
    const nuevo = {
      accion:              req.body.accion,
      accionEspecifica:    req.body.accionEspecifica,
      subAccionEspecifica: req.body.subAccionEspecifica,
      tipoAgente:          req.body.tipoAgente,
      actividad:           req.body.actividad,
      provincia:           req.body.provincia,
      distrito:            req.body.distrito,
      tipoTransporte:      req.body.tipoTransporte,
      numSupervisores:     Number(req.body.numSupervisores),
      empresaSupervisora:  req.body.empresaSupervisora,
      nroExpediente:       req.body.nroExpediente,
      cartaLinea:          req.body.cartaLinea,
      observaciones:       req.body.observaciones || "",
      contrato:            req.body.contrato,
      supervisor:          req.body.supervisor,
      calidadEntregable:   req.body.calidadEntregable,
      detalleCalidad:      req.body.detalleCalidad,
      cumplimientoPlazos:  req.body.cumplimientoPlazos,
      creadoEn:            admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn:       admin.firestore.FieldValue.serverTimestamp(),
      creadoPor:           req.user.uid,
    };

    const ref = await db.collection(COLECCION).add(nuevo);
    res.status(201).json({ ok: true, id: ref.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear registro" });
  }
});

// ── PUT /api/detalle/:id  → editar completo ──────────────────
app.put("/api/detalle/:id", auth, async (req, res) => {
  const { valido, errores } = validarRegistro(req.body);
  if (!valido) {
    return res.status(400).json({ error: "Campos requeridos faltantes", campos: errores });
  }

  try {
    const ref = db.collection(COLECCION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Registro no encontrado" });

    await ref.update({
      accion:              req.body.accion,
      accionEspecifica:    req.body.accionEspecifica,
      subAccionEspecifica: req.body.subAccionEspecifica,
      tipoAgente:          req.body.tipoAgente,
      actividad:           req.body.actividad,
      provincia:           req.body.provincia,
      distrito:            req.body.distrito,
      tipoTransporte:      req.body.tipoTransporte,
      numSupervisores:     Number(req.body.numSupervisores),
      empresaSupervisora:  req.body.empresaSupervisora,
      nroExpediente:       req.body.nroExpediente,
      cartaLinea:          req.body.cartaLinea,
      observaciones:       req.body.observaciones || "",
      contrato:            req.body.contrato,
      supervisor:          req.body.supervisor,
      calidadEntregable:   req.body.calidadEntregable,
      detalleCalidad:      req.body.detalleCalidad,
      cumplimientoPlazos:  req.body.cumplimientoPlazos,
      actualizadoEn:       admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar registro" });
  }
});

// ── PATCH /api/detalle/:id  → editar parcial ─────────────────
app.patch("/api/detalle/:id", auth, async (req, res) => {
  try {
    const ref = db.collection(COLECCION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Registro no encontrado" });

    const camposPermitidos = [
      "accion","accionEspecifica","subAccionEspecifica","tipoAgente",
      "actividad","provincia","distrito","tipoTransporte","numSupervisores",
      "empresaSupervisora","nroExpediente","cartaLinea","observaciones",
      "contrato","supervisor","calidadEntregable","detalleCalidad","cumplimientoPlazos"
    ];

    const actualizar = {};
    camposPermitidos.forEach((k) => {
      if (req.body[k] !== undefined) actualizar[k] = req.body[k];
    });
    actualizar.actualizadoEn = admin.firestore.FieldValue.serverTimestamp();

    await ref.update(actualizar);
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar registro" });
  }
});

// ── DELETE /api/detalle/:id  → eliminar ──────────────────────
app.delete("/api/detalle/:id", auth, async (req, res) => {
  try {
    const ref = db.collection(COLECCION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Registro no encontrado" });

    await ref.delete();
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar registro" });
  }
});

// ================================================================
//  RUTAS DE CATÁLOGOS (solo lectura, sin auth si quieres)
//  Devuelven los datos de las hojas de referencia del Excel
// ================================================================

// GET /api/catalogos/acciones
app.get("/api/catalogos/acciones", auth, async (req, res) => {
  res.json({
    ok: true,
    datos: [
      { codigo: "23", nombre: "23 Preoperativa y denuncias" },
      { codigo: "24", nombre: "24 Comercialización" },
      { codigo: "25", nombre: "25 Instalaciones" },
      { codigo: "26", nombre: "26 Calidad y cantidad" },
      { codigo: "28", nombre: "28 Medios de Transporte" },
    ],
  });
});

// GET /api/catalogos/calidad
app.get("/api/catalogos/calidad", auth, async (req, res) => {
  res.json({
    ok: true,
    niveles: ["Buena", "Regular", "Mala"],
    detalles: [
      "Sin errores de forma y fondo",
      "Con error de forma",
      "Con error de fondo",
      "Con errores de forma y fondo",
    ],
    plazos: ["Cumple con los plazos", "No cumple con los plazos"],
    transportes: ["Gabinete", "Terrestre", "Fluvial", "Aéreo"],
  });
});

// ================================================================
app.listen(PORT, () =>
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
);