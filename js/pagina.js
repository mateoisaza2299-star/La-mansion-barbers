import {
  negocio,
  enlaceWhatsapp,
  enlaceTelefono,
  enlaceMapa,
  enlaceDirecciones,
  enlaceEmbed,
  urlInstagram,
  formatoPrecio,
  reservasEnLinea,
  tituloPublico,
  descripcionPublica,
  textoHorarioPublico,
  callePublica,
  urlSitio
} from "./config.js";
import { iniciarCarrusel } from "./carrusel.js";
import { prepararTrabajo } from "./trabajo.js";

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

const srcsetDe = (foto, maximo) => variantesDe(foto)
  .filter((item) => !maximo || item.ancho <= maximo)
  .map((item) => urlDe(foto, item.ancho) + " " + item.ancho + "w")
  .join(", ");

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
  const contacto = negocio.mostrarWhatsappContacto !== false && wa;
  document.querySelectorAll("[data-wa-contacto]").forEach((nodo) => {
    nodo.hidden = !contacto;
    if (!contacto) return;
    const numero = String(negocio.whatsapp || "").replace(/\D/g, "");
    nodo.href = "https://wa.me/" + numero;
    nodo.target = "_blank";
    nodo.rel = "noopener";
    const etiqueta = nodo.querySelector("[data-wa-numero]");
    if (etiqueta && negocio.telefono) etiqueta.textContent = negocio.telefono;
  });
  document.querySelectorAll("[data-wa]").forEach((nodo) => {
    if (nodo.hasAttribute("data-wa-contacto")) return;
    if (!wa) return;
    nodo.href = wa;
    nodo.target = "_blank";
    nodo.rel = "noopener";
  });
  const tel = enlaceTelefono();
  document.querySelectorAll("[data-tel]").forEach((nodo) => {
    if (tel) nodo.href = tel;
  });
  const llegar = enlaceDirecciones();
  document.querySelectorAll("[data-maps]").forEach((nodo) => {
    if (!llegar) return;
    nodo.href = llegar;
    nodo.target = "_blank";
    nodo.rel = "noopener";
  });
  const buscar = enlaceMapa();
  document.querySelectorAll("[data-maps-buscar]").forEach((nodo) => {
    if (!buscar) return;
    nodo.href = buscar;
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

const pintarMeta = (selector, valor) => {
  document.querySelectorAll(selector).forEach((nodo) => {
    if (valor) nodo.setAttribute("content", valor);
  });
};

const aplicarEsquema = () => {
  const nodo = document.getElementById("schema-negocio");
  if (!nodo) return;
  const partes = String(negocio.ciudad || "").split(",").map((parte) => parte.trim());
  const nombres = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday" };
  const horario = negocio.horario && typeof negocio.horario === "object" ? negocio.horario : {};
  const dias = Array.isArray(horario.dias) ? horario.dias : [];
  const data = {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    name: negocio.nombre,
    image: urlSitio("assets/og.jpg"),
    url: urlSitio(""),
    address: {
      "@type": "PostalAddress",
      streetAddress: callePublica(),
      addressLocality: partes[0] || negocio.zona || "",
      addressRegion: partes[1] || "",
      addressCountry: "CO"
    }
  };
  const telefono = String(negocio.whatsapp || "").replace(/\D/g, "");
  if (telefono) data.telephone = "+" + telefono;
  if (horario.abre && horario.cierra && dias.length) {
    data.openingHoursSpecification = dias.filter((dia) => nombres[dia]).map((dia) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: nombres[dia],
      opens: horario.abre,
      closes: horario.cierra
    }));
  }
  const mapa = enlaceMapa();
  if (mapa) data.hasMap = mapa;
  const instagram = urlInstagram();
  if (instagram) data.sameAs = [instagram];
  nodo.textContent = JSON.stringify(data);
};

