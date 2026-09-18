const NOTAS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const AFINACION = [4, 11, 7, 2, 9, 4]; // e, B, G, D, A, E
const TOTAL_TRASTES = 24;

const ETIQUETAS_INTERVALOS = {
  0: "1",
  1: "b2",
  2: "2",
  3: "b3",
  4: "3",
  5: "4",
  6: "b5",
  7: "5",
  8: "b6",
  9: "6",
  10: "b7",
  11: "7",
};

const DATOS_ESCALAS = {
  mayor: {
    intervalos: [0, 2, 4, 5, 7, 9, 11],
    construccion: "T-T-ST-T-T-T-ST",
    armonizacion: "I - ii - iii - IV - V - vi - vii°",
  },
  menor: {
    intervalos: [0, 2, 3, 5, 7, 8, 10],
    construccion: "T-ST-T-T-ST-T-T",
    armonizacion: "i - ii° - III - iv - v - VI - VII",
  },
  "pent-menor": {
    intervalos: [0, 3, 5, 7, 10],
    construccion: "3ST - T - T - 3ST - T",
    armonizacion: "i - III - iv - v - VII",
  },
  "pent-mayor": {
    intervalos: [0, 2, 4, 7, 9],
    construccion: "T - T - 3ST - T - 3ST",
    armonizacion: "I - ii - iii - V - vi",
  },
  "blues-menor": {
    intervalos: [0, 3, 5, 6, 7, 10],
    construccion: "3ST - T - ST - ST - 3ST - T",
    armonizacion: "I7 - IV7 - V7",
  },
  "blues-mayor": {
    intervalos: [0, 2, 3, 4, 7, 9],
    construccion: "T - ST - ST - 3ST - T - 3ST",
    armonizacion: "I7 - IV7 - V7",
  },
  armonica: {
    intervalos: [0, 2, 3, 5, 7, 8, 11],
    construccion: "T - ST - T - T - ST - 3ST - ST",
    armonizacion: "i - ii° - III+ - iv - V - VI - vii°",
  },
  melodica: {
    intervalos: [0, 2, 3, 5, 7, 9, 11],
    construccion: "T - ST - T - T - T - T - ST",
    armonizacion: "i - ii - III+ - IV - V - vi° - vii°",
  },
  dorico: {
    intervalos: [0, 2, 3, 5, 7, 9, 10],
    construccion: "T - ST - T - T - T - ST - T",
    armonizacion: "i - ii - III - IV - v - vi° - VII",
  },
  frigio: {
    intervalos: [0, 1, 3, 5, 7, 8, 10],
    construccion: "ST - T - T - T - ST - T - T",
    armonizacion: "i - II - III - iv - v° - VI - vii",
  },
  lidio: {
    intervalos: [0, 2, 4, 6, 7, 9, 11],
    construccion: "T - T - T - ST - T - T - ST",
    armonizacion: "I - II - iii - iv° - V - vi - vii",
  },
  mixolidio: {
    intervalos: [0, 2, 4, 5, 7, 9, 10],
    construccion: "T - T - ST - T - T - ST - T",
    armonizacion: "I - ii - iii° - IV - v - vi - VII",
  },
  locrio: {
    intervalos: [0, 1, 3, 5, 6, 8, 10],
    construccion: "ST - T - T - ST - T - T - T",
    armonizacion: "i° - II - iii - iv - V - VI - vii",
  },
};

const DATOS_ARPEGIOS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  aug: [0, 4, 8],
  dim: [0, 3, 6],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
};

function vincularEvento(id, evento, funcion) {
  var el = document.getElementById(id);
  if (el) {
    el.removeEventListener(evento, funcion);
    el.addEventListener(evento, funcion);
  }
}

function cambiarPestana(modId) {
  document.querySelectorAll(".modulo").forEach(function (el) {
    el.classList.remove("activo");
  });
  document.querySelectorAll(".pestana").forEach(function (el) {
    el.classList.remove("activa");
  });

  var targetModule = document.getElementById("modulo-" + modId);
  if (targetModule) targetModule.classList.add("activo");

  var targetBtn = document.querySelector(".pestana[onclick*='" + modId + "']");
  if (targetBtn) targetBtn.classList.add("activa");
}

function construirDiapason(idContenedor, idMarcadores, prefijo) {
  var contenedor = document.getElementById(idContenedor);
  var marcadores = document.getElementById(idMarcadores);
  if (!contenedor || !marcadores) return;

  contenedor.innerHTML = "";
  marcadores.innerHTML = "";

  var notasAire = ["e", "B", "G", "D", "A", "E"];

  for (var cuerda = 0; cuerda < 6; cuerda++) {
    for (var traste = 0; traste <= TOTAL_TRASTES; traste++) {
      var celda = document.createElement("div");
      celda.className = "celda traste-" + traste + " cuerda-" + cuerda;
      celda.id = prefijo + "-" + cuerda + "-" + traste;

      if (traste === 0) {
        var elAire = document.createElement("span");
        elAire.className = "nota-aire";
        elAire.textContent = notasAire[cuerda];
        celda.appendChild(elAire);
      }

      contenedor.appendChild(celda);
    }
  }
  for (var t = 0; t <= TOTAL_TRASTES; t++) {
    var num = document.createElement("div");
    num.textContent = t === 0 ? "0" : t.toString();
    marcadores.appendChild(num);
  }
}

function inyectarNota(prefijo, cuerda, traste, claseColor, texto) {
  var celda = document.getElementById(prefijo + "-" + cuerda + "-" + traste);
  if (celda) {
    var notaDiv = celda.querySelector(".nota");
    if (!notaDiv) {
      notaDiv = document.createElement("div");
      celda.appendChild(notaDiv);
    }
    notaDiv.className = "nota " + claseColor;
    notaDiv.textContent = texto;
    notaDiv.style.fontSize = texto.indexOf("\n") !== -1 ? "9px" : "11px";
  }
}

function aplicarRangoTrastes(prefijo) {
  var inicioInput = document.getElementById("rango-inicio-" + prefijo);
  var finInput = document.getElementById("rango-fin-" + prefijo);
  if (!inicioInput || !finInput) return { inicio: 0, fin: 24 };

  var inicio = parseInt(inicioInput.value);
  var fin = parseInt(finInput.value);

  if (fin - inicio < 3) {
    fin = inicio + 3;
    if (fin > 24) {
      fin = 24;
      inicio = 21;
    }
    inicioInput.value = inicio;
    finInput.value = fin;
  }

  for (var t = 0; t <= TOTAL_TRASTES; t++) {
    document
      .querySelectorAll(
        "#grid-" +
          prefijo +
          " .traste-" +
          t +
          ", #marc-" +
          prefijo +
          " div:nth-child(" +
          (t + 1) +
          ")",
      )
      .forEach(function (el) {
        el.style.display = t < inicio || t > fin ? "none" : "flex";
      });
  }

  var numCols = fin - inicio + 1;
  var colTemplate =
    inicio === 0
      ? "40px repeat(" + (numCols - 1) + ", 60px)"
      : "repeat(" + numCols + ", 60px)";

  document.getElementById("grid-" + prefijo).style.gridTemplateColumns =
    colTemplate;
  document.getElementById("marc-" + prefijo).style.gridTemplateColumns =
    colTemplate;

  return { inicio: inicio, fin: fin };
}

function buscarTrastes(indiceCuerda, indiceNotaObjetivo) {
  var trastes = [];
  for (var traste = 0; traste <= TOTAL_TRASTES; traste++) {
    if ((AFINACION[indiceCuerda] + traste) % 12 === indiceNotaObjetivo)
      trastes.push(traste);
  }
  return trastes;
}

// =================== MÓDULO 1: TRÍADAS (ORIGINAL INTACTO) ===================
function renderizarTriadas() {
  aplicarRangoTrastes("triadas");
  document.querySelectorAll("#grid-triadas .nota").forEach(function (n) {
    n.remove();
  });

  var elNota = document.getElementById("selector-nota-triadas");
  var elCuerdas = document.getElementById("selector-cuerdas-triadas");
  var selNota = elNota ? elNota.value : "C";
  var selCuerdas = elCuerdas ? elCuerdas.value : "1";

  var rIdx = NOTAS.indexOf(selNota);
  var gc = parseInt(selCuerdas);
  if (isNaN(gc) || rIdx === -1) return;

  var c1 = gc - 1,
    c2 = gc,
    c3 = gc + 1;
  var tIdx = (rIdx + 4) % 12,
    qIdx = (rIdx + 7) % 12;

  [
    { c: "estado-fundamental", o: [rIdx, tIdx, qIdx] },
    { c: "inversion-1", o: [tIdx, qIdx, rIdx] },
    { c: "inversion-2", o: [qIdx, rIdx, tIdx] },
  ].forEach(function (i) {
    buscarTrastes(c3, i.o[0]).forEach(function (t3) {
      buscarTrastes(c2, i.o[1]).forEach(function (t2) {
        buscarTrastes(c1, i.o[2]).forEach(function (t1) {
          var tr = [t1, t2, t3].filter(function (t) {
            return t !== 0;
          });
          if (
            tr.length > 0 &&
            Math.max.apply(null, tr) - Math.min.apply(null, tr) <= 4
          ) {
            inyectarNota("tr", c3, t3, i.c, NOTAS[i.o[0]]);
            inyectarNota("tr", c2, t2, i.c, NOTAS[i.o[1]]);
            inyectarNota("tr", c1, t1, i.c, NOTAS[i.o[2]]);
          }
        });
      });
    });
  });
}

