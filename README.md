# Track · Entrenos de correr y pesas

App web sencilla (HTML + CSS + JavaScript, sin dependencias) para registrar tus entrenos
y calcular a qué hora dormirte para rendir en tus entrenos de la mañana.

## Cómo usarla

Abre `index.html` en el navegador. No necesita servidor ni instalación.
Los datos se guardan en el `localStorage` del navegador; usa **Exportar JSON** para hacer respaldos
e **Importar JSON** para restaurarlos o pasarlos a otro dispositivo.

Para usarla en el móvil puedes publicarla con GitHub Pages (Settings → Pages → rama de este repo)
y añadirla a la pantalla de inicio.

## Funciones

- **Correr**: fecha, tipo (fácil, tempo, intervalos, largo…), distancia, duración, esfuerzo (RPE) y notas.
  Calcula ritmo (min/km) y velocidad.
- **Pesas**: sesiones con varios ejercicios (series × reps × kg) y volumen total.
- **Resumen**: km, carreras, sesiones y volumen de la semana; gráfica de km de las últimas 8 semanas;
  récords (carrera más larga, mejor ritmo en ≥5/10/21 km y 1RM estimado por ejercicio con la fórmula de Epley);
  actividad reciente.
- **Sueño**: indica la hora del entreno, el tipo, cuánto tardas en prepararte y en dormirte.
  La app calcula la hora de despertar (`entreno − preparación`) y la hora de acostarte
  (`despertar − horas objetivo − tiempo en dormirte`). El objetivo automático depende del entreno
  (7 h 30 min suave/descanso, 8 h intenso/pesas, 8 h 30 min tirada larga) y también muestra opciones
  de 4, 5 y 6 ciclos de 90 minutos, la hora de apagar pantallas y cuánto falta para acostarte.
