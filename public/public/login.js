// ================================================================
//  login.js  –  Autenticación del cliente
//  1. Firebase Auth en el cliente obtiene el idToken
//  2. Lo envía al servidor Node.js → POST /api/login
//  3. El servidor crea una cookie de sesión segura
// ================================================================

import { initializeApp }             from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// ── Reemplaza con tu config de Firebase ──────────────────────
const firebaseConfig = {
  apiKey:    "TU_API_KEY",
  authDomain: "semana11-d0330.firebaseapp.com",
  projectId:  "semana11-d0330",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Si ya hay sesión activa en el servidor, ir directo al dashboard
async function verificarSesion() {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (res.ok) window.location.href = "index.html";
  } catch {
    // no hay sesión, quedarse en login
  }
}
verificarSesion();

// ── Login ─────────────────────────────────────────────────────
const btnLogin = document.getElementById("btn-login");
const errDiv   = document.getElementById("error-msg");

btnLogin.addEventListener("click", async () => {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    errDiv.textContent = "Completa todos los campos.";
    return;
  }

  errDiv.textContent   = "";
  btnLogin.disabled    = true;
  btnLogin.textContent = "Ingresando...";

  try {
    // Paso 1: autenticar con Firebase Client
    const credencial = await signInWithEmailAndPassword(auth, email, password);
    const idToken    = await credencial.user.getIdToken();

    // Paso 2: enviar token al servidor → crea la cookie de sesión
    const respuesta = await fetch("/api/login", {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",          // importante: enviar/recibir cookie
      body:        JSON.stringify({ idToken }),
    });

    if (respuesta.ok) {
      window.location.href = "index.html";
    } else {
      const data = await respuesta.json();
      errDiv.textContent = data.error || "Error del servidor.";
    }
  } catch (e) {
    const msgs = {
      "auth/invalid-credential": "Correo o contraseña incorrectos.",
      "auth/user-not-found":     "Usuario no encontrado.",
      "auth/wrong-password":     "Contraseña incorrecta.",
      "auth/too-many-requests":  "Demasiados intentos. Intenta más tarde.",
    };
    errDiv.textContent = msgs[e.code] || "Error al ingresar.";
  } finally {
    btnLogin.disabled    = false;
    btnLogin.textContent = "Ingresar";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLogin.click();
});