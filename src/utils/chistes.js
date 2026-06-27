function aleatorio(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function chisteSaldoPositivo(saldo) {
  if (saldo > 200) {
    return aleatorio([
      '🥤 *Salió para la gaseosa!*',
      '🍗 *Ya puedes invitarte un pollito a la brasa!*',
      '🎉 *Hay platita para los gustitos!*',
      '🚀 *Se viene el finde con plata!*',
      '🤙 *Tamos ready para los antojos!*',
      '💪 *Ahorro es progreso, causa!*',
      '⭐ *La cuenta bancaria respira hondo...*',
      '🌟 *Tiempo de darse un gusto!*',
      '🔥 *Llegó la gasolina!*',
      '💰 *Al menos ya compras el chicle 😎*',
    ]);
  }
  if (saldo > 50) {
    return aleatorio([
      '🥤 *Salió para la gaseosa!*',
      '💰 *Al menos ya compras el chicle 😎*',
      '💪 *Ahorro es progreso, causa!*',
      '🤏 *Poquito pero avanzando!*',
    ]);
  }
  return aleatorio([
    '💪 *Ahorro es progreso, causa!*',
    '🤏 *Algo es algo!*',
    '👀 *Para empezar está bien!*',
    '🪙 *Así se empieza!*',
  ]);
}

export function chisteSaldoNegativo(saldo) {
  if (saldo <= -500) {
    return aleatorio([
      '🚶‍♂️ *Toca ir a pie este mes...*',
      '😅 *Creo que hoy no se come...*',
      '🏕️ *Modo supervivencia activado*',
      '🍚 *A comer arroz con huevo todo el mes*',
      '😂 *Por qué la vida es tan cara?*',
      '🏪 *Toca pedir fiado no más...*',
      '😭 *La deliciosa vida del ahorro (?)',
    ]);
  }
  return aleatorio([
    '🚶‍♂️ *Toca ir a pie...*',
    '😅 *Creo que hoy no se come...*',
    '🏕️ *Modo supervivencia activado*',
    '💪 *A darle like a la comida de los demás nomas*',
    '🤞 *La esperanza es lo último que se pierde*',
    '😂 *Ni modo, a seguir chambeando*',
    '😬 *Tranqui, peor sería tener más deudas (?)*',
    '🙃 *Welcome to adulthood*',
  ]);
}

export function chisteGasto(monto) {
  if (monto > 500) {
    return aleatorio([
      '💸 *Se fue la platita...*',
      '🥊 *Otro golpe al bolsillo*',
      '😔 *Duele pero era necesario (?)*',
      '🪦 *RIP tu dinero*',
      '🤡 *Bienvenido a la adultez*',
    ]);
  }
  return aleatorio([
    '💸 *Se fue como arena entre los dedos*',
    '🤷 *Ni modo, así nomás la vida*',
    '💼 *A seguir chambeando no más*',
    '🤏 *Tranqui, es poquito*',
    '😌 *Se fue, pero duele igual*',
  ]);
}

export function chisteIngreso(monto) {
  if (monto > 1000) {
    return aleatorio([
      '🚀 *Llegó la gasolina!*',
      '🎉 *Se viene el finde con plata!*',
      '🔥 *Tiempo de darse un gusto!*',
      '🤑 *Llegó lo bueno!*',
      '🌟 *Respiró el bolsillo!*',
    ]);
  }
  return aleatorio([
    '💰 *Llegó algo al bolsillo!*',
    '🥖 *A celebrar con un pancito!*',
    '👀 *Aquí vamos de nuevo...*',
    '🤙 *Poquito a poco se avanza!*',
    '😎 *Algo es algo!*',
  ]);
}

export function chisteVencimiento() {
  return aleatorio([
    '📆 *Ya ve venir el cobro...*',
    '😬 *No se te pase la fecha!*',
    '⏰ *Pon una alarma mejor*',
    '💰 *Prepárate para soltar la plata*',
    '😅 *Otro golpe al bolsillo incoming*',
  ]);
}