const pintarTextos = () => {
  const titulo = tituloPublico();
  const descripcion = descripcionPublica();
  const etiqueta = "BARBER SHOP · " + String(negocio.zona || "").toLocaleUpperCase("es-CO");
  const lead = "Cortes, barba y cuidado personal en " + negocio.ciudad + ".";
  document.title = document.body.dataset.pagina === "historia" ? "Nuestra historia | La Mansión Barber Shop" : titulo;
  pintarMeta('meta[name="description"]', descripcion);
  pintarMeta('meta[property="og:title"]', titulo);
  pintarMeta('meta[property="og:description"]', descripcion);
  pintarMeta('meta[name="twitter:title"]', titulo);
  pintarMeta('meta[name="twitter:description"]', descripcion);
  pintarMeta('meta[property="og:image:alt"]', "Letrero de neón de " + negocio.nombre + " en " + (negocio.zona || "") + ".");
  pintarMeta('meta[name="twitter:image:alt"]', "Letrero de neón de " + negocio.nombre + " en " + (negocio.zona || "") + ".");
  document.querySelectorAll("[data-texto]").forEach((nodo) => {
    const clave = nodo.getAttribute("data-texto");
    if (clave === "heroEtiqueta") {
      nodo.textContent = etiqueta;
      return;
    }
    if (clave === "heroLead") {
      nodo.textContent = lead;
      return;
    }
    const valor = textos[clave];
    if (valor) nodo.textContent = valor;
  });
  document.querySelectorAll("[data-ciudad]").forEach((nodo) => {
    if (negocio.ciudad) nodo.textContent = negocio.ciudad;
  });
  document.querySelectorAll("[data-direccion]").forEach((nodo) => {
    if (negocio.direccion) nodo.textContent = negocio.direccion;
  });
  document.querySelectorAll("[data-direccion-corta]").forEach((nodo) => {
    if (negocio.direccionCorta) nodo.textContent = negocio.direccionCorta;
  });
  document.querySelectorAll("[data-horario]").forEach((nodo) => {
    const valor = textoHorarioPublico();
    if (valor) nodo.textContent = valor;
  });
  document.querySelectorAll("[data-marca-local]").forEach((nodo) => {
    nodo.textContent = negocio.nombreCorto + " · " + (negocio.zona || "");
  });
  aplicarEsquema();
  const antes = document.querySelector("[data-hero-antes]");
  const palabra = document.querySelector("[data-hero-palabra]");
  const despues = document.querySelector("[data-hero-despues]");
  if (antes && textos.heroAntes) antes.textContent = textos.heroAntes;
  if (palabra && textos.heroPalabra) palabra.textContent = textos.heroPalabra;
  if (despues && textos.heroDespues) despues.textContent = textos.heroDespues;
  const robots = document.querySelector("[data-robots-vivo]");
  if (robots) robots.setAttribute("content", negocio.indexable === true ? "index, follow" : "noindex, nofollow");
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

const usos = new Map();
const enHero = new Set();
const enServicios = new Set();
const puede = (foto) => !!(foto && esId(foto.id) && (usos.get(foto.id) || 0) < 2);
const marcar = (foto, bolsa) => {
  if (!puede(foto)) return false;
  usos.set(foto.id, (usos.get(foto.id) || 0) + 1);
  if (bolsa) bolsa.add(foto.id);
  return true;
};
const reservarApariciones = (fotos) => {
  fotos.forEach((foto) => {
    if (foto && (foto.categoria === "nosotros" || String(foto.id || "").startsWith("nosotros-"))) usos.set(foto.id, 1);
  });
};
const ladoDe = (foto) => Math.max(Number(foto && foto.ancho) || 0, Number(foto && foto.alto) || 0);
const proporcionDe = (foto) => (foto && foto.alto ? foto.ancho / foto.alto : 0);
const menorEnPrimerPlano = (foto) => {
  if (!foto) return false;
  if (foto.id === "nosotros-1" || foto.id === "nosotros-2") return true;
  return /niñ|niño|pequeñ/i.test(foto.alt || "");
};
const esHorizontalApta = (foto) => !!(
  foto &&
  foto.aptaFondo &&
  proporcionDe(foto) >= 1.3 &&
  ["fachada", "interior", "ambiente"].includes(foto.categoria) &&
  !menorEnPrimerPlano(foto)
);

const crearImagen = (foto, opciones) => {
  const preferido = opciones.ancho || 800;
  const ancho = anchoDe(foto, preferido) || anchoDe(foto, 480);
  if (!ancho) return null;
  const img = document.createElement("img");
  img.src = urlDe(foto, ancho);
  img.srcset = opciones.maximo ? srcsetDe(foto, opciones.maximo) : srcsetDe(foto);
  img.sizes = opciones.sizes || "100vw";
  img.alt = opciones.alt || "";
  img.width = foto.ancho;
  img.height = foto.alto;
  img.decoding = "async";
  if (opciones.prioridad) img.setAttribute("fetchpriority", "high");
  else img.loading = "lazy";
  img.className = "mate-" + foto.id;
  return img;
};

const precargar = (foto) => {
  const ancho = anchoDe(foto, 800) || anchoDe(foto, 480);
  if (!ancho || document.head.querySelector('link[data-hero-preload]')) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = urlDe(foto, ancho);
  link.setAttribute("fetchpriority", "high");
  link.setAttribute("data-hero-preload", "");
  document.head.appendChild(link);
};

const estilosFoto = (foto) => {
  if (!esId(foto.id) || !esColor(foto.colorMedio)) return;
  regla(".mate-" + foto.id + "{background-color:" + foto.colorMedio + "}");
  regla("img.mate-" + foto.id + ",.mate-" + foto.id + " img{object-position:" + focoDe(foto) + "}");
};

const meterFoto = (contenedor, foto, opciones) => {
  if (!contenedor || !foto || !marcar(foto)) return false;
  const img = crearImagen(foto, opciones || {});
  if (!img) return false;
  contenedor.classList.add("tiene-foto", "mate-" + foto.id);
  contenedor.appendChild(img);
  return true;
};

const cartaFija = {
  Cortes: "corte-duo",
  "FreeStyle y diseños": "corte-freestyle",
  "Cuidado facial": "corte-mascara"
};
const idsCarta = new Set(Object.values(cartaFija));

const prepararHero = (fotos) => {
  const fondo = document.querySelector("[data-hero-fondo]");
  const hero = document.querySelector(".hero");
  if (!fondo || !hero) return;
  const horizontales = fotos
    .filter((foto) => esHorizontalApta(foto) && puede(foto))
    .sort((a, b) => Number(b.destacada) - Number(a.destacada) || ladoDe(b) - ladoDe(a))
    .slice(0, estatico ? 1 : 3);
  if (horizontales.length) {
    hero.classList.remove("is-partido");
    const textura = document.querySelector("[data-hero-textura]");
    const marcos = document.querySelector("[data-hero-marcos]");
    if (textura) textura.hidden = true;
    if (marcos) marcos.hidden = true;
    precargar(horizontales[0]);
    horizontales.forEach((foto, indice) => {
      if (!marcar(foto, enHero)) return;
      const capa = document.createElement("div");
      capa.className = "hero-slide mate-" + foto.id + (indice === 0 ? " is-on" : "");
      const img = crearImagen(foto, {
        alt: "",
        sizes: "100vw",
        ancho: indice === 0 ? 1800 : 1200,
        prioridad: indice === 0
      });
      if (!img) return;
      capa.appendChild(img);
      fondo.appendChild(capa);
    });
    if (horizontales.length > 1 && !estatico) {
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
    return;
  }
  hero.classList.add("is-partido");
  const ordenAmbiente = { interior: 0, ambiente: 1, fachada: 2 };
  const texturaFoto = fotos
    .filter((foto) => ["interior", "ambiente", "fachada"].includes(foto.categoria) && !menorEnPrimerPlano(foto) && puede(foto))
    .sort((a, b) => (ordenAmbiente[a.categoria] ?? 9) - (ordenAmbiente[b.categoria] ?? 9) || ladoDe(b) - ladoDe(a))[0];
  const preferencia = ["corte-barba", "corte-facial", "corte-spray", "corte-capa"];
  const marcos = fotos
    .filter((foto) => foto.categoria === "corte" && foto.orientacion === "vertical" && !menorEnPrimerPlano(foto) && ladoDe(foto) >= 640 && !idsCarta.has(foto.id) && puede(foto) && (!texturaFoto || foto.id !== texturaFoto.id))
    .sort((a, b) => {
      const ia = preferencia.indexOf(a.id);
      const ib = preferencia.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || ladoDe(b) - ladoDe(a);
    })
    .slice(0, 2);
  const principal = marcos[0];
  const secundaria = marcos[1];
  if (principal) {
    precargar(principal);
    const caja = document.querySelector("[data-hero-principal]");
    if (caja) {
      caja.classList.add("mate-" + principal.id);
      const img = crearImagen(principal, {
        alt: principal.alt,
        sizes: "(max-width: 899px) 92vw, 38vw",
        ancho: 1200,
        prioridad: true
      });
      if (img && marcar(principal, enHero)) caja.appendChild(img);
    }
  }
  if (secundaria) {
    const caja = document.querySelector("[data-hero-sec]");
    if (caja) {
      caja.classList.add("mate-" + secundaria.id);
      const img = crearImagen(secundaria, {
        alt: secundaria.alt,
        sizes: "(min-width: 900px) 22vw, 1px",
        ancho: 800
      });
      if (img && marcar(secundaria, enHero)) caja.appendChild(img);
    }
  }
  const textura = document.querySelector("[data-hero-textura]");
  if (textura && texturaFoto) {
    const img = crearImagen(texturaFoto, { alt: "", sizes: "100vw", ancho: 480, maximo: 480 });
    if (img && marcar(texturaFoto, enHero)) {
      textura.classList.add("tiene-foto", "mate-" + texturaFoto.id);
      textura.appendChild(img);
    }
  }
};

const elegirLibre = (fotos, filtro) => fotos
  .filter((foto) => filtro(foto) && puede(foto) && !menorEnPrimerPlano(foto))
  .sort((a, b) => Number(b.tono === "oscuro") - Number(a.tono === "oscuro") || Number(b.destacada) - Number(a.destacada) || ladoDe(b) - ladoDe(a))[0];

const prepararFondos = (fotos) => {
  const cita = document.querySelector("[data-cita-fondo]");
  const ambiente = elegirLibre(fotos, (foto) => foto.categoria === "ambiente");
  if (cita && ambiente) meterFoto(cita, ambiente, { alt: "", sizes: "100vw", ancho: 1200 });
  const panel = document.querySelector("[data-nav-foto]");
  const menu = elegirLibre(fotos, (foto) => foto.categoria === "ambiente");
  if (panel && menu && meterFoto(panel, menu, { alt: "", sizes: "100vw", ancho: 800 })) {
    panel.hidden = false;
    const nav = document.querySelector("[data-nav-panel]");
    if (nav) nav.classList.add("tiene-foto");
  }
  const visita = document.querySelector("[data-visita-fondo]");
  const visitaFoto = elegirLibre(fotos, (foto) => foto.categoria === "fachada" || foto.categoria === "interior");
  if (visita && visitaFoto && meterFoto(visita, visitaFoto, { alt: "", sizes: "(min-width: 900px) 62vw, 100vw", ancho: 1200 })) {
    if (visitaFoto.orientacion === "vertical") visita.classList.add("es-panel");
  }
  const pista = document.querySelector("[data-pista]");
  if (pista && fotos.some((foto) => foto.categoria === "fachada")) {
    pista.hidden = false;
    if (textos.pista) pista.textContent = textos.pista;
  }
  const productos = fotos.filter((foto) => foto.categoria === "producto" && puede(foto));
  const seccion = document.getElementById("productos");
  const fondoProductos = document.querySelector("[data-productos-fondo]");
  if (seccion && productos.length) {
    seccion.hidden = false;
    if (fondoProductos) meterFoto(fondoProductos, productos[0], { alt: "", sizes: "100vw", ancho: 1200 });
  }
};

const refrescarNosotros = (fotos) => {
  fotos.filter((foto) => foto.categoria === "nosotros" && esId(foto.id)).forEach((foto) => {
    const img = document.querySelector(".mate-" + foto.id + " img");
    const ancho = anchoDe(foto, 800) || anchoDe(foto, 480);
    if (!img || !ancho) return;
    img.src = urlDe(foto, ancho);
    img.srcset = srcsetDe(foto);
    img.width = foto.ancho;
    img.height = foto.alto;
  });
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
  if (servicio.precio === null || servicio.precio === undefined || servicio.precio === "") precio.textContent = textos.consultar || "Precio por confirmar";
  else precio.textContent = formatoPrecio(servicio.precio);
  const reservar = document.createElement("button");
  reservar.type = "button";
  reservar.className = "btn btn-sec";
  reservar.textContent = "Reservar";
  reservar.dataset.reservar = "1";
  reservar.dataset.servicio = servicio.id || "";
  reservar.dataset.servicioNombre = servicio.nombre || "";
  article.append(titulo, texto, precio, reservar);
  return article;
};

const slug = (valor) => valor.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const categoriaPublica = (nombre) => nombre && !["Niños", "Mujer", "Color"].includes(nombre);

const cargarServiciosMenu = async () => {
  if (!reservasEnLinea()) return null;
  try {
    const modulo = await import("./supabase.js");
    const supabase = await modulo.obtenerSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("servicios").select("*").eq("activo", true).order("orden");
    if (error || !Array.isArray(data)) return null;
    return data.filter((item) => item && item.activo !== false && categoriaPublica(item.categoria));
  } catch (error) {
    return null;
  }
};

const prepararServicios = async (fotos) => {
  const carta = document.querySelector("[data-carta]");
  const estatica = document.querySelector("[data-carta-estatica]");
  if (!carta) return;
  const remoto = await cargarServiciosMenu();
  const catalogo = (Array.isArray(remoto) ? remoto : (negocio.servicios || [])).filter((item) => categoriaPublica(item.categoria));
  if (!catalogo.length) {
    if (estatica) estatica.hidden = true;
    carta.hidden = true;
    return;
  }
  const orden = ["Cortes", "Barba", "FreeStyle y diseños", "Cuidado facial"];
  const presentes = [];
  orden.forEach((nombre) => {
    if (catalogo.some((item) => item.categoria === nombre)) presentes.push(nombre);
  });
  catalogo.forEach((item) => {
    if (item.categoria && !presentes.includes(item.categoria)) presentes.push(item.categoria);
  });
  const banco = fotos.filter((foto) => ["corte", "equipo", "producto", "interior", "nosotros"].includes(foto.categoria) && ladoDe(foto) >= 480);
  const tabs = carta.querySelector("[data-carta-tabs]");
  const paneles = carta.querySelector("[data-carta-paneles]");
  const movil = carta.querySelector("[data-carta-movil]");
  const hueco = carta.querySelector("[data-carta-foto]");
  const enServicio = new Set();
  const asignadas = new Map();
  let previa = "";
  const candidatas = (nombre) => banco.filter((foto) => {
    if (idsCarta.has(foto.id) || menorEnPrimerPlano(foto)) return false;
    if (nombre === "Barba") return foto.categoria === "corte" || foto.categoria === "equipo";
    if (nombre === "Cuidado facial") return ["producto", "interior", "corte"].includes(foto.categoria);
    return foto.categoria === "corte";
  }).filter((foto) => foto.id !== previa);
  presentes.forEach((nombre) => {
    const idFijo = cartaFija[nombre];
    const fija = idFijo ? fotos.find((foto) => foto.id === idFijo) : null;
    if (fija && esId(fija.id)) {
      if (!enServicio.has(fija.id)) {
        if (!marcar(fija, enServicios)) return;
        enServicio.add(fija.id);
      }
      asignadas.set(nombre, fija);
      previa = fija.id;
      return;
    }
    const pool = candidatas(nombre).filter((foto) => puede(foto) || enServicio.has(foto.id));
    const lista = (pool.length ? pool : candidatas(nombre).filter((foto) => enServicio.has(foto.id)))
      .slice()
      .sort((a, b) => Number(enHero.has(a.id)) - Number(enHero.has(b.id)) || Number(a.categoria !== "corte") - Number(b.categoria !== "corte") || a.id.localeCompare(b.id));
    const foto = lista[0];
    if (!foto) return;
    if (!enServicio.has(foto.id)) {
      if (!marcar(foto, enServicios)) return;
      enServicio.add(foto.id);
    }
    asignadas.set(nombre, foto);
    previa = foto.id;
  });
  if (hueco && !asignadas.size) hueco.hidden = true;
  let fotoNodo = null;
  let fotoActual = "";
  const ponerFoto = (nombre) => {
    const foto = asignadas.get(nombre);
    const estrecha = window.matchMedia("(max-width: 899px)").matches;
    const destino = estrecha ? carta.querySelector(".acordeon-item.is-open .acordeon-foto") : hueco;
    if (!foto || !destino) return;
    const ancho = anchoDe(foto, 800);
    if (!ancho) return;
    const aplicar = () => {
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
      fotoActual = foto.id;
      window.requestAnimationFrame(() => fotoNodo.classList.remove("is-out"));
    };
    if (!fotoNodo || fotoActual === foto.id || reduce || estatico) {
      aplicar();
      return;
    }
    fotoNodo.classList.add("is-out");
    window.setTimeout(aplicar, 220);
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
    const servicios = catalogo.filter((item) => item.categoria === nombre);
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

const fraseLocal = (categoria) => {
  if (categoria === "equipo") return "El lugar";
  if (categoria === "corte") return "El oficio";
  if (categoria === "producto") return "El detalle";
  return "El lugar";
};

const prepararLocal = (fotos) => {
  const seccion = document.getElementById("local");
  const enlaces = document.querySelectorAll("a[href='#local'], a[href='index.html#local']");
  const ocultarEnlace = (nodo) => {
    nodo.hidden = true;
    const li = nodo.parentElement;
    if (li && li.tagName === "LI") li.hidden = true;
  };
  const orden = { fachada: 0, interior: 1, ambiente: 2, equipo: 3, corte: 4, producto: 5 };
  const base = fotos.filter((foto) => (
    foto &&
    (foto.calidad === "alta" || foto.calidad === "media") &&
    ["fachada", "interior", "ambiente", "equipo", "corte", "producto"].includes(foto.categoria) &&
    !String(foto.id || "").startsWith("nosotros-") &&
    !menorEnPrimerPlano(foto) &&
    puede(foto)
  )).sort((a, b) => (orden[a.categoria] ?? 9) - (orden[b.categoria] ?? 9) || ladoDe(b) - ladoDe(a));
  const ocupadas = new Set([...enHero, ...enServicios]);
  let lista = base.filter((foto) => !ocupadas.has(foto.id));
  if (lista.length < 3) lista = base.slice();
  lista = lista.slice(0, 8);
  if (lista.length < 3) {
    if (seccion) seccion.hidden = true;
    enlaces.forEach(ocultarEnlace);
    return;
  }
  if (!seccion) return;
  lista.forEach((foto) => marcar(foto));
  seccion.hidden = false;
  iniciarCarrusel({
    raiz: seccion,
    fotos: lista,
    estatico,
    urlDe,
    anchoDe,
    frase: fraseLocal
  });
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
    document.body.classList.remove("menu-abierto");
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
    if (!respuesta) return;
    if (item.pregunta === "¿Dónde están?") respuesta.textContent = negocio.direccion || "";
    else if (item.pregunta === "¿Cuál es el horario?") respuesta.textContent = item.respuesta || textoHorarioPublico();
    else if (item.respuesta) respuesta.textContent = item.respuesta;
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

const prepararMovimiento = () => {
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
  reservarApariciones(fotos);
  refrescarNosotros(fotos);
  prepararHero(fotos);
  prepararFondos(fotos);
  await prepararServicios(fotos);
  prepararLocal(fotos);
  prepararMapa();
  if (document.querySelector("[data-trabajo]")) prepararTrabajo({ fotos, puede, marcar, crearImagen, reducir: reduce });
  prepararMovimiento();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }
  const modulo = await import("./reservas.js");
  await modulo.iniciarReservas();
};

const prepararMapa = () => {
  const marco = document.querySelector("[data-mapa]");
  if (!marco) return;
  const espera = marco.querySelector("[data-mapa-espera]");
  const cargar = () => {
    if (marco.dataset.listo === "1") return;
    const src = enlaceEmbed();
    if (!src) return;
    marco.dataset.listo = "1";
    const iframe = document.createElement("iframe");
    iframe.title = "Mapa de La Mansión Barber Shop";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox");
    iframe.src = src;
    let resuelto = false;
    const caer = () => {
      if (resuelto) return;
      resuelto = true;
      iframe.remove();
      marco.dataset.listo = "";
      marco.dataset.fallo = "1";
      if (!espera) return;
      espera.hidden = false;
      const boton = espera.querySelector("[data-mapa-ver]");
      if (boton) boton.textContent = "Abrir en Google Maps";
    };
    const timer = window.setTimeout(caer, 8000);
    iframe.addEventListener("load", () => {
      if (resuelto) return;
      resuelto = true;
      window.clearTimeout(timer);
      if (espera) espera.hidden = true;
    });
    iframe.addEventListener("error", caer);
    marco.appendChild(iframe);
  };
  const ver = marco.querySelector("[data-mapa-ver]");
  if (ver) ver.addEventListener("click", () => {
    if (marco.dataset.fallo === "1") {
      const url = enlaceMapa();
      if (url) window.open(url, "_blank", "noopener");
      return;
    }
    cargar();
  });
  if (ahorrar) return;
  if (!("IntersectionObserver" in window)) {
    cargar();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    io.disconnect();
    cargar();
  }, { rootMargin: "300px" });
  io.observe(marco);
};

iniciar();
