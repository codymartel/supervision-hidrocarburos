// ================================================================
//  app.js  –  Frontend CRUD para Supervisión de Hidrocarburos
//  Conecta con la API REST en /api/detalle
// ================================================================

const API = "/api/detalle";

// ── Elementos del DOM ─────────────────────────────────────────
const statusEl = document.getElementById("status");
const listaEl  = document.getElementById("lista");
const formEl   = document.getElementById("form-registro");
const btnGuardar = document.getElementById("btn-guardar");
const btnCancelar = document.getElementById("btn-cancelar");
const tituloForm  = document.getElementById("titulo-form");

let modoEdicion = false;
let idEditando  = null;

// ── Utilidades ────────────────────────────────────────────────
function setStatus(msg, tipo = "ok") {
  statusEl.textContent = msg;
  statusEl.className   = `status-${tipo}`;
  if (tipo === "ok") setTimeout(() => (statusEl.textContent = ""), 3000);
}

function leerFormulario() {
  return {
    accion:              document.getElementById("accion").value,
    accionEspecifica:    document.getElementById("accionEspecifica").value,
    subAccionEspecifica: document.getElementById("subAccionEspecifica").value,
    tipoAgente:          document.getElementById("tipoAgente").value,
    actividad:           document.getElementById("actividad").value,
    provincia:           document.getElementById("provincia").value,
    distrito:            document.getElementById("distrito").value,
    tipoTransporte:      document.getElementById("tipoTransporte").value,
    numSupervisores:     document.getElementById("numSupervisores").value,
    empresaSupervisora:  document.getElementById("empresaSupervisora").value,
    nroExpediente:       document.getElementById("nroExpediente").value,
    cartaLinea:          document.getElementById("cartaLinea").value,
    observaciones:       document.getElementById("observaciones").value,
    contrato:            document.getElementById("contrato").value,
    supervisor:          document.getElementById("supervisor").value,
    calidadEntregable:   document.getElementById("calidadEntregable").value,
    detalleCalidad:      document.getElementById("detalleCalidad").value,
    cumplimientoPlazos:  document.getElementById("cumplimientoPlazos").value,
  };
}

function llenarFormulario(dato) {
  Object.keys(dato).forEach((k) => {
    const el = document.getElementById(k);
    if (el) el.value = dato[k] ?? "";
  });
}

function limpiarFormulario() {
  formEl.reset();
  modoEdicion = false;
  idEditando  = null;
  tituloForm.textContent  = "➕ Nuevo Registro";
  btnGuardar.textContent  = "💾 Guardar";
  btnCancelar.style.display = "none";
}

// ── GET – Listar ──────────────────────────────────────────────
async function cargarLista() {
  listaEl.innerHTML = "<p>⏳ Cargando...</p>";
  try {
    const res  = await fetch(API, { credentials: "include" });

    if (res.status === 401) {
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    if (!data.datos.length) {
      listaEl.innerHTML = "<p>No hay registros aún.</p>";
      return;
    }

    listaEl.innerHTML = data.datos.map((d) => `
      <div class="card" id="card-${d.id}">
        <div class="card-header">
          <span class="badge">${d.accion}</span>
          <span class="badge-sub">${d.accionEspecifica}</span>
        </div>
        <div class="card-body">
          <p><strong>Sub acción:</strong> ${d.subAccionEspecifica}</p>
          <p><strong>Actividad:</strong> ${d.actividad}</p>
          <p><strong>Agente:</strong> ${d.tipoAgente}</p>
          <p><strong>Provincia / Distrito:</strong> ${d.provincia} / ${d.distrito}</p>
          <p><strong>Transporte:</strong> ${d.tipoTransporte} &nbsp;|&nbsp;
             <strong>Supervisores:</strong> ${d.numSupervisores}</p>
          <p><strong>Empresa:</strong> ${d.empresaSupervisora}</p>
          <p><strong>Expediente:</strong> ${d.nroExpediente} &nbsp;|&nbsp;
             <strong>Carta:</strong> ${d.cartaLinea}</p>
          <p><strong>Contrato:</strong> ${d.contrato} &nbsp;|&nbsp;
             <strong>Supervisor:</strong> ${d.supervisor}</p>
          <p><strong>Calidad:</strong> ${d.calidadEntregable} – ${d.detalleCalidad}</p>
          <p><strong>Plazos:</strong> ${d.cumplimientoPlazos}</p>
          ${d.observaciones ? `<p><strong>Obs.:</strong> ${d.observaciones}</p>` : ""}
        </div>
        <div class="card-actions">
          <button class="btn-edit"   onclick="editarRegistro('${d.id}')">✏️ Editar</button>
          <button class="btn-delete" onclick="eliminarRegistro('${d.id}')">🗑️ Eliminar</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    listaEl.innerHTML = "<p>❌ No se pudo conectar con el servidor.</p>";
  }
}

// ── POST / PUT – Guardar ──────────────────────────────────────
btnGuardar.addEventListener("click", async () => {
  const datos = leerFormulario();

  setStatus("⏳ Guardando...", "loading");
  btnGuardar.disabled = true;

  try {
    const url    = modoEdicion ? `${API}/${idEditando}` : API;
    const method = modoEdicion ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body:        JSON.stringify(datos),
    });

    const data = await res.json();

    if (res.ok) {
      setStatus(modoEdicion ? "✅ Registro actualizado" : "✅ Registro guardado");
      limpiarFormulario();
      cargarLista();
    } else {
      setStatus(`❌ ${data.error || "Error al guardar"}`, "error");
    }
  } catch {
    setStatus("❌ Sin conexión con el servidor", "error");
  } finally {
    btnGuardar.disabled = false;
  }
});

// ── GET/:id + llenar form – Editar ────────────────────────────
async function editarRegistro(id) {
  try {
    const res  = await fetch(`${API}/${id}`, { credentials: "include" });
    const data = await res.json();

    if (!res.ok) { setStatus("❌ No se encontró el registro", "error"); return; }

    llenarFormulario(data.dato);
    modoEdicion = true;
    idEditando  = id;
    tituloForm.textContent   = "✏️ Editar Registro";
    btnGuardar.textContent   = "💾 Actualizar";
    btnCancelar.style.display = "inline-block";

    // Scroll al formulario
    document.getElementById("formulario-section").scrollIntoView({ behavior: "smooth" });
  } catch {
    setStatus("❌ Error al cargar el registro", "error");
  }
}

// ── DELETE – Eliminar ─────────────────────────────────────────
async function eliminarRegistro(id) {
  if (!confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;

  try {
    const res = await fetch(`${API}/${id}`, {
      method:      "DELETE",
      credentials: "include",
    });

    if (res.ok) {
      setStatus("🗑️ Registro eliminado");
      document.getElementById(`card-${id}`)?.remove();
    } else {
      setStatus("❌ No se pudo eliminar", "error");
    }
  } catch {
    setStatus("❌ Error de conexión", "error");
  }
}

// ── Cancelar edición ──────────────────────────────────────────
btnCancelar.addEventListener("click", limpiarFormulario);

// ── Logout ────────────────────────────────────────────────────
document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
  window.location.href = "login.html";
});

// ── Inicio ────────────────────────────────────────────────────
cargarLista();