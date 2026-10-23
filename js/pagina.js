import {
  negocio,
  enlaceWhatsapp,
  enlaceTelefono,
  enlaceMapa,
  urlInstagram,
  formatoPrecio
} from "./config.js";

const textos = negocio.textos || {};
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const red = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const ahorrar = !!(red && (red.saveData || /2g/.test(red.effectiveType || "")));
const gamaBaja = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
const estatico = reduce || ahorrar || !!gamaBaja;
const carpeta = "assets/img/fotos/";

const hoja = (() => {
  try {
    const creada = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, creada];
    return creada;
  } catch (error) {
    const nodo = document.createElement("style");
    document.head.appendChild(nodo);
    return nodo.sheet;
  }
})();

const regla = (texto) => {
  try {
    hoja.insertRule(texto, hoja.cssRules.length);
  } catch (error) {}
};

const esId = (valor) => /^[a-z0-9-]+$/.test(valor || "");
const esColor = (valor) => /^#[0-9a-fA-F]{6}$/.test(valor || "");

const focoDe = (foto) => {
  const x = Math.max(0, Math.min(1, Number(foto.foco && foto.foco.x)));
  const y = Math.max(0, Math.min(1, Number(foto.foco && foto.foco.y)));
  return (Number.isFinite(x) ? x : 0.5) * 100 + "% " + (Number.isFinite(y) ? y : 0.5) * 100 + "%";
};

const variantesDe = (foto) => (Array.isArray(foto.variantes) ? foto.variantes.filter((item) => item && item.ancho) : []);

const urlDe = (foto, ancho) => carpeta + foto.id + "-" + ancho + ".webp";
const urlFondo = (foto, ancho) => "../" + carpeta + foto.id + "-" + ancho + ".webp";

const srcsetDe = (foto) => variantesDe(foto).map((item) => urlDe(foto, item.ancho) + " " + item.ancho + "w").join(", ");

const anchoDe = (foto, preferido) => {
  const lista = variantesDe(foto);
  const exacto = lista.find((item) => item.ancho === preferido);
  if (exacto) return exacto.ancho;
  const orden = lista.slice().sort((a, b) => a.ancho - b.ancho);
  const mayor = orden.find((item) => item.ancho >= preferido) || orden[orden.length - 1];
  return mayor ? mayor.ancho : 0;
};

const pintarEnlaces = () => {
  const wa = enlaceWhatsapp();
  document.querySelectorAll("[data-wa]").forEach((nodo) => {
    if (!wa) return;
    nodo.href = wa;
    nodo.target = "_blank";
    nodo.rel = "noopener";
  });
  document.querySelectorAll("[data-wa-productos]").forEach((nodo) => {
    const href = enlaceWhatsapp(negocio.mensajeProductos || "");
    if (!href) return;
    nodo.href = href;
    nodo.target = "_blank";
    nodo.rel = "noopener";
  });
  const tel = enlaceTelefono();
  document.querySelectorAll("[data-tel]").forEach((nodo) => {
    if (tel) nodo.href = tel;
  });
  const mapa = enlaceMapa();
  document.querySelectorAll("[data-maps]").forEach((nodo) => {
    if (!mapa) return;
    nodo.href = mapa;
    nodo.target = "_blank";
    nodo.rel = "noopener";
  });
  const ig = urlInstagram();
  document.querySelectorAll("[data-ig]").forEach((nodo) => {
    if (!ig) return;
    nodo.href = ig;
    nodo.target = "_blank";
    nodo.rel = "noopener";
  });
};

const pintarTextos = () => {
  document.querySelectorAll("[data-texto]").forEach((nodo) => {
    const valor = textos[nodo.getAttribute("data-texto")];
    if (valor) nodo.textContent = valor;
  });
  document.querySelectorAll("[data-ciudad]").forEach((nodo) => {
    if (negocio.ciudad) nodo.textContent = negocio.ciudad;
  });
  const postal = document.querySelector("[data-postal]");
  if (postal && negocio.codigoPostal) postal.textContent = "Código postal " + negocio.codigoPostal;
  const horario = document.querySelector("[data-horario]");
  if (horario) {
    const valor = typeof negocio.horario === "string" ? negocio.horario.trim() : "";
    horario.textContent = valor || textos.horarioPendiente || "Horario por confirmar";
  }
  const antes = document.querySelector("[data-hero-antes]");
  const palabra = document.querySelector("[data-hero-palabra]");
  const despues = document.querySelector("[data-hero-despues]");
  if (antes && textos.heroAntes) antes.textContent = textos.heroAntes;
  if (palabra && textos.heroPalabra) palabra.textContent = textos.heroPalabra;
  if (despues && textos.heroDespues) despues.textContent = textos.heroDespues;
  const robots = document.querySelector("[data-robots-vivo]");
  if (robots) robots.setAttribute("content", negocio.enPreparacion ? "noindex, nofollow" : "index, follow");
};

const pintarNosotros = () => {
  const datos = negocio.nosotros || {};
  document.querySelectorAll("[data-nosotros]").forEach((nodo) => {
    const valor = datos[nodo.getAttribute("data-nosotros")];
    if (typeof valor === "string") nodo.textContent = valor;
  });
  const chips = document.querySelector("[data-nosotros-chips]");
  if (chips && Array.isArray(datos.edades)) {
    chips.replaceChildren();
    datos.edades.forEach((edad) => {
      const item = document.createElement("li");
      item.textContent = edad;
      chips.appendChild(item);
    });
  }
  (datos.historias || []).forEach((historia, indice) => {
    const titulo = document.querySelector('[data-nosotros-h="' + indice + '"]');
    const texto = document.querySelector('[data-nosotros-p="' + indice + '"]');
    if (titulo && historia.titulo) titulo.textContent = historia.titulo;
    if (texto && historia.texto) texto.textContent = historia.texto;
    const figura = titulo ? titulo.closest("figure") : null;
    const img = figura ? figura.querySelector("img") : null;
    if (img && historia.alt) img.alt = historia.alt;
  });
  (datos.valores || []).forEach((valor, indice) => {
    const titulo = document.querySelector('[data-valor-t="' + indice + '"]');
    const texto = document.querySelector('[data-valor-p="' + indice + '"]');
    if (titulo) titulo.textContent = valor.titulo;
    if (texto) texto.textContent = valor.texto;
  });
};

const pintarPrivacidad = () => {
  const caja = document.querySelector("[data-privacidad]");
  if (!caja || !Array.isArray(negocio.privacidad)) return;
  caja.replaceChildren();
  negocio.privacidad.forEach((parrafo) => {
    const p = document.createElement("p");
    p.textContent = parrafo;
    caja.appendChild(p);
  });
};

const estilosFoto = (foto) => {
  if (!esId(foto.id) || !esColor(foto.colorMedio)) return;
  regla(".mate-" + foto.id + "{background-color:" + foto.colorMedio + "}");
  regla("img.mate-" + foto.id + ",.mate-" + foto.id + " img{object-position:" + focoDe(foto) + "}");
};

const fondoDe = (selector, foto) => {
  if (!foto || !esId(foto.id)) return;
  const ancho = anchoDe(foto, 800) || anchoDe(foto, 480);
  if (!ancho) return;
  regla(selector + "{--foto-fondo:url(\"" + urlFondo(foto, ancho) + "\");--foto-foco:" + focoDe(foto) + "}");
};

const prepararHero = (fotos) => {
  const fondo = document.querySelector("[data-hero-fondo]");
  if (!fondo) return;
  const lista = fotos
    .filter((foto) => foto.aptaFondo && ["fachada", "interior", "ambiente"].includes(foto.categoria))
    .sort((a, b) => Number(b.destacada) - Number(a.destacada))
    .slice(0, estatico ? 1 : 3);
  if (!lista.length) return;
  const primera = urlDe(lista[0], anchoDe(lista[0], 1200) || anchoDe(lista[0], 800));
  const preload = document.createElement("link");
  preload.rel = "preload";
  preload.as = "image";
  preload.href = primera;
  preload.setAttribute("fetchpriority", "high");
  document.head.appendChild(preload);
  lista.forEach((foto, indice) => {
    const capa = document.createElement("div");
    capa.className = "hero-slide mate-" + foto.id + (indice === 0 ? " is-on" : "");
    const img = document.createElement("img");
    const ancho = anchoDe(foto, indice === 0 ? 1200 : 800);
    img.src = urlDe(foto, ancho);
    img.srcset = srcsetDe(foto);
    img.sizes = "100vw";
    img.alt = "";
    img.width = foto.ancho;
    img.height = foto.alto;
    img.decoding = "async";
    if (indice === 0) img.setAttribute("fetchpriority", "high");
    else img.loading = "lazy";
    capa.appendChild(img);
    fondo.appendChild(capa);
  });
  if (lista.length > 1 && !estatico) {
    fondo.classList.add("hero-anima");
    let actual = 0;
    window.setInterval(() => {
      const capas = [...fondo.querySelectorAll(".hero-slide")];
      if (capas.length < 2) return;
      capas[actual].classList.remove("is-on");
      actual = (actual + 1) % capas.length;
      capas[actual].classList.add("is-on");
    }, 7000);
  }
};

const prepararAmbiente = (fotos) => {
  const ambiente = fotos.find((foto) => foto.categoria === "ambiente" && foto.tono === "oscuro") || fotos.find((foto) => foto.categoria === "ambiente");
  const cita = document.querySelector("[data-cita-fondo]");
  const panel = document.querySelector("[data-nav-panel]");
  if (ambiente && cita) {
    cita.classList.add("tiene-foto");
    fondoDe(".cita-fondo.tiene-foto", ambiente);
  }
  if (ambiente && panel && esId(ambiente.id)) {
    const ancho = anchoDe(ambiente, 800);
    if (ancho) {
      panel.classList.add("tiene-foto");
      regla("#nav-panel.tiene-foto{--foto-nav:url(\"" + urlFondo(ambiente, ancho) + "\");--foto-foco:" + focoDe(ambiente) + "}");
    }
  }
  const visitaFoto = fotos
    .filter((foto) => foto.categoria === "fachada" || foto.categoria === "interior")
    .sort((a, b) => Number(b.tono === "oscuro") - Number(a.tono === "oscuro"))[0];
  const visita = document.querySelector("[data-visita-fondo]");
  if (visitaFoto && visita) {
    visita.classList.add("tiene-foto");
    fondoDe(".visita-fondo.tiene-foto", visitaFoto);
  }
  const pista = document.querySelector("[data-pista]");
  if (pista && fotos.some((foto) => foto.categoria === "fachada")) {
    pista.hidden = false;
    if (textos.pista) pista.textContent = textos.pista;
  }
  const productos = fotos.filter((foto) => foto.categoria === "producto");
  const seccion = document.getElementById("productos");
  const fondoProductos = document.querySelector("[data-productos-fondo]");
  if (seccion && productos.length) {
    seccion.hidden = false;
    if (fondoProductos) {
      fondoProductos.classList.add("tiene-foto");
      fondoDe(".productos-fondo.tiene-foto", productos[0]);
    }
  }
  return ambiente ? ambiente.id : "";
};

const servicioNodo = (servicio) => {
  const article = document.createElement("article");
  article.className = "servicio";
  const titulo = document.createElement("h3");
  titulo.textContent = servicio.nombre;
  const texto = document.createElement("p");
  texto.textContent = servicio.descripcion;
  const precio = document.createElement("p");
  precio.className = "servicio-precio";
  if (servicio.precio === null || servicio.precio === undefined || servicio.precio === "") precio.textContent = textos.consultar || "Consultar por WhatsApp";
  else precio.textContent = formatoPrecio(servicio.precio);
  article.append(titulo, texto, precio);
  return article;
};

const slug = (valor) => valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const prepararServicios = (fotos) => {
  const carta = document.querySelector("[data-carta]");
  const estatica = document.querySelector("[data-carta-estatica]");
  if (!carta || !Array.isArray(negocio.servicios) || !negocio.servicios.length) return;
  const orden = ["Cortes", "Barba", "Niños", "Mujer", "Color", "FreeStyle y diseños", "Cuidado facial"];
  const presentes = [];
  orden.forEach((nombre) => {
    if (negocio.servicios.some((item) => item.categoria === nombre)) presentes.push(nombre);
  });
  negocio.servicios.forEach((item) => {
    if (item.categoria && !presentes.includes(item.categoria)) presentes.push(item.categoria);
  });
  const banco = fotos.filter((foto) => ["corte", "equipo", "producto"].includes(foto.categoria));
  const tabs = carta.querySelector("[data-carta-tabs]");
  const paneles = carta.querySelector("[data-carta-paneles]");
  const movil = carta.querySelector("[data-carta-movil]");
  const hueco = carta.querySelector("[data-carta-foto]");
  let fotoNodo = null;
  const fotoDe = (indice) => (banco.length ? banco[indice % banco.length] : null);
  const ponerFoto = (nombre) => {
    const foto = fotoDe(presentes.indexOf(nombre));
    const estrecha = window.matchMedia("(max-width: 899px)").matches;
    const destino = estrecha ? carta.querySelector(".acordeon-item.is-open .acordeon-foto") : hueco;
    if (!foto || !destino) return;
    const ancho = anchoDe(foto, 800);
    if (!ancho) return;
    if (!fotoNodo) {
      fotoNodo = document.createElement("img");
      fotoNodo.decoding = "async";
      fotoNodo.loading = "lazy";
    }
    fotoNodo.src = urlDe(foto, ancho);
    fotoNodo.srcset = srcsetDe(foto);
    fotoNodo.sizes = estrecha ? "100vw" : "(min-width: 900px) 40vw, 100vw";
    fotoNodo.alt = foto.alt;
    fotoNodo.width = foto.ancho;
    fotoNodo.height = foto.alto;
    fotoNodo.className = "mate-" + foto.id;
    destino.replaceChildren(fotoNodo);
  };
  const seleccionar = (nombre) => {
    tabs.querySelectorAll("[role='tab']").forEach((tab) => {
      const activo = tab.getAttribute("data-cat") === nombre;
      tab.setAttribute("aria-selected", activo ? "true" : "false");
      tab.tabIndex = activo ? 0 : -1;
    });
    paneles.querySelectorAll("[role='tabpanel']").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-cat") !== nombre;
    });
    movil.querySelectorAll(".acordeon-item").forEach((item) => {
      const activo = item.getAttribute("data-cat") === nombre;
      item.classList.toggle("is-open", activo);
      const boton = item.querySelector("button");
      if (boton) boton.setAttribute("aria-expanded", activo ? "true" : "false");
    });
    ponerFoto(nombre);
  };
  presentes.forEach((nombre, indice) => {
    const id = slug(nombre) || "cat-" + indice;
    const servicios = negocio.servicios.filter((item) => item.categoria === nombre);
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "carta-tab";
    tab.setAttribute("role", "tab");
    tab.id = "tab-" + id;
    tab.setAttribute("aria-controls", "panel-" + id);
    tab.setAttribute("data-cat", nombre);
    tab.textContent = nombre;
    tab.addEventListener("click", () => seleccionar(nombre));
    tabs.appendChild(tab);
    const panel = document.createElement("div");
    panel.setAttribute("role", "tabpanel");
    panel.id = "panel-" + id;
    panel.setAttribute("aria-labelledby", tab.id);
    panel.setAttribute("data-cat", nombre);
    servicios.forEach((servicio) => panel.appendChild(servicioNodo(servicio)));
    paneles.appendChild(panel);
    const item = document.createElement("div");
    item.className = "acordeon-item";
    item.setAttribute("data-cat", nombre);
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "acordeon-q";
    boton.setAttribute("aria-expanded", "false");
    boton.textContent = nombre;
    const cuerpo = document.createElement("div");
    cuerpo.className = "acordeon-panel";
    const interior = document.createElement("div");
    interior.className = "acordeon-inner";
    const marco = document.createElement("div");
    marco.className = "acordeon-foto";
    const lista = document.createElement("div");
    servicios.forEach((servicio) => lista.appendChild(servicioNodo(servicio)));
    interior.append(marco, lista);
    cuerpo.appendChild(interior);
    item.append(boton, cuerpo);
    boton.addEventListener("click", () => seleccionar(nombre));
    movil.appendChild(item);
  });
  tabs.addEventListener("keydown", (event) => {
    const botones = [...tabs.querySelectorAll("[role='tab']")];
    const indice = botones.indexOf(document.activeElement);
    if (indice < 0) return;
    let siguiente = -1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") siguiente = (indice + 1) % botones.length;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") siguiente = (indice - 1 + botones.length) % botones.length;
    if (event.key === "Home") siguiente = 0;
    if (event.key === "End") siguiente = botones.length - 1;
    if (siguiente < 0) return;
    event.preventDefault();
    botones[siguiente].focus();
    seleccionar(botones[siguiente].getAttribute("data-cat"));
  });
  if (presentes.length) seleccionar(presentes[0]);
  window.addEventListener("resize", () => {
    const activo = movil.querySelector(".acordeon-item.is-open");
    if (activo) ponerFoto(activo.getAttribute("data-cat"));
  });
  if (estatica) estatica.hidden = true;
  carta.hidden = false;
};

const prepararGaleria = (fotos, reservada) => {
  const seccion = document.getElementById("galeria");
  const mosaico = document.querySelector("[data-mosaico]");
  const filtros = document.querySelector("[data-filtros]");
  const mas = document.querySelector("[data-mas]");
  const visor = document.querySelector("[data-visor]");
  if (!seccion || !mosaico || !filtros || !mas || !visor) return;
  const lista = fotos.filter((foto) => foto.alt && foto.id !== reservada && foto.categoria);
  document.querySelectorAll("[data-nav-link][href='#galeria'], .nav-panel-link[href='#galeria'], .footer-nav a[href='#galeria']").forEach((nodo) => {
    if (lista.length < 4) nodo.hidden = true;
  });
  if (lista.length < 4) return;
  seccion.hidden = false;
  let filtro = "todo";
  let cupo = 9;
  let actuales = lista;
  const figura = visor.querySelector("[data-visor-figura]");
  const pie = visor.querySelector("[data-visor-pie]");
  const cuenta = visor.querySelector("[data-visor-cuenta]");
  let imagen = null;
  let indice = 0;
  let retorno = null;
  const pasa = (foto) => {
    if (filtro === "local") return ["fachada", "interior", "ambiente"].includes(foto.categoria);
    if (filtro === "cortes") return foto.categoria === "corte";
    if (filtro === "equipo") return foto.categoria === "equipo";
    if (filtro === "productos") return foto.categoria === "producto";
    return true;
  };
  const pintarVisor = () => {
    const foto = actuales[indice];
    if (!foto) return;
    const ancho = anchoDe(foto, 1200) || anchoDe(foto, 800);
    if (!imagen) {
      imagen = document.createElement("img");
      imagen.decoding = "async";
      figura.insertBefore(imagen, pie.parentElement);
    }
    imagen.src = urlDe(foto, ancho);
    imagen.srcset = srcsetDe(foto);
    imagen.sizes = "90vw";
    imagen.alt = foto.alt;
    imagen.width = foto.ancho;
    imagen.height = foto.alto;
    imagen.className = "mate-" + foto.id;
    pie.textContent = foto.alt;
    cuenta.textContent = (indice + 1) + " / " + actuales.length;
  };
  const abrir = (posicion) => {
    indice = posicion;
    retorno = document.activeElement;
    pintarVisor();
    visor.hidden = false;
    document.body.classList.add("menu-abierto");
    const cerrar = visor.querySelector("[data-visor-cerrar]");
    if (cerrar) cerrar.focus();
  };
  const cerrar = () => {
    visor.hidden = true;
    if (imagen) imagen.removeAttribute("src");
    if (!document.querySelector("[data-nav-panel]") || document.querySelector("[data-nav-panel]").hidden) {
      document.body.classList.remove("menu-abierto");
    }
    if (retorno && retorno.focus) retorno.focus();
  };
  const mover = (delta) => {
    if (!actuales.length || visor.hidden) return;
    indice = (indice + delta + actuales.length) % actuales.length;
    pintarVisor();
  };
  const pintar = () => {
    actuales = lista.filter(pasa);
    mosaico.replaceChildren();
    actuales.forEach((foto, posicion) => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "mosaico-item mate-" + foto.id + (posicion === 0 ? " ancho" : "");
      if (posicion >= cupo) boton.hidden = true;
      const img = document.createElement("img");
      const ancho = anchoDe(foto, 800);
      img.src = urlDe(foto, ancho);
      img.srcset = srcsetDe(foto);
      img.sizes = "(max-width: 699px) 50vw, 280px";
      img.alt = foto.alt;
      img.width = foto.ancho;
      img.height = foto.alto;
      img.loading = "lazy";
      img.decoding = "async";
      img.className = "mate-" + foto.id;
      boton.appendChild(img);
      boton.addEventListener("click", () => abrir(posicion));
      mosaico.appendChild(boton);
    });
    mas.hidden = actuales.length <= cupo;
    if (textos.verMas) mas.textContent = textos.verMas;
  };
  const defs = [
    ["todo", textos.filtroTodo || "Todo", () => true],
    ["local", textos.filtroLocal || "El local", (foto) => ["fachada", "interior", "ambiente"].includes(foto.categoria)],
    ["cortes", textos.filtroCortes || "Cortes", (foto) => foto.categoria === "corte"],
    ["equipo", textos.filtroEquipo || "Equipo", (foto) => foto.categoria === "equipo"],
    ["productos", textos.filtroProductos || "Productos", (foto) => foto.categoria === "producto"]
  ];
  defs.forEach(([id, etiqueta, fn]) => {
    if (id !== "todo" && !lista.some(fn)) return;
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "filtro";
    boton.setAttribute("aria-pressed", id === "todo" ? "true" : "false");
    boton.textContent = etiqueta;
    boton.addEventListener("click", () => {
      filtro = id;
      cupo = 9;
      filtros.querySelectorAll(".filtro").forEach((item) => item.setAttribute("aria-pressed", item === boton ? "true" : "false"));
      pintar();
    });
    filtros.appendChild(boton);
  });
  mas.addEventListener("click", () => {
    cupo += 9;
    pintar();
  });
  visor.querySelector("[data-visor-cerrar]").addEventListener("click", cerrar);
  visor.querySelector("[data-visor-prev]").addEventListener("click", () => mover(-1));
  visor.querySelector("[data-visor-next]").addEventListener("click", () => mover(1));
  let origenX = 0;
  let origenY = 0;
  visor.addEventListener("pointerdown", (event) => {
    origenX = event.clientX;
    origenY = event.clientY;
  });
  visor.addEventListener("pointerup", (event) => {
    const dx = event.clientX - origenX;
    const dy = event.clientY - origenY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    mover(dx < 0 ? 1 : -1);
  });
  document.addEventListener("keydown", (event) => {
    if (visor.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cerrar();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      mover(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      mover(-1);
    }
  });
  pintar();
  return { visor, cerrar };
};

const prepararMenu = () => {
  const panel = document.querySelector("[data-nav-panel]");
  const toggle = document.querySelector("[data-nav-toggle]");
  if (!panel || !toggle) return null;
  let retorno = null;
  const foco = () => [...panel.querySelectorAll("a, button")].filter((nodo) => !nodo.hidden);
  const abrir = () => {
    retorno = document.activeElement;
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-abierto");
    const primero = panel.querySelector("[data-nav-cerrar]") || foco()[0];
    if (primero) primero.focus();
  };
  const cerrar = () => {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    const visor = document.querySelector("[data-visor]");
    if (!visor || visor.hidden) document.body.classList.remove("menu-abierto");
    if (retorno && retorno.focus) retorno.focus();
  };
  toggle.addEventListener("click", () => {
    if (panel.hidden) abrir();
    else cerrar();
  });
  const botonCerrar = panel.querySelector("[data-nav-cerrar]");
  if (botonCerrar) botonCerrar.addEventListener("click", cerrar);
  panel.querySelectorAll("a").forEach((enlace) => enlace.addEventListener("click", cerrar));
  document.addEventListener("keydown", (event) => {
    if (panel.hidden) return;
    if (event.key === "Escape") {
      const visor = document.querySelector("[data-visor]");
      if (visor && !visor.hidden) return;
      event.preventDefault();
      cerrar();
      return;
    }
    if (event.key !== "Tab") return;
    const nodos = foco();
    if (!nodos.length) return;
    const primero = nodos[0];
    const ultimo = nodos[nodos.length - 1];
    if (event.shiftKey && document.activeElement === primero) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault();
      primero.focus();
    }
  });
  return { panel };
};

const prepararFaq = () => {
  (negocio.preguntas || []).forEach((item, indice) => {
    const pregunta = document.querySelector('[data-faq-q="' + indice + '"]');
    const respuesta = document.querySelector('[data-faq-a="' + indice + '"]');
    if (pregunta && item.pregunta) pregunta.textContent = item.pregunta;
    if (respuesta && item.respuesta) respuesta.textContent = item.respuesta;
  });
  document.querySelectorAll(".faq-q").forEach((boton) => {
    boton.addEventListener("click", () => {
      const item = boton.closest(".faq-item");
      const abierto = !item.classList.contains("is-open");
      item.classList.toggle("is-open", abierto);
      boton.setAttribute("aria-expanded", abierto ? "true" : "false");
    });
  });
  const lista = document.querySelector("[data-faq]");
  if (!lista) return;
  lista.addEventListener("keydown", (event) => {
    const botones = [...lista.querySelectorAll(".faq-q")];
    const indice = botones.indexOf(document.activeElement);
    if (indice < 0) return;
    let siguiente = -1;
    if (event.key === "ArrowDown") siguiente = (indice + 1) % botones.length;
    if (event.key === "ArrowUp") siguiente = (indice - 1 + botones.length) % botones.length;
    if (event.key === "Home") siguiente = 0;
    if (event.key === "End") siguiente = botones.length - 1;
    if (siguiente < 0) return;
    event.preventDefault();
    botones[siguiente].focus();
  });
};

const prepararCarrusel = () => {
  const pista = document.querySelector("[data-nosotros-pista]");
  const puntos = document.querySelector("[data-nosotros-puntos]");
  const prev = document.querySelector("[data-nosotros-prev]");
  const next = document.querySelector("[data-nosotros-next]");
  if (!pista || !puntos || !prev || !next) return;
  const tarjetas = [...pista.children];
  const paso = () => (tarjetas.length > 1 ? tarjetas[1].offsetLeft - tarjetas[0].offsetLeft : pista.clientWidth);
  const marcas = tarjetas.map((tarjeta, indice) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.setAttribute("aria-label", "Historia " + (indice + 1));
    const marca = document.createElement("i");
    boton.appendChild(marca);
    boton.addEventListener("click", () => {
      pista.scrollTo({ left: paso() * indice, behavior: reduce ? "auto" : "smooth" });
    });
    puntos.appendChild(boton);
    return boton;
  });
  const sincronizar = () => {
    const indice = Math.max(0, Math.min(tarjetas.length - 1, Math.round(pista.scrollLeft / (paso() || 1))));
    marcas.forEach((boton, posicion) => boton.setAttribute("aria-current", posicion === indice ? "true" : "false"));
  };
  const ir = (delta) => {
    const indice = Math.round(pista.scrollLeft / (paso() || 1)) + delta;
    const limite = Math.max(0, Math.min(tarjetas.length - 1, indice));
    pista.scrollTo({ left: paso() * limite, behavior: reduce ? "auto" : "smooth" });
  };
  prev.addEventListener("click", () => ir(-1));
  next.addEventListener("click", () => ir(1));
  pista.addEventListener("scroll", sincronizar, { passive: true });
  sincronizar();
};

const prepararMovimiento = (visor) => {
  const header = document.querySelector("[data-header]");
  const barra = document.querySelector("[data-barra]");
  const ratios = new Map();
  const marcar = () => {
    let mejor = "";
    let alto = 0.28;
    ratios.forEach((valor, id) => {
      if (valor > alto) {
        alto = valor;
        mejor = id;
      }
    });
    document.querySelectorAll("[data-nav-link]").forEach((enlace) => {
      const id = (enlace.getAttribute("href") || "").split("#")[1];
      if (id && id === mejor) enlace.setAttribute("aria-current", "true");
      else enlace.removeAttribute("aria-current");
    });
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target.hasAttribute("data-pie") && barra) {
        barra.classList.toggle("is-oculta", entry.isIntersecting);
        return;
      }
      if (entry.target.hasAttribute("data-nosotros-galeria")) {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll("[data-revelar]").forEach((nodo) => nodo.classList.add("is-in"));
        io.unobserve(entry.target);
        return;
      }
      if (entry.target.id && document.querySelector("[data-nav-link][href='#" + entry.target.id + "']")) {
        ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        marcar();
      }
      if (entry.target.hasAttribute("data-revelar") && entry.isIntersecting) {
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: [0, 0.15, 0.35, 0.6], rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll("[data-revelar]").forEach((nodo) => {
    if (!nodo.closest("[data-nosotros-galeria]")) io.observe(nodo);
  });
  const galeria = document.querySelector("[data-nosotros-galeria]");
  if (galeria) io.observe(galeria);
  document.querySelectorAll("main section[id]").forEach((seccion) => io.observe(seccion));
  const pie = document.querySelector("[data-pie]");
  if (pie) io.observe(pie);
  const alScroll = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  document.addEventListener("scroll", alScroll, { passive: true });
  alScroll();
  if (visor) {
    document.addEventListener("keydown", (event) => {
      if (visor.hidden || event.key !== "Tab") return;
      const nodos = [...visor.querySelectorAll("a, button")].filter((nodo) => !nodo.hidden);
      if (!nodos.length) return;
      const primero = nodos[0];
      const ultimo = nodos[nodos.length - 1];
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    });
  }
};

const iniciar = async () => {
  pintarEnlaces();
  pintarTextos();
  pintarNosotros();
  pintarPrivacidad();
  prepararFaq();
  prepararCarrusel();
  prepararMenu();
  let fotos = [];
  try {
    const respuesta = await fetch(carpeta + "fotos.json", { credentials: "same-origin" });
    if (respuesta.ok) {
      const data = await respuesta.json();
      if (Array.isArray(data)) fotos = data;
    }
  } catch (error) {
    fotos = [];
  }
  fotos.forEach(estilosFoto);
  prepararHero(fotos);
  const reservada = prepararAmbiente(fotos);
  prepararServicios(fotos);
  const visor = document.querySelector("[data-visor]");
  prepararGaleria(fotos, reservada);
  prepararMovimiento(visor);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }
};

iniciar();