// =================== MÓDULO 4: DOUBLE STOPS (ORIGINAL INTACTO) ===================
function renderizarDoubleStops() {
  aplicarRangoTrastes("ds");
  document.querySelectorAll("#grid-ds .nota").forEach(function (n) {
    n.remove();
  });

  var elNota = document.getElementById("selector-nota-ds");
  var elInt = document.getElementById("selector-intervalo-ds");
  var rIdx = NOTAS.indexOf(elNota ? elNota.value : "C");
  if (rIdx === -1) return;

  var tIdx = (rIdx + parseInt(elInt ? elInt.value : "3")) % 12;

  for (var cb = 1; cb <= 5; cb++) {
    buscarTrastes(cb, rIdx).forEach(function (tb) {
      [cb - 1, cb - 2]
        .filter(function (c) {
          return c >= 0;
        })
        .forEach(function (ct) {
          buscarTrastes(ct, tIdx).forEach(function (tt) {
            if (Math.abs(tt - tb) <= 4 || tb === 0 || tt === 0) {
              inyectarNota("ds", cb, tb, "estado-fundamental", NOTAS[rIdx]);
              inyectarNota("ds", ct, tt, "intervalo-ds", NOTAS[tIdx]);
            }
          });
        });
    });
  }
}

// =================== SELECTORES GLOBALES ===================
function actualizarSelectoresNotas() {
  var selects = [
    "selector-nota-triadas",
    "selector-nota-ds",
    "selector-nota-esc",
    "selector-nota-arp",
    "selector-nota-caged",
  ];
  selects.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      var valActual = el.value || "C";
      el.innerHTML = NOTAS.map(function (n) {
        return "<option value='" + n + "'>" + n + "</option>";
      }).join("");
      el.value = valActual;
    }
  });
}

function actualizarOpcionesSistemaEscala() {
  var selTipoElem = document.getElementById("selector-tipo-esc");
  var tipo = selTipoElem ? selTipoElem.value || "mayor" : "mayor";
  var selectSistema = document.getElementById("selector-sistema-esc");
  if (!selectSistema) return;

  var html = '<option value="todo">Mástil Completo (Sin resaltar)</option>';

  if (tipo.indexOf("pent") !== -1 || tipo.indexOf("blues") !== -1) {
    html +=
      '<optgroup label="Cajas Pentatónicas (2NPS Puras)">' +
      '<option value="pent-0">Posición 1 (Raíz)</option>' +
      '<option value="pent-1">Posición 2</option>' +
      '<option value="pent-2">Posición 3</option>' +
      '<option value="pent-3">Posición 4</option>' +
      '<option value="pent-4">Posición 5</option>' +
      "</optgroup>";
  } else {
    html +=
      '<optgroup label="Bloques Diatónicos (5 Trastes)">' +
      '<option value="bloq-0">Bloque 1 / Posición 1</option>' +
      '<option value="bloq-1">Bloque 2 / Posición 2</option>' +
      '<option value="bloq-2">Bloque 3 / Posición 3</option>' +
      '<option value="bloq-3">Bloque 4 / Posición 4</option>' +
      '<option value="bloq-4">Bloque 5 / Posición 5</option>' +
      "</optgroup>" +
      '<optgroup label="Sistema 3NPS (3 Notas por Cuerda - Diatónico)">' +
      '<option value="3nps-0">3NPS - Posición 1 (Jónico)</option>' +
      '<option value="3nps-1">3NPS - Posición 2 (Dórico)</option>' +
      '<option value="3nps-2">3NPS - Posición 3 (Frigio)</option>' +
      '<option value="3nps-3">3NPS - Posición 4 (Lidio)</option>' +
      '<option value="3nps-4">3NPS - Posición 5 (Mixolidio)</option>' +
      '<option value="3nps-5">3NPS - Posición 6 (Eólico)</option>' +
      '<option value="3nps-6">3NPS - Posición 7 (Locrio)</option>' +
      "</optgroup>";
  }
  var valorAnterior = selectSistema.value;
  selectSistema.innerHTML = html;
  if (html.indexOf('value="' + valorAnterior + '"') !== -1) {
    selectSistema.value = valorAnterior;
  }
}

// =================== MÓDULO 3: ESCALAS Y MODOS (ORIGINAL INTACTO) ===================
function renderizarEscalas() {
  var rango = aplicarRangoTrastes("esc");
  document
    .querySelectorAll("#grid-esc .nota, #grid-esc .caja-resaltado")
    .forEach(function (n) {
      n.remove();
    });

  var elTipo = document.getElementById("selector-tipo-esc");
  var elNota = document.getElementById("selector-nota-esc");
  var elVisual = document.getElementById("selector-visualizacion-esc");
  var elSist = document.getElementById("selector-sistema-esc");

  var selectTipo = elTipo ? elTipo.value || "mayor" : "mayor";
  var selectNota = elNota ? elNota.value || "C" : "C";
  var rIdx = NOTAS.indexOf(selectNota);
  if (rIdx === -1) return;

  var datos = DATOS_ESCALAS[selectTipo] || DATOS_ESCALAS["mayor"];
  var modoVisual = elVisual ? elVisual.value || "notas" : "notas";
  var sistema = elSist ? elSist.value || "todo" : "todo";

  var uiConst = document.getElementById("ui-construccion");
  var uiArm = document.getElementById("ui-armonizacion");
  if (uiConst) uiConst.textContent = datos.construccion || "-";
  if (uiArm) uiArm.textContent = datos.armonizacion || "-";

  var trasteMinCaja = 99;
  var trasteMaxCaja = -1;

  function procesarNota(cuerda, traste, notaClassIdx, isBlueNote) {
    isBlueNote = isBlueNote || false;
    if (traste >= 0 && traste <= TOTAL_TRASTES) {
      trasteMinCaja = Math.min(trasteMinCaja, traste);
      trasteMaxCaja = Math.max(trasteMaxCaja, traste);
      if (traste >= rango.inicio && traste <= rango.fin) {
        var dist = (notaClassIdx - rIdx + 12) % 12;
        var claseColor = "nota-escala";
        var txt = "";

        if (isBlueNote) {
          claseColor = "nota-blue";
          txt = modoVisual === "notas" ? NOTAS[notaClassIdx] : "b5";
        } else {
          if (dist === 0) claseColor = "estado-fundamental";
          txt =
            modoVisual === "notas"
              ? NOTAS[notaClassIdx]
              : modoVisual === "intervalos"
                ? ETIQUETAS_INTERVALOS[dist]
                : NOTAS[notaClassIdx] + "\n" + ETIQUETAS_INTERVALOS[dist];
        }
        inyectarNota("esc", cuerda, traste, claseColor, txt);
      }
    }
  }

  var isPent =
    selectTipo.indexOf("pent") !== -1 || selectTipo.indexOf("blues") !== -1;
  var scaleNotes = [];
  if (isPent && selectTipo.indexOf("mayor") !== -1) {
    scaleNotes = DATOS_ESCALAS["pent-mayor"].intervalos.map(function (i) {
      return (rIdx + i) % 12;
    });
  } else if (isPent) {
    scaleNotes = DATOS_ESCALAS["pent-menor"].intervalos.map(function (i) {
      return (rIdx + i) % 12;
    });
  } else {
    scaleNotes = datos.intervalos.map(function (i) {
      return (rIdx + i) % 12;
    });
  }

  var blueNoteClass = -1;
  if (selectTipo.indexOf("blues") !== -1) {
    blueNoteClass =
      selectTipo === "blues-menor" ? (rIdx + 6) % 12 : (rIdx + 3) % 12;
  }

  if (sistema === "todo") {
    for (var c = 5; c >= 0; c--) {
      for (var t = rango.inicio; t <= rango.fin; t++) {
        var noteClass = (AFINACION[c] + t) % 12;
        if (scaleNotes.indexOf(noteClass) !== -1) {
          procesarNota(c, t, noteClass);
        } else if (noteClass === blueNoteClass) {
          procesarNota(c, t, noteClass, true);
        }
      }
    }
  } else if (sistema.indexOf("bloq") === 0) {
    var posIndex = parseInt(sistema.split("-")[1]);
    if (isNaN(posIndex)) posIndex = 0;

    [0, 12].forEach(function (shift) {
      var targetClass = scaleNotes[posIndex % scaleNotes.length];
      var blockRootFret = ((targetClass - AFINACION[5] + 12) % 12) + shift;

      for (var c = 5; c >= 0; c--) {
        for (var t = blockRootFret; t <= blockRootFret + 4; t++) {
          var noteClass = (AFINACION[c] + t) % 12;
          if (scaleNotes.indexOf(noteClass) !== -1) {
            procesarNota(c, t, noteClass);
          } else if (noteClass === blueNoteClass) {
            procesarNota(c, t, noteClass, true);
          }
        }
      }
    });
  } else {
    var posIndex2 = parseInt(sistema.split("-")[1]);
    if (isNaN(posIndex2)) posIndex2 = 0;
    var notesPerString = isPent ? 2 : 3;

    [0, 12].forEach(function (shift) {
      var gradoInicial = posIndex2 % scaleNotes.length;
      var targetClass = scaleNotes[gradoInicial];
      var startFret = ((targetClass - AFINACION[5] + 12) % 12) + shift;

      var gradoActual = gradoInicial;
      var lastFret = startFret;

      for (var c = 5; c >= 0; c--) {
        var stringNotes = [];
        for (var i = 0; i < notesPerString; i++) {
          var noteClass = scaleNotes[gradoActual % scaleNotes.length];
          stringNotes.push(noteClass);
          gradoActual++;
        }

        var tMinStr = 99,
          tMaxStr = -1;
        var currentSearchFret = c === 5 ? lastFret : Math.max(0, lastFret - 2);

        stringNotes.forEach(function (nc) {
          var fret = currentSearchFret;
          while (fret <= TOTAL_TRASTES) {
            if (
              (AFINACION[c] + fret) % 12 === nc &&
              fret >= currentSearchFret
            ) {
              procesarNota(c, fret, nc);
              tMinStr = Math.min(tMinStr, fret);
              tMaxStr = Math.max(tMaxStr, fret);
              currentSearchFret = fret;
              break;
            }
            fret++;
          }
        });
        lastFret = tMinStr;

        if (selectTipo.indexOf("blues") !== -1) {
          for (var t = tMinStr; t <= tMaxStr; t++) {
            if (
              t >= 0 &&
              t <= TOTAL_TRASTES &&
              (AFINACION[c] + t) % 12 === blueNoteClass
            ) {
              procesarNota(c, t, blueNoteClass, true);
            }
          }
        }
      }
    });
  }

  if (
    sistema !== "todo" &&
    trasteMaxCaja >= rango.inicio &&
    trasteMinCaja <= rango.fin
  ) {
    var cajaUI = document.createElement("div");
    cajaUI.className = "caja-resaltado";

    var colInicioReal = Math.max(trasteMinCaja, rango.inicio);
    var colFinReal = Math.min(trasteMaxCaja, rango.fin);

    var colCssInicio = colInicioReal - rango.inicio + 1;
    var colCssSpan = colFinReal - colInicioReal + 1;

    cajaUI.style.gridColumn = colCssInicio + " / span " + colCssSpan;
    cajaUI.style.gridRow = "1 / span 6";
    var gridEsc = document.getElementById("grid-esc");
    if (gridEsc) gridEsc.appendChild(cajaUI);
  }
}

// =================== MÓDULO 2: ARPEGIOS (ORIGINAL INTACTO) ===================
function renderizarArpegios() {
  aplicarRangoTrastes("arp");
  document.querySelectorAll("#grid-arp .nota").forEach(function (n) {
    n.remove();
  });

  var elNota = document.getElementById("selector-nota-arp");
  var elTipo = document.getElementById("selector-tipo-arp");
  var elModo = document.getElementById("selector-modo-arp");

  var rIdx = NOTAS.indexOf(elNota ? elNota.value || "C" : "C");
  if (rIdx === -1) return;

  var formula = DATOS_ARPEGIOS[elTipo ? elTipo.value || "maj" : "maj"];
  var modo = elModo ? elModo.value || "arpegio" : "arpegio";

  var notasAcorde = formula.map(function (i) {
    return (rIdx + i) % 12;
  });

  if (modo === "arpegio") {
    for (var c = 0; c < 6; c++) {
      for (var t = 0; t <= TOTAL_TRASTES; t++) {
        var actualIdx = (AFINACION[c] + t) % 12;
        if (notasAcorde.indexOf(actualIdx) !== -1) {
          inyectarNota(
            "arp",
            c,
            t,
            actualIdx === notasAcorde[0]
              ? "estado-fundamental"
              : "intervalo-ds",
            NOTAS[actualIdx],
          );
        }
      }
    }
  } else {
    var gc = modo === "drop2-14" ? 1 : 2;
    if (formula.length === 3) {
      var c1 = gc - 1,
        c2 = gc,
        c3 = gc + 1;
      var n1 = notasAcorde[0],
        n3 = notasAcorde[1],
        n5 = notasAcorde[2];
      [
        { obj: [n1, n3, n5] },
        { obj: [n3, n5, n1] },
        { obj: [n5, n1, n3] },
      ].forEach(function (disp) {
        buscarTrastes(c3, disp.obj[0]).forEach(function (t3) {
          buscarTrastes(c2, disp.obj[1]).forEach(function (t2) {
            buscarTrastes(c1, disp.obj[2]).forEach(function (t1) {
              var tr = [t1, t2, t3].filter(function (t) {
                return t !== 0;
              });
              if (
                tr.length > 0 &&
                Math.max.apply(null, tr) - Math.min.apply(null, tr) <= 4
              ) {
                inyectarNota(
                  "arp",
                  c3,
                  t3,
                  disp.obj[0] === n1 ? "estado-fundamental" : "intervalo-ds",
                  NOTAS[disp.obj[0]],
                );
                inyectarNota(
                  "arp",
                  c2,
                  t2,
                  disp.obj[1] === n1 ? "estado-fundamental" : "intervalo-ds",
                  NOTAS[disp.obj[1]],
                );
                inyectarNota(
                  "arp",
                  c1,
                  t1,
                  disp.obj[2] === n1 ? "estado-fundamental" : "intervalo-ds",
                  NOTAS[disp.obj[2]],
                );
              }
            });
          });
        });
      });
    } else {
      var c1x = gc - 1,
        c2x = gc,
        c3x = gc + 1,
        c4x = gc + 2;
      var n1x = notasAcorde[0],
        n3x = notasAcorde[1],
        n5x = notasAcorde[2],
        n7x = notasAcorde[3];
      [
        { obj: [n1x, n5x, n7x, n3x] },
        { obj: [n3x, n7x, n1x, n5x] },
        { obj: [n5x, n1x, n3x, n7x] },
        { obj: [n7x, n3x, n5x, n1x] },
      ].forEach(function (disp) {
        buscarTrastes(c4x, disp.obj[0]).forEach(function (t4) {
          buscarTrastes(c3x, disp.obj[1]).forEach(function (t3) {
            buscarTrastes(c2x, disp.obj[2]).forEach(function (t2) {
              buscarTrastes(c1x, disp.obj[3]).forEach(function (t1) {
                var tr = [t1, t2, t3, t4].filter(function (t) {
                  return t !== 0;
                });
                if (
                  tr.length > 0 &&
                  Math.max.apply(null, tr) - Math.min.apply(null, tr) <= 4
                ) {
                  inyectarNota(
                    "arp",
                    c4x,
                    t4,
                    disp.obj[0] === n1x ? "estado-fundamental" : "intervalo-ds",
                    NOTAS[disp.obj[0]],
                  );
                  inyectarNota(
                    "arp",
                    c3x,
                    t3,
                    disp.obj[1] === n1x ? "estado-fundamental" : "intervalo-ds",
                    NOTAS[disp.obj[1]],
                  );
                  inyectarNota(
                    "arp",
                    c2x,
                    t2,
                    disp.obj[2] === n1x ? "estado-fundamental" : "intervalo-ds",
                    NOTAS[disp.obj[2]],
                  );
                  inyectarNota(
                    "arp",
                    c1x,
                    t1,
                    disp.obj[3] === n1x ? "estado-fundamental" : "intervalo-ds",
                    NOTAS[disp.obj[3]],
                  );
                }
              });
            });
          });
        });
      });
    }
  }
}

// =================== MÓDULO 5: SISTEMA CAGED (RENDERIZADO ROBUSTO POR CELDAS) ===================
function renderizarCaged() {
  var rango = aplicarRangoTrastes("caged");

  // Limpiar notas anteriores y clases de fondo CAGED previas
  document.querySelectorAll("#grid-caged .nota").forEach(function (n) {
    n.remove();
  });
  document.querySelectorAll("#grid-caged .celda").forEach(function (celda) {
    celda.classList.remove(
      "caja-C-bg",
      "caja-A-bg",
      "caja-G-bg",
      "caja-E-bg",
      "caja-D-bg",
    );
  });

  var elNota = document.getElementById("selector-nota-caged");
  var elForma = document.getElementById("selector-forma-caged");
  var elCalidad = document.getElementById("selector-calidad-caged");
  var elCapa = document.getElementById("selector-capa-caged");
  var elVisual = document.getElementById("selector-visualizacion-caged");

  var selectNota = elNota ? elNota.value || "C" : "C";
  var rIdx = NOTAS.indexOf(selectNota);
  if (rIdx === -1) return;

  var forma = elForma ? elForma.value || "E" : "E";
  var calidad = elCalidad ? elCalidad.value || "maj" : "maj";
  var capa = elCapa ? elCapa.value || "acorde" : "acorde";
  var modoVisual = elVisual ? elVisual.value || "notas" : "notas";

  var acordeTones, pentTones, scaleTones;
  if (calidad === "maj") {
    acordeTones = [0, 4, 7];
    pentTones = [0, 2, 4, 7, 9];
    scaleTones = [0, 2, 4, 5, 7, 9, 11];
  } else if (calidad === "min") {
    acordeTones = [0, 3, 7];
    pentTones = [0, 3, 5, 7, 10];
    scaleTones = [0, 2, 3, 5, 7, 8, 10];
  } else if (calidad === "dim") {
    acordeTones = [0, 3, 6];
    pentTones = [0, 3, 6, 10];
    scaleTones = [0, 2, 3, 5, 6, 8, 10];
  } else if (calidad === "aug") {
    acordeTones = [0, 4, 8];
    pentTones = [0, 4, 8];
    scaleTones = [0, 2, 4, 6, 8, 10];
  } else if (calidad === "dom7") {
    acordeTones = [0, 4, 7, 10];
    pentTones = [0, 2, 4, 7, 9];
    scaleTones = [0, 2, 4, 5, 7, 9, 10];
  } else if (calidad === "maj7") {
    acordeTones = [0, 4, 7, 11];
    pentTones = [0, 2, 4, 7, 9];
    scaleTones = [0, 2, 4, 5, 7, 9, 11];
  } else if (calidad === "min7") {
    acordeTones = [0, 3, 7, 10];
    pentTones = [0, 3, 5, 7, 10];
    scaleTones = [0, 2, 3, 5, 7, 8, 10];
  } else if (calidad === "m-maj7") {
    acordeTones = [0, 3, 7, 11];
    pentTones = [0, 3, 7];
    scaleTones = [0, 2, 3, 5, 7, 9, 11];
  } else if (calidad === "m7b5") {
    acordeTones = [0, 3, 6, 10];
    pentTones = [0, 3, 6, 10];
    scaleTones = [0, 1, 3, 5, 6, 8, 10];
  } else if (calidad === "dim7") {
    acordeTones = [0, 3, 6, 9];
    pentTones = [0, 3, 6, 9];
    scaleTones = [0, 3, 6, 9];
  } else if (calidad === "maj7sharp5") {
    acordeTones = [0, 4, 8, 11];
    pentTones = [0, 4, 8];
    scaleTones = [0, 2, 4, 6, 8, 9, 11];
  }

  var f6 = (rIdx - AFINACION[5] + 12) % 12;
  var f5 = (rIdx - AFINACION[4] + 12) % 12;
  var f4 = (rIdx - AFINACION[3] + 12) % 12;

  // Definición exacta de las 5 cajas del CAGED abarcando exactamente 4 trastes por bloque
  var definicionesCajas = [
    { nombre: "C", baseF: (f5 - 3 + 12) % 12 },
    { nombre: "A", baseF: f5 },
    { nombre: "G", baseF: (f6 - 3 + 12) % 12 },
    { nombre: "E", baseF: f6 },
    { nombre: "D", baseF: f4 },
  ];

  var cajasActivas = [];

  definicionesCajas.forEach(function (def) {
    if (forma === def.nombre || forma === "ALL") {
      [0, 12].forEach(function (shift) {
        var inicioCaja = def.baseF + shift;
        cajasActivas.push({
          nombre: def.nombre,
          min: inicioCaja,
          max: inicioCaja + 3, // Bloque exacto de 4 trastes (ej. 0 a 3, 12 a 15)
        });
      });
    }
  });

  // 1. Limpiar fondos anteriores y pintar los fondos acumulativos de las celdas
  for (var c = 5; c >= 0; c--) {
    for (var t = rango.inicio; t <= rango.fin; t++) {
      var celdaElem = document.getElementById("caged-" + c + "-" + t);
      if (!celdaElem) continue;

      // Limpiar clases de fondo CAGED previas
      celdaElem.classList.remove("bg-C", "bg-A", "bg-G", "bg-E", "bg-D");
      celdaElem.style.backgroundImage = "none";

      // Buscar TODAS las cajas que pasan por este traste y cuerda (permite traslape)
      var cajasEnEstaCelda = cajasActivas.filter(function (box) {
        return t >= box.min && t <= box.max;
      });

      // Aplicar las clases CSS correspondientes a cada caja activa en la celda
      cajasEnEstaCelda.forEach(function (box) {
        celdaElem.classList.add("bg-" + box.nombre);
      });
    }
  }

  // 2. Renderizar las notas musicales encima de las cajas
  for (var c = 5; c >= 0; c--) {
    for (var t = rango.inicio; t <= rango.fin; t++) {
      var inBox = cajasActivas.some(function (box) {
        return t >= box.min && t <= box.max;
      });
      if (!inBox && forma !== "ALL") continue;

      var notaClassIdx = (AFINACION[c] + t) % 12;
      var dist = (notaClassIdx - rIdx + 12) % 12;

      var isAcordeTone = acordeTones.indexOf(dist) !== -1;
      var isPentTone = pentTones.indexOf(dist) !== -1;
      var isScaleTone = scaleTones.indexOf(dist) !== -1;

      var shouldDraw = false;
      var claseColor = "";

      if (capa === "acorde" && isAcordeTone) {
        shouldDraw = true;
        claseColor = dist === 0 ? "estado-fundamental" : "inversion-1";
      } else if (capa === "pent" && isPentTone) {
        shouldDraw = true;
        if (isAcordeTone)
          claseColor = dist === 0 ? "estado-fundamental" : "inversion-1";
        else claseColor = "nota-escala";
      } else if (capa === "escala" && isScaleTone) {
        shouldDraw = true;
        if (isAcordeTone)
          claseColor = dist === 0 ? "estado-fundamental" : "inversion-1";
        else claseColor = "nota-escala";
      }

      if (shouldDraw) {
        var txt = "";
        if (modoVisual === "notas") txt = NOTAS[notaClassIdx];
        else if (modoVisual === "intervalos") txt = ETIQUETAS_INTERVALOS[dist];
        else txt = NOTAS[notaClassIdx] + "\n" + ETIQUETAS_INTERVALOS[dist];

        inyectarNota("caged", c, t, claseColor, txt);
      }
    }
  }
}

