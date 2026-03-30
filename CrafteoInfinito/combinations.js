const INITIAL_ELEMENTS = [
  { name: "Agua", emoji: "💧" },
  { name: "Fuego", emoji: "🔥" },
  { name: "Tierra", emoji: "🌍" },
  { name: "Viento", emoji: "💨" }
];

const RECIPES = [
  // [ElementoA, ElementoB, Resultado, Emoji]
  // El orden de A,B no importa: el motor ordena alfabéticamente para generar la clave

  // =============================================
  //  COMBINACIONES BASE  (Tier 0 × Tier 0)
  // =============================================
  ["Agua", "Agua", "Lago", "🏞️"],
  ["Agua", "Fuego", "Vapor", "♨️"],
  ["Agua", "Tierra", "Barro", "🟫"],
  ["Agua", "Viento", "Ola", "🌊"],
  ["Fuego", "Fuego", "Sol", "☀️"],
  ["Fuego", "Tierra", "Lava", "🌋"],
  ["Fuego", "Viento", "Humo", "🌫️"],
  ["Tierra", "Tierra", "Montaña", "⛰️"],
  ["Tierra", "Viento", "Polvo", "💨"],
  ["Viento", "Viento", "Tornado", "🌪️"],

  // =============================================
  //  TIER 1  (resultado Tier-0 + base / Tier-0)
  // =============================================

  // -- Vapor --
  ["Agua", "Vapor", "Nube", "☁️"],
  ["Fuego", "Vapor", "Géiser", "⛲"],
  ["Tierra", "Vapor", "Termas", "🧖"],
  ["Vapor", "Viento", "Niebla", "🌫️"],
  ["Vapor", "Vapor", "Presión", "🔵"],

  // -- Barro --
  ["Barro", "Fuego", "Ladrillo", "🧱"],
  ["Barro", "Viento", "Adobe", "🏗️"],
  ["Barro", "Tierra", "Arcilla", "🏺"],
  ["Barro", "Barro", "Golem", "🗿"],
  ["Agua", "Barro", "Pantano", "🐊"],

  // -- Ola --
  ["Ola", "Ola", "Mar", "🌊"],
  ["Fuego", "Ola", "Sal", "🧂"],
  ["Ola", "Tierra", "Playa", "🏖️"],
  ["Ola", "Viento", "Tormenta", "⛈️"],

  // -- Sol --
  ["Agua", "Sol", "Arcoíris", "🌈"],
  ["Sol", "Tierra", "Desierto", "🏜️"],
  ["Sol", "Viento", "Calor", "🌡️"],
  ["Sol", "Sol", "Estrella", "⭐"],

  // -- Lava --
  ["Agua", "Lava", "Piedra", "🪨"],
  ["Lava", "Viento", "Ceniza", "🌑"],
  ["Lava", "Tierra", "Volcán", "🌋"],
  ["Lava", "Lava", "Magma", "🔴"],

  // -- Humo --
  ["Humo", "Tierra", "Carbón", "⬛"],
  ["Humo", "Humo", "Contaminación", "🏭"],
  ["Humo", "Viento", "Señal", "📢"],
  ["Agua", "Humo", "Hollín", "🖤"],

  // -- Lago --
  ["Lago", "Lago", "Río", "🏞️"],
  ["Lago", "Tierra", "Isla", "🏝️"],
  ["Lago", "Viento", "Oleaje", "🌊"],

  // -- Montaña --
  ["Agua", "Montaña", "Cascada", "💦"],
  ["Fuego", "Montaña", "Dragón", "🐉"],
  ["Montaña", "Viento", "Eco", "🔊"],
  ["Montaña", "Montaña", "Cordillera", "🏔️"],
  ["Montaña", "Tierra", "Cueva", "🕳️"],

  // -- Polvo --
  ["Fuego", "Polvo", "Vidrio", "🪟"],
  ["Polvo", "Polvo", "Arena", "⏳"],

  // -- Tornado --
  ["Agua", "Tornado", "Huracán", "🌀"],
  ["Fuego", "Tornado", "Infierno", "👹"],
  ["Tierra", "Tornado", "Terremoto", "💥"],
  ["Tornado", "Tornado", "Ciclón", "🌀"],

  // =============================================
  //  TIER 2
  // =============================================

  // -- Nube --
  ["Nube", "Nube", "Lluvia", "🌧️"],
  ["Fuego", "Nube", "Rayo", "⚡"],
  ["Montaña", "Nube", "Nieve", "❄️"],
  ["Nube", "Viento", "Cielo", "🌤️"],
  ["Nube", "Sol", "Atardecer", "🌅"],

  // -- Lluvia --
  ["Lluvia", "Tierra", "Planta", "🌱"],
  ["Lluvia", "Lluvia", "Inundación", "🌊"],
  ["Lluvia", "Sol", "Arcoíris", "🌈"],
  ["Lluvia", "Montaña", "Río", "🏞️"],
  ["Desierto", "Lluvia", "Oasis", "🌴"],
  ["Lluvia", "Viento", "Monzón", "🌧️"],

  // -- Rayo --
  ["Agua", "Rayo", "Electricidad", "🔌"],
  ["Rayo", "Tierra", "Cristal", "💎"],
  ["Rayo", "Rayo", "Trueno", "🔊"],
  ["Arena", "Rayo", "Vidrio", "🪟"],
  ["Metal", "Rayo", "Imán", "🧲"],

  // -- Nieve --
  ["Nieve", "Nieve", "Hielo", "🧊"],
  ["Nieve", "Viento", "Ventisca", "🌨️"],

  // -- Mar --
  ["Mar", "Mar", "Océano", "🌊"],
  ["Mar", "Tierra", "Continente", "🗺️"],
  ["Mar", "Viento", "Velero", "⛵"],
  ["Mar", "Sol", "Coral", "🐚"],
  ["Mar", "Montaña", "Fiordo", "🏞️"],

  // -- Playa --
  ["Fuego", "Playa", "Hoguera", "🔥"],
  ["Playa", "Viento", "Palmera", "🌴"],

  // -- Piedra --
  ["Fuego", "Piedra", "Metal", "⚙️"],
  ["Piedra", "Piedra", "Roca", "🪨"],
  ["Agua", "Piedra", "Arena", "⏳"],
  ["Piedra", "Viento", "Erosión", "🌬️"],

  // -- Arena --
  ["Arena", "Agua", "Cemento", "🧱"],
  ["Arena", "Viento", "Duna", "🏜️"],
  ["Arena", "Arena", "Desierto", "🏜️"],
  ["Arena", "Vidrio", "Reloj", "⏳"],

  // -- Ceniza --
  ["Agua", "Ceniza", "Lejía", "🧴"],
  ["Ceniza", "Tierra", "Abono", "🌿"],

  // -- Carbón --
  ["Carbón", "Fuego", "Diamante", "💎"],
  ["Carbón", "Tierra", "Petróleo", "🛢️"],

  // -- Ladrillo --
  ["Ladrillo", "Ladrillo", "Muro", "🧱"],

  // -- Arcilla --
  ["Arcilla", "Fuego", "Cerámica", "🏺"],

  // -- Desierto --
  ["Agua", "Desierto", "Oasis", "🌴"],
  ["Desierto", "Planta", "Cactus", "🌵"],
  ["Desierto", "Viento", "Simún", "🌪️"],

  // -- Isla --
  ["Isla", "Isla", "Archipiélago", "🗺️"],

  // =============================================
  //  TIER 3  —  Naturaleza avanzada
  // =============================================

  // -- Electricidad --
  ["Electricidad", "Electricidad", "Batería", "🔋"],
  ["Electricidad", "Metal", "Robot", "🤖"],
  ["Electricidad", "Vidrio", "Bombilla", "💡"],
  ["Electricidad", "Pantano", "Vida", "🧬"],
  ["Electricidad", "Lluvia", "Vida", "🧬"],

  // -- Cristal --
  ["Cristal", "Fuego", "Rubí", "❤️"],
  ["Cristal", "Agua", "Zafiro", "💙"],
  ["Cristal", "Tierra", "Esmeralda", "💚"],

  // -- Hielo --
  ["Hielo", "Viento", "Granizo", "🌨️"],
  ["Hielo", "Tierra", "Tundra", "🥶"],
  ["Hielo", "Hielo", "Iceberg", "🧊"],

  // -- Cascada --
  ["Cascada", "Electricidad", "Hidroeléctrica", "⚡"],

  // -- Volcán --
  ["Océano", "Volcán", "Isla", "🏝️"],

  // -- Río --
  ["Mar", "Río", "Delta", "🏞️"],
  ["Piedra", "Río", "Cañón", "🏜️"],

  // -- Glaciar --
  ["Montaña", "Nieve", "Glaciar", "🏔️"],
  ["Glaciar", "Sol", "Río", "🏞️"],
  ["Glaciar", "Océano", "Iceberg", "🧊"],

  // =============================================
  //  TIER 3  —  Materiales
  // =============================================

  // -- Metal --
  ["Fuego", "Metal", "Espada", "⚔️"],
  ["Metal", "Metal", "Acero", "🔩"],
  ["Agua", "Metal", "Óxido", "🟤"],
  ["Metal", "Tierra", "Mina", "⛏️"],
  ["Metal", "Viento", "Campana", "🔔"],
  ["Metal", "Piedra", "Yunque", "⚒️"],
  ["Metal", "Vapor", "Motor", "⚙️"],

  // -- Vidrio --
  ["Metal", "Vidrio", "Ventana", "🪟"],
  ["Vidrio", "Vidrio", "Espejo", "🪞"],

  // -- Acero --
  ["Acero", "Fuego", "Armadura", "🛡️"],
  ["Acero", "Viento", "Avión", "✈️"],

  // =============================================
  //  TIER 3-4  —  Flora
  // =============================================

  // -- Planta --
  ["Planta", "Planta", "Jardín", "🌻"],
  ["Planta", "Tierra", "Árbol", "🌳"],
  ["Planta", "Agua", "Alga", "🌿"],
  ["Planta", "Viento", "Semilla", "🌰"],
  ["Planta", "Sol", "Flor", "🌸"],
  ["Fuego", "Planta", "Tabaco", "🚬"],

  // -- Árbol --
  ["Árbol", "Árbol", "Bosque", "🌲"],
  ["Árbol", "Viento", "Hoja", "🍃"],
  ["Metal", "Árbol", "Madera", "🪵"],
  ["Agua", "Árbol", "Manglar", "🌴"],
  ["Nieve", "Árbol", "Pino", "🎄"],

  // -- Bosque --
  ["Bosque", "Fuego", "Incendio", "🔥"],
  ["Bosque", "Agua", "Selva", "🌴"],
  ["Bosque", "Bosque", "Jungla", "🌿"],
  ["Bosque", "Nieve", "Taiga", "🌲"],

  // -- Flor --
  ["Flor", "Flor", "Ramo", "💐"],
  ["Agua", "Flor", "Perfume", "🌺"],
  ["Flor", "Fuego", "Rosa", "🌹"],
  ["Flor", "Viento", "Polen", "🌼"],

  // -- Semilla --
  ["Semilla", "Tierra", "Trigo", "🌾"],
  ["Semilla", "Agua", "Brote", "🌱"],
  ["Semilla", "Sol", "Girasol", "🌻"],

  // -- Alga --
  ["Alga", "Sol", "Oxígeno", "💨"],
  ["Alga", "Fuego", "Sushi", "🍣"],

  // -- Hoja --
  ["Agua", "Hoja", "Té", "🍵"],
  ["Hoja", "Hoja", "Papel", "📄"],

  // -- Madera --
  ["Madera", "Agua", "Barco", "⛵"],
  ["Madera", "Madera", "Casa", "🏠"],
  ["Madera", "Metal", "Herramienta", "🔨"],
  ["Madera", "Viento", "Flauta", "🎵"],
  ["Madera", "Piedra", "Rueda", "☸️"],
  ["Madera", "Fuego", "Carbón", "⬛"],

  // =============================================
  //  TIER 4  —  Vida y Animales
  // =============================================

  // -- Vida --
  ["Tierra", "Vida", "Animal", "🐾"],
  ["Agua", "Vida", "Pez", "🐟"],
  ["Viento", "Vida", "Pájaro", "🐦"],
  ["Fuego", "Vida", "Fénix", "🔥"],

  // -- Animal --
  ["Agua", "Animal", "Delfín", "🐬"],
  ["Animal", "Fuego", "Dragón", "🐉"],
  ["Animal", "Tierra", "Caballo", "🐴"],
  ["Animal", "Viento", "Águila", "🦅"],
  ["Animal", "Animal", "Humano", "👤"],
  ["Animal", "Bosque", "Lobo", "🐺"],
  ["Animal", "Montaña", "Cabra", "🐐"],
  ["Animal", "Mar", "Ballena", "🐋"],
  ["Animal", "Nieve", "Oso", "🐻"],
  ["Animal", "Desierto", "Camello", "🐪"],
  ["Animal", "Selva", "Mono", "🐒"],
  ["Animal", "Planta", "Abeja", "🐝"],
  ["Animal", "Isla", "Tortuga", "🐢"],
  ["Animal", "Noche", "Búho", "🦉"],
  ["Animal", "Pantano", "Cocodrilo", "🐊"],
  ["Animal", "Tundra", "Reno", "🦌"],
  ["Animal", "Río", "Nutria", "🦦"],

  // -- Pez --
  ["Pez", "Pez", "Banco", "🐟"],
  ["Fuego", "Pez", "Sushi", "🍣"],
  ["Pez", "Piedra", "Fósil", "🦴"],
  ["Mar", "Pez", "Tiburón", "🦈"],

  // -- Pájaro --
  ["Pájaro", "Pájaro", "Bandada", "🐦"],
  ["Fuego", "Pájaro", "Fénix", "🔥"],
  ["Hielo", "Pájaro", "Pingüino", "🐧"],

  // -- Dragón --
  ["Dragón", "Agua", "Serpiente", "🐍"],
  ["Dragón", "Hielo", "Wyvern", "🐲"],
  ["Dragón", "Dragón", "Hidra", "🐉"],

  // -- Noche (Cielo + Estrella) --
  ["Cielo", "Estrella", "Noche", "🌙"],

  // =============================================
  //  TIER 5  —  Civilización
  // =============================================

  // -- Humano --
  ["Casa", "Humano", "Familia", "👨‍👩‍👧"],
  ["Espada", "Humano", "Guerrero", "⚔️"],
  ["Humano", "Metal", "Herrero", "⚒️"],
  ["Humano", "Planta", "Granjero", "👨‍🌾"],
  ["Agua", "Humano", "Pescador", "🎣"],
  ["Humano", "Humano", "Amor", "❤️"],
  ["Humano", "Sol", "Dios", "⚡"],
  ["Humano", "Mar", "Marinero", "⚓"],
  ["Caballo", "Humano", "Caballero", "🏇"],
  ["Fuego", "Humano", "Chamán", "🔮"],
  ["Humano", "Libro", "Sabio", "📚"],
  ["Humano", "Madera", "Carpintero", "🪚"],
  ["Humano", "Música", "Bardo", "🎶"],
  ["Humano", "Nieve", "Esquiador", "⛷️"],
  ["Humano", "Vida", "Sangre", "🩸"],
  ["Electricidad", "Humano", "Científico", "🔬"],
  ["Humano", "Mina", "Minero", "⛏️"],
  ["Arcoíris", "Humano", "Arte", "🎨"],
  ["Estrella", "Humano", "Filosofía", "🤔"],
  ["Humano", "Noche", "Fantasma", "👻"],

  // -- Espada --
  ["Espada", "Espada", "Batalla", "⚔️"],
  ["Espada", "Madera", "Arco", "🏹"],
  ["Espada", "Fuego", "Excalibur", "🗡️"],

  // -- Casa & Construcción --
  ["Muro", "Muro", "Casa", "🏠"],
  ["Casa", "Casa", "Pueblo", "🏘️"],
  ["Casa", "Fuego", "Chimenea", "🏠"],
  ["Pueblo", "Pueblo", "Ciudad", "🏙️"],
  ["Agua", "Pueblo", "Puerto", "⚓"],
  ["Ciudad", "Ciudad", "País", "🗺️"],
  ["Bosque", "Ciudad", "Parque", "🌳"],
  ["Ciudad", "Contaminación", "Smog", "🌫️"],
  ["Casa", "Hielo", "Iglú", "🏠"],

  // -- Papel & Conocimiento --
  ["Papel", "Papel", "Libro", "📖"],
  ["Libro", "Libro", "Biblioteca", "📚"],

  // =============================================
  //  TIER 5  —  Tecnología
  // =============================================

  ["Bombilla", "Casa", "Lámpara", "💡"],
  ["Robot", "Vida", "Androide", "🤖"],
  ["Humano", "Robot", "Cyborg", "🦾"],
  ["Metal", "Motor", "Coche", "🚗"],
  ["Agua", "Motor", "Submarino", "🚢"],
  ["Motor", "Viento", "Helicóptero", "🚁"],
  ["Acero", "Motor", "Tren", "🚂"],
  ["Barco", "Motor", "Crucero", "🚢"],
  ["Barco", "Hielo", "Titanic", "🚢"],
  ["Cielo", "Cielo", "Espacio", "🌌"],
  ["Espacio", "Motor", "Cohete", "🚀"],
  ["Campana", "Electricidad", "Teléfono", "📱"],
  ["Cristal", "Electricidad", "Ordenador", "💻"],
  ["Electricidad", "Música", "Radio", "📻"],
  ["Fuego", "Petróleo", "Gasolina", "⛽"],
  ["Gasolina", "Motor", "Coche", "🚗"],

  // =============================================
  //  TIER 5  —  Comida y Bebida
  // =============================================

  ["Piedra", "Trigo", "Harina", "👩‍🍳"],
  ["Fuego", "Harina", "Pan", "🍞"],
  ["Sol", "Árbol", "Fruta", "🍎"],
  ["Agua", "Cabra", "Leche", "🥛"],
  ["Fuego", "Leche", "Queso", "🧀"],
  ["Harina", "Queso", "Pizza", "🍕"],
  ["Pan", "Queso", "Sándwich", "🥪"],
  ["Fruta", "Tierra", "Cacao", "🫘"],
  ["Fuego", "Fruta", "Mermelada", "🫙"],
  ["Cacao", "Fuego", "Chocolate", "🍫"],
  ["Chocolate", "Leche", "Batido", "🥤"],
  ["Agua", "Trigo", "Cerveza", "🍺"],
  ["Agua", "Fruta", "Zumo", "🧃"],
  ["Sol", "Zumo", "Vino", "🍷"],
  ["Fuego", "Zumo", "Azúcar", "🍬"],
  ["Agua", "Azúcar", "Caramelo", "🍭"],
  ["Agua", "Cactus", "Tequila", "🥃"],

  // =============================================
  //  TIER 6  —  Mitología y Fantasía
  // =============================================

  ["Dios", "Humano", "Ángel", "😇"],
  ["Fuego", "Infierno", "Demonio", "😈"],
  ["Fantasma", "Sangre", "Vampiro", "🧛"],
  ["Infierno", "Vida", "Muerte", "💀"],
  ["Humano", "Muerte", "Zombi", "🧟"],
  ["Humano", "Lobo", "Licántropo", "🐺"],
  ["Arcoíris", "Caballo", "Unicornio", "🦄"],
  ["Humano", "Pez", "Sirena", "🧜"],
  ["Amor", "Dragón", "Princesa", "👸"],
  ["Castillo", "Princesa", "Cuento", "📖"],
  ["Diamante", "Metal", "Corona", "👑"],
  ["Corona", "Humano", "Rey", "🤴"],
  ["Amor", "Rey", "Reina", "👸"],
  ["Reina", "Rey", "Príncipe", "🤴"],
  ["Casa", "Rey", "Castillo", "🏰"],
  ["Castillo", "Fantasma", "Mansión", "🏚️"],

  // =============================================
  //  TIER 6  —  Espacio
  // =============================================

  ["Estrella", "Estrella", "Galaxia", "🌌"],
  ["Estrella", "Noche", "Constelación", "✨"],
  ["Estrella", "Piedra", "Meteorito", "☄️"],
  ["Noche", "Sol", "Luna", "🌙"],
  ["Luna", "Mar", "Marea", "🌊"],
  ["Luna", "Lobo", "Licántropo", "🐺"],
  ["Cohete", "Humano", "Astronauta", "👨‍🚀"],
  ["Espacio", "Piedra", "Asteroide", "☄️"],
  ["Espacio", "Tierra", "Planeta", "🪐"],
  ["Espacio", "Estrella", "Supernova", "💥"],
  ["Planeta", "Vida", "Alien", "👽"],
  ["Planeta", "Planeta", "Órbita", "🪐"],
  ["Estrella", "Muerte", "Agujero Negro", "🕳️"],

  // =============================================
  //  TIER 6  —  Conceptos Abstractos
  // =============================================

  ["Amor", "Fuego", "Pasión", "💕"],
  ["Amor", "Flor", "Romance", "💝"],
  ["Reloj", "Reloj", "Tiempo", "⏰"],
  ["Amor", "Tiempo", "Eternidad", "♾️"],
  ["Flauta", "Viento", "Música", "🎵"],
  ["Campana", "Eco", "Música", "🎵"],
  ["Batalla", "Batalla", "Guerra", "⚔️"],
  ["Amor", "Guerra", "Paz", "☮️"],
  ["Continente", "Océano", "Mundo", "🌍"],
  ["Mundo", "Paz", "Utopía", "🌅"],

  // =============================================
  //  TIER 7  —  Ciencia y Profesiones
  // =============================================

  ["Científico", "Estrella", "Telescopio", "🔭"],
  ["Científico", "Vida", "Medicina", "💊"],
  ["Científico", "Metal", "Laboratorio", "🔬"],
  ["Diamante", "Mina", "Tesoro", "💰"],
  ["Barco", "Tesoro", "Pirata", "🏴‍☠️"],
  ["Espada", "Pirata", "Aventura", "🗺️"],
  ["Mar", "Pirata", "Kraken", "🦑"],
  ["Humano", "Reno", "Navidad", "🎄"],
  ["Abono", "Planta", "Girasol", "🌻"],
  ["Abeja", "Flor", "Miel", "🍯"],
  ["Caballo", "Metal", "Herradura", "🐴"],
  ["Incendio", "Viento", "Desastre", "🌪️"],
  ["Metal", "Armadura", "Caballero", "🏇"],
  ["Cristal", "Viento", "Ámbar", "🟡"],

  // =============================================
  //  CAMINOS ALTERNATIVOS  (rutas extra)
  // =============================================

  ["Roca", "Roca", "Montaña", "⛰️"],
  ["Fuego", "Árbol", "Carbón", "⬛"],
  ["Hoja", "Fuego", "Ceniza", "🌑"],
  ["Incendio", "Agua", "Vapor", "♨️"],
  ["Nieve", "Sol", "Agua", "💧"],
  ["Hielo", "Fuego", "Agua", "💧"],
  ["Mar", "Fuego", "Sal", "🧂"],
  ["Armadura", "Humano", "Caballero", "🏇"],
];