// =================== INICIALIZACIÓN ÚNICA ===================
window.addEventListener("load", function () {
  construirDiapason("grid-triadas", "marc-triadas", "tr");
  construirDiapason("grid-ds", "marc-ds", "ds");
  construirDiapason("grid-esc", "marc-esc", "esc");
  construirDiapason("grid-arp", "marc-arp", "arp");
  construirDiapason("grid-caged", "marc-caged", "caged");

  actualizarSelectoresNotas();
  actualizarOpcionesSistemaEscala();

  ["triadas", "ds", "esc", "arp", "caged"].forEach(function (id) {
    var render = function () {
      if (id === "triadas") renderizarTriadas();
      if (id === "ds") renderizarDoubleStops();
      if (id === "esc") renderizarEscalas();
      if (id === "arp") renderizarArpegios();
      if (id === "caged") renderizarCaged();
    };
    vincularEvento("selector-nota-" + id, "change", render);
    vincularEvento("rango-inicio-" + id, "change", render);
    vincularEvento("rango-fin-" + id, "change", render);
  });

  vincularEvento("selector-cuerdas-triadas", "change", renderizarTriadas);
  vincularEvento("selector-intervalo-ds", "change", renderizarDoubleStops);

  vincularEvento("selector-visualizacion-esc", "change", renderizarEscalas);
  vincularEvento("selector-sistema-esc", "change", renderizarEscalas);

  vincularEvento("selector-tipo-arp", "change", renderizarArpegios);
  vincularEvento("selector-modo-arp", "change", renderizarArpegios);

  vincularEvento("selector-forma-caged", "change", renderizarCaged);
  vincularEvento("selector-calidad-caged", "change", renderizarCaged);
  vincularEvento("selector-capa-caged", "change", renderizarCaged);
  vincularEvento("selector-visualizacion-caged", "change", renderizarCaged);

  vincularEvento("selector-tipo-esc", "change", function () {
    actualizarOpcionesSistemaEscala();
    renderizarEscalas();
  });

  renderizarTriadas();
  renderizarDoubleStops();
  renderizarEscalas();
  renderizarArpegios();
  renderizarCaged();
});
