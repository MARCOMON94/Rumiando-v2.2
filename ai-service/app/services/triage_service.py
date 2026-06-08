import re
import unicodedata
from dataclasses import dataclass, field


PRIORITY_ORDER = {
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "URGENT": 4
}

SPECIES_TERMS = {
    "ovino": ["oveja", "ovejas", "cordero", "cordera", "corderos", "borrego", "borrega", "carnero"],
    "caprino": ["cabra", "cabras", "cabrito", "cabrita", "macho cabrio", "chivo", "chiva"],
    "perro": ["perro", "perra", "perros", "perras", "mastin", "podenco", "cachorro"],
    "gato": ["gato", "gata", "gatos", "gatas", "gatito", "gatita"],
    "equino": ["caballo", "yegua", "potro", "potra", "burro", "burra", "asno", "mula", "mulo", "equino"],
    "aves": [
        "gallina", "gallinas", "gallo", "pollito", "pollitos", "pollo", "pollos",
        "pato", "patos", "ocas", "oca", "ganso", "gansos",
        "pavo real", "pavos reales", "pavoreal", "pavo", "pavos", "perdiz", "codorniz"
    ],
    "cerdo": ["cerdo", "cerda", "cochino", "cochina", "marrano", "lechon"],
    "conejo": ["conejo", "coneja", "conejos"],
    "bovino": ["vaca", "ternero", "ternera", "becerro", "bovino"]
}

HEALTH_CONTEXT_TERMS = [
    "no come", "no bebe", "tumbado", "tumbada", "decaido", "decaida", "debil",
    "fiebre", "tos", "mocos", "diarrea", "vomita", "vomitos", "cojo", "coja",
    "herida", "sangre", "hinchado", "hinchada", "parto", "aborto", "ubre",
    "respira", "dolor", "llora", "queja", "picor", "parasitos", "bulto",
    "pus", "purgando", "secrecion", "ojo", "oreja", "boca", "lengua",
    "pisado", "atropellado", "atropelle", "no mueve la pata", "se comio", "pario", "parida", "recien parida", "cria", "crias", "calostro",
"no ha mamado", "no mama", "madre desconocida", "no se cual es la madre",
"abandono de cria", "cria tirada", "dejo a la cria", "rechaza la cria"
]


@dataclass
class TriageRule:
    code: str
    title: str
    priority: str
    terms: list[str]
    reasons: list[str]
    immediate_actions: list[str]
    do_not: list[str]
    vet_when: str
    app_record: str
    rag_query: str
    species_hint: list[str] = field(default_factory=list)


@dataclass
class TriageResult:
    is_relevant: bool
    code: str = "general"
    priority: str = "LOW"
    title: str = "Consulta general"
    matched_terms: list[str] = field(default_factory=list)
    detected_species: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    immediate_actions: list[str] = field(default_factory=list)
    do_not: list[str] = field(default_factory=list)
    vet_when: str = ""
    app_record: str = ""
    suggested_rag_query: str = ""

    def as_prompt_block(self):
        if not self.is_relevant:
            return "No se ha detectado triaje sanitario especifico."

        return (
            f"Prioridad local: {self.priority}\n"
            f"Codigo: {self.code}\n"
            f"Titulo: {self.title}\n"
            f"Especies detectadas: {', '.join(self.detected_species) or 'no claras'}\n"
            f"Terminos activados: {', '.join(self.matched_terms)}\n"
            f"Motivos: {'; '.join(self.reasons)}\n"
            f"Acciones inmediatas: {'; '.join(self.immediate_actions)}\n"
            f"No hacer: {'; '.join(self.do_not)}\n"
            f"Veterinario: {self.vet_when}\n"
            f"Registro app: {self.app_record}"
        )


def _normalize(text):
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower()


def _detected_species(normalized):
    found = []
    for species, terms in SPECIES_TERMS.items():
        if any(term in normalized for term in terms):
            found.append(species)
    return found


def _matched_terms(normalized, terms):
    return [term for term in terms if term in normalized]


RULES = [
    TriageRule(
        code="convulsions_neuro",
        title="Convulsiones o signos neurologicos",
        priority="URGENT",
        terms=[
            "convulsion", "convulsiona", "ataque", "temblores fuertes", "tiembla mucho",
            "cuello torcido", "da vueltas", "no coordina", "paralisis", "se cae",
            "cabeza ladeada", "espasmos", "pedalea", "rigido", "rigida",
            "moviendo las patas", "patas como una loca", "patas como loco"
        ],
        reasons=[
            "puede haber riesgo vital, intoxicacion, golpe, problema metabolico, infeccion o enfermedad nerviosa",
            "un animal convulsionando puede lesionarse o aspirar saliva/comida"
        ],
        immediate_actions=[
            "apartar al animal de golpes, agua, comederos y otros animales",
            "mantenerlo en un lugar tranquilo, con poca estimulacion y sin meter la mano en la boca",
            "anotar duracion, repeticiones, temperatura si puedes y cualquier toxico o pienso reciente",
            "llamar al veterinario de urgencia"
        ],
        do_not=[
            "no meter dedos, palos ni objetos en la boca",
            "no dar agua, comida ni medicacion mientras convulsiona",
            "no forzar a levantarse"
        ],
        vet_when="Urgente desde el primer episodio, mas aun si se repite, dura varios minutos o hay varios animales afectados.",
        app_record="Crear caso sanitario urgente con especie, animal/RFID si existe, hora, duracion y posible exposicion a toxicos.",
        rag_query="convulsiones signos neurologicos intoxicacion urgencia veterinaria animales granja"
    ),
    TriageRule(
        code="hemorrhage_trauma",
        title="Hemorragia, herida profunda o traumatismo",
        priority="URGENT",
        terms=[
            "desangra", "desangrando", "sangra mucho", "sangrando mucho", "hemorragia",
            "sangre a chorros", "herida profunda", "tripas fuera", "hueso fuera",
            "atropellado", "atropellada", "cornada", "mordedura profunda", "fractura",
            "pata rota", "golpe fuerte", "aplastado", "aplastada", "pisado",
            "pisada", "pisoton", "me piso", "me ha pisado", "atropelle",
            "atropello", "no mueve la pata", "no apoya la pata", "no puede apoyar",
            "cojera tras golpe", "cayo del techo", "cayo de alto", "caida fuerte",
            "se cayo del techo", "cuello roto", "solo mueve los ojos",
            "no mueve el cuerpo", "no mueve nada", "golpe", "golpe del coche", "coche", "atropello con coche",
"le di con el coche", "le he dado con el coche", "accidente con coche"
        ],
        reasons=[
            "la perdida de sangre y el shock pueden avanzar rapido",
            "las heridas profundas, fracturas y mordeduras contaminadas requieren valoracion profesional"
        ],
        immediate_actions=[
            "separar en un sitio seguro y reducir movimiento",
            "presionar una herida externa con pano limpio o gasa si el sangrado es visible",
            "mantener al animal templado y vigilar respiracion y mucosas",
            "llamar al veterinario de urgencia"
        ],
        do_not=[
            "no retirar objetos clavados",
            "no meter productos irritantes dentro de la herida",
            "no tapar una herida sucia sin que la valore un profesional si es profunda"
        ],
        vet_when="Urgente si el sangrado es abundante, hay herida profunda, fractura, mordedura, debilidad, palidez o colapso.",
        app_record="Crear caso sanitario urgente y, si fue ataque o accidente, registrar causa probable y animales implicados.",
        rag_query="hemorragia heridas traumatismos mordeduras shock primeros auxilios animales granja"
    ),
    TriageRule(
        code="respiratory_distress",
        title="Dificultad respiratoria",
        priority="URGENT",
        terms=[
            "respira mal", "no puede respirar", "asfixia", "se ahoga", "ahogando",
            "jadea", "boca abierta", "pico abierto", "respira con pico abierto",
            "mucosas azules", "lengua azulada", "ruido al respirar", "cuello estirado",
            "respira muy rapido", "le falta aire"
        ],
        reasons=[
            "la dificultad respiratoria es un signo de riesgo vital",
            "en aves, respirar con pico abierto o cuello estirado es especialmente preocupante"
        ],
        immediate_actions=[
            "separar sin perseguir ni estresar",
            "dejar aire limpio, sombra o temperatura estable segun el caso",
            "evitar polvo, humo, amoniaco y cama humeda",
            "llamar al veterinario cuanto antes"
        ],
        do_not=[
            "no tumbar ni manipular de mas a un animal con falta de aire",
            "no forzar agua o comida",
            "no mover aves o lotes si hay sospecha de brote respiratorio"
        ],
        vet_when="Urgente si abre la boca para respirar, hay mucosas azuladas, postracion, fiebre o varios animales afectados.",
        app_record="Registrar caso sanitario y revisar lote/corral por ventilacion, polvo, humedad y otros afectados.",
        rag_query="dificultad respiratoria pico abierto tos mocos aves ovino caprino urgencia"
    ),
    TriageRule(
        code="down_animal",
        title="Animal tumbado, no se levanta o colapso",
        priority="URGENT",
        terms=[
            "no se levanta", "no puede levantarse", "tumbado y no se levanta",
            "tumbada y no se levanta", "postrado", "postrada", "colapsado",
            "colapsada", "inconsciente", "muy debil", "no se mantiene en pie",
            "se cae al andar", "no se mueve", "no mueve", "inmovil"
        ],
        reasons=[
            "puede ser shock, dolor grave, problema metabolico, parto, timpanismo, intoxicacion o infeccion",
            "el pronostico empeora si permanece tumbado mucho tiempo"
        ],
        immediate_actions=[
            "aislar y poner cama seca para evitar golpes y frio",
            "comprobar respiracion, mucosas, abdomen, heridas, parto, temperatura y respuesta",
            "ofrecer agua cerca si esta consciente, sin forzar",
            "llamar al veterinario con prioridad alta"
        ],
        do_not=[
            "no arrastrar del cuello ni forzar a caminar",
            "no dejar al sol, en barro o con otros animales encima",
            "no medicar a ciegas"
        ],
        vet_when="Urgente si no puede ponerse de pie, esta fria/caliente, respira mal, tiene abdomen hinchado o hay parto/aborto.",
        app_record="Crear caso sanitario urgente con ubicacion, postura, temperatura si se toma y evolucion.",
        rag_query="animal no se levanta postrado decaimiento shock urgencia ovino caprino equino perro gato ave"
    ),
    TriageRule(
        code="bloat_colic_abdomen",
        title="Abdomen hinchado, timpanismo o colico",
        priority="URGENT",
        terms=[
            "barriga hinchada", "abdomen hinchado", "panza hinchada", "timpanismo",
            "hinchado del lado izquierdo", "vientre hinchado", "se revuelca",
            "colico", "colica", "suda y se revuelca", "no defeca", "no caga",
            "patea la barriga", "mira el flanco", "sale gas", "saliendo gas",
            "salio gas", "pincho la panza", "pinchar la panza", "puncion",
            "trocar", "pinchado y sale gas", "pincho", "pinchado", "le pincho"
        ],
        reasons=[
            "en rumiantes el timpanismo puede impedir respirar",
            "en equinos el colico puede ser grave y empeorar rapido"
        ],
        immediate_actions=[
            "retirar acceso a pienso o alimento sospechoso",
            "mantener al animal observado y sin esfuerzo",
            "en caballo/yegua, evitar que se golpee al revolcarse y llamar al veterinario",
            "en ovino/caprino con dificultad respiratoria o abdomen muy tenso, llamar urgente"
        ],
        do_not=[
            "no pinchar ni sondar sin veterinario",
            "no dar aceites, remedios o medicacion sin indicacion",
            "no obligar a caminar si esta muy debil o respira mal"
        ],
        vet_when="Urgente si hay abdomen muy hinchado, dificultad respiratoria, dolor intenso, colico equino o empeoramiento rapido.",
        app_record="Registrar caso sanitario y posible cambio de alimento, acceso a grano, pasto nuevo o lote afectado.",
        rag_query="timpanismo abdomen hinchado colico equino ovino caprino urgencia digestivo"
    ),
    TriageRule(
        code="birth_abortion_postpartum",
        title="Parto, aborto o posparto complicado",
        priority="URGENT",
        terms=[
            "parto complicado", "no pare", "lleva pariendo", "cria atascada",
            "cordero atascado", "cabrito atascado", "sale una pata", "sale la cabeza",
            "prolapso", "matriz fuera", "vagina fuera", "aborto", "abortado",
            "placenta", "retencion de placenta", "mal parto", "no expulsa",
            "solo saco una pata", "solo sale una pata", "he sacado solo la pata",
            "he sacado la pata", "sacado la pata", "pata en la mano",
            "me quede con la pata", "me he quedado con la pata", "arranque la pata",
            "se arranco la pata", "jale la pata", "jalando la pata", "tirando de la pata"
        ],
        reasons=[
            "los partos bloqueados, prolapsos y abortos pueden comprometer a madre y cria",
            "los abortos pueden ser infecciosos o requerir aviso segun contexto"
        ],
        immediate_actions=[
            "aislar a la madre en zona limpia y tranquila",
            "observar tiempo de evolucion, postura de la cria, sangrado, olor y estado general",
            "guardar feto/placenta sin manipular mas de lo necesario si hay aborto",
            "llamar al veterinario de urgencia si sale solo una pata, hay aborto incompleto o se ha tirado de la cria"
        ],
        do_not=[
            "no tirar fuerte de la cria",
            "no reintroducir un prolapso sin higiene y criterio veterinario",
            "no dejar fetos o placentas accesibles a perros, gatos o aves"
        ],
        vet_when="Urgente si hay cria atascada, sale solo una pata, se ha tirado de la cria, prolapso, hemorragia, fiebre, mal olor o madre tumbada.",
        app_record="Registrar reproduccion/caso sanitario, madre, lote, fecha, aborto/parto y resultado.",
        rag_query="parto complicado aborto prolapso retencion placenta ovino caprino urgencia"
    ),
    TriageRule(
        code="poisoning_toxic",
        title="Sospecha de intoxicacion",
        priority="URGENT",
        terms=[
            "veneno", "toxica", "toxico", "intoxicado", "intoxicada", "comio veneno",
            "raticida", "plaguicida", "herbicida", "anticongelante", "lejia",
            "producto de limpieza", "pesticida", "pienso medicado", "plantas toxicas",
            "bellotas", "urea", "sobredosis", "espuma por la boca", "echa espuma",
            "echando espuma", "babea espuma", "espumarajos"
        ],
        reasons=[
            "las intoxicaciones pueden afectar a varios animales y avanzar rapido",
            "la etiqueta del producto cambia completamente la actuacion veterinaria"
        ],
        immediate_actions=[
            "retirar el acceso al producto o alimento sospechoso",
            "guardar etiqueta, envase, lote de pienso o planta para el veterinario",
            "separar afectados y revisar si hay mas animales con signos",
            "llamar al veterinario o centro especializado segun especie"
        ],
        do_not=[
            "no provocar vomito salvo indicacion veterinaria",
            "no dar leche, aceite ni remedios caseros",
            "no dejar el producto al alcance de perros, gatos, aves o ganado"
        ],
        vet_when="Urgente ante sospecha real, aunque todavia no haya sintomas claros.",
        app_record="Registrar exposicion, producto, hora aproximada, especie, animales afectados y fotos si existen.",
        rag_query="intoxicacion veneno raticida plantas toxicas animales granja perro gato ovino caprino aves"
    ),
    TriageRule(
        code="bites_attacks",
        title="Ataque, mordedura o persecucion entre animales",
        priority="HIGH",
        terms=[
            "mordiendo", "mordido", "mordida", "ataque", "atacando", "lo esta atacando",
            "perro esta mordiendo", "perro mordiendo", "perros atacan", "gato mordido",
            "zorro", "huron", "rata mordio", "picotazos", "picoteando", "perseguido",
            "perro persigue", "perro suelto", "se comio un pato", "se ha comido un pato",
            "comio un pato", "se comio una gallina", "comio una gallina", "se comio un pollo",
            "comio un pollo", "se comio un animal", "se ha comido un animal",
            "se comio una oveja", "se ha comido una oveja", "se ha comida una oveja",
            "comida una oveja", "oveja entera"
        ],
        reasons=[
            "el dano por mordedura puede ser mayor de lo que se ve por fuera",
            "la persecucion estresa al ganado y puede causar golpes, abortos o aplastamiento de crias"
        ],
        immediate_actions=[
            "separar al agresor sin ponerse en riesgo",
            "llevar al herido a una zona tranquila y limpia",
            "revisar respiracion, sangrado, heridas ocultas, cojera y shock",
            "llamar al veterinario si hay herida, dolor, sangrado, gato mordido, ave atacada o animal pequeno"
        ],
        do_not=[
            "no meter la mano entre animales peleando",
            "no minimizar una mordedura en gatos, aves o crias",
            "no dejar al perro agresor con acceso libre al ganado"
        ],
        vet_when="Alta prioridad; urgente si hay sangrado, dificultad respiratoria, herida profunda, gato mordido, cria afectada o shock.",
        app_record="Registrar incidente, animales implicados, ubicacion, heridas visibles y medidas de separacion.",
        rag_query="mordeduras ataques perros gatos aves ganado heridas separacion bioseguridad"
    ),
    TriageRule(
    code="neonate_colostrum",
    title="Cria recien nacida sin madre confirmada o sin calostro",
    priority="HIGH",
    terms=[
        "no se cual es la madre", "madre desconocida", "cria tirada",
        "dejo a la cria", "rechaza la cria", "no ha mamado",
        "no mama", "calostro", "cria abandonada", "cordero recien nacido",
        "cabrito recien nacido", "pario dejo a la cria"
    ],
    reasons=[
        "una cria recien nacida necesita calostro pronto para recibir energia e inmunidad",
        "si esta fria, debil o no mama, puede empeorar rapido"
    ],
    immediate_actions=[
        "separar la cria en cama limpia, seca y templada",
        "comprobar si esta fria, debil, mojada o si puede mantenerse de pie",
        "intentar identificar a la madre observando ubres llenas, restos de parto, lamido o llamada",
        "avisar al veterinario o responsable si no sabes si tomo calostro"
    ],
    do_not=[
        "no dejarla tirada en frio o entre el lote",
        "no forzar alimentacion si esta muy debil, fria o no traga bien",
        "no asumir que ya tomo calostro si no lo viste"
    ],
    vet_when=(
        "Alta prioridad si no sabes si tomo calostro, esta fria, debil, no se levanta, "
        "no mama o no localizas a la madre."
    ),
    app_record=(
        "Registrar nacimiento/incidencia neonatal con hora aproximada, cria, posible madre, "
        "si tomo calostro y estado inicial."
    ),
    rag_query="cria recien nacida calostro madre desconocida abandono neonatal ovino caprino"
),
    TriageRule(
        code="hoof_bleeding",
        title="Cojera, pezuna o una cortada con sangrado",
        priority="MEDIUM",
        terms=[
            "una enterrada", "pezuna", "mal de pezuna", "pedero", "recorte de una",
            "cortado la una", "corte la una", "sale sangre", "sangra la una",
            "sangra la pata", "sangre al cortar"
        ],
        reasons=[
            "puede ser una herida por recorte, infeccion podal o lesion dolorosa",
            "la humedad y la suciedad empeoran los problemas de pezuna"
        ],
        immediate_actions=[
            "mantener la oveja en sitio limpio y seco",
            "aplicar presion con gasa o pano limpio si sangra",
            "vigilar si deja de apoyar, hay pus, mal olor, hinchazon o sangrado abundante"
        ],
        do_not=[
            "no seguir cortando si ya sangra",
            "no meter productos irritantes en una herida profunda"
        ],
        vet_when="Veterinario si no deja de sangrar en pocos minutos, sangra mucho, no apoya, hay pus, mal olor, hinchazon o fiebre.",
        app_record="Registrar cojera/herida podal, pata afectada, sangrado y si se aisla en cama seca.",
        rag_query="cojera pezuna una enterrada sangrado recorte oveja cabra"
    ),
    TriageRule(
        code="fever_depression",
        title="Fiebre, decaimiento o no come",
        priority="MEDIUM",
        terms=[
            "fiebre", "caliente", "no come", "no quiere comer", "no bebe",
            "decaido", "decaida", "apagado", "apagada", "triste", "embolada",
            "plumas erizadas", "se aparta", "perdio peso", "muy flaco", "muy flaca"
        ],
        reasons=[
            "son signos inespecificos que pueden ser leves o el inicio de un problema serio",
            "la prioridad sube si se combinan con respiracion mala, diarrea, parto, dolor, sangre o postracion"
        ],
        immediate_actions=[
            "aislar para observar y reducir contagios",
            "tomar temperatura si se puede hacer con seguridad",
            "revisar respiracion, heces, mucosas, heridas, ubre, cojera, parto y agua",
            "mirar si hay mas animales del lote igual"
        ],
        do_not=[
            "no dar antibioticos, antiinflamatorios ni medicacion humana sin veterinario",
            "no esperar varios dias si empeora o hay varios afectados"
        ],
        vet_when="Contactar con veterinario si hay fiebre alta, decaimiento marcado, no come mas de un dia, cria afectada o varios animales.",
        app_record="Crear caso sanitario con temperatura, apetito, heces, lote/corral y evolucion.",
        rag_query="fiebre decaimiento no come primeros signos ovino caprino perro gato aves equino"
    ),
    TriageRule(
        code="diarrhea_dehydration",
        title="Diarrea, deshidratacion o sangre en heces",
        priority="HIGH",
        terms=[
            "diarrea", "cagaleras", "cagalera", "heces liquidas", "sangre en heces",
            "diarrea con sangre", "deshidratado", "deshidratada", "ojos hundidos",
            "culo sucio", "pollito con diarrea", "cordero con diarrea", "cabrito con diarrea"
        ],
        reasons=[
            "las crias se deshidratan rapido",
            "la sangre, mal olor intenso o varios afectados sugieren problema importante de lote"
        ],
        immediate_actions=[
            "separar afectados y mantener cama seca",
            "asegurar agua limpia y revisar acceso real al bebedero",
            "revisar edad, alimentacion, cambios de pienso, parasitos, temperatura y otros casos",
            "llamar al veterinario si hay crias, sangre, debilidad o brote"
        ],
        do_not=[
            "no cortar agua",
            "no medicar el lote sin diagnostico",
            "no mezclar crias enfermas con sanas"
        ],
        vet_when="Alta prioridad en crias, diarrea con sangre, deshidratacion, fiebre, debilidad o varios animales.",
        app_record="Registrar caso sanitario por lote/corral, edad, numero de afectados y cambios de manejo.",
        rag_query="diarrea deshidratacion sangre heces crias ovino caprino aves perro gato"
    ),
    TriageRule(
        code="notifiable_disease",
        title="Sospecha de enfermedad regulada o brote",
        priority="HIGH",
        terms=[
            "lengua azul", "mal de boca", "fiebre aftosa", "brucelosis",
            "tuberculosis", "scrapie", "tembladera", "influenza aviar",
            "gripe aviar", "newcastle", "viruela ovina", "viruela caprina",
            "peste porcina", "rabia", "muchos muertos", "muerte subita",
            "varios abortos", "brote", "muchos enfermos"
        ],
        reasons=[
            "puede requerir veterinario, aislamiento, comunicacion oficial o restricciones de movimiento",
            "los nombres populares no siempre equivalen a un diagnostico concreto"
        ],
        immediate_actions=[
            "aislar animales sospechosos y no mover lote ni productos si hay brote",
            "revisar numero de afectados, muertes, abortos, fiebre, boca, respiracion y cojera",
            "contactar con veterinario para confirmar pasos y normativa aplicable",
            "evitar visitas, prestamos de material y mezclas de animales"
        ],
        do_not=[
            "no vender, mover o mezclar animales sospechosos",
            "no confirmar diagnostico solo por un nombre local",
            "no ocultar mortalidad o abortos repetidos"
        ],
        vet_when="Alta prioridad, urgente si hay mortalidad, abortos repetidos, signos neurologicos, respiratorios o varios animales.",
        app_record="Registrar sospecha, lote, animales afectados, muertos/abortos, fechas y medidas de aislamiento.",
        rag_query="enfermedad declaracion obligatoria lengua azul influenza aviar brote abortos mortalidad"
    ),
    TriageRule(
        code="death_event",
        title="Muerte de un animal o muerte subita",
        priority="HIGH",
        terms=[
            "se ha muerto", "se murio", "ha muerto", "esta muerto", "esta muerta",
            "aparecio muerto", "aparecio muerta", "muerte subita", "muerto de repente",
            "muerta de repente"
        ],
        reasons=[
            "puede haber riesgo para otros animales si fue intoxicacion, contagio o problema de manejo",
            "los cadaveres y restos no deben quedar accesibles a perros, gatos, aves o ganado"
        ],
        immediate_actions=[
            "retirar el acceso de otros animales al cadaver sin manipular mas de lo necesario",
            "revisar ahora mismo si hay mas animales con signos parecidos",
            "avisar al veterinario si fue muerte subita, habia espuma, convulsiones, aborto, sangre o varios afectados"
        ],
        do_not=[
            "no dejar que perros, gatos o aves coman restos",
            "no mover o desechar sin seguir indicacion veterinaria/normativa si hay sospecha de brote"
        ],
        vet_when="Contactar con veterinario si la muerte fue repentina, no sabes la causa, habia signos graves o hay mas animales raros.",
        app_record="Registrar baja/muerte pendiente de causa, fecha, corral, signos previos y animales expuestos.",
        rag_query="muerte subita cadaver bioseguridad intoxicacion brote animales granja"
    ),
    TriageRule(
        code="mastitis_udder",
        title="Ubre, leche anormal o mastitis sospechada",
        priority="HIGH",
        terms=[
            "ubre", "mastitis", "leche con grumos", "leche con sangre", "leche mala",
            "ubre caliente", "ubre dura", "pezon", "no sale leche", "pus en leche",
            "ubre hinchada"
        ],
        reasons=[
            "la mastitis puede doler mucho y empeorar rapido",
            "la leche anormal no debe usarse sin criterio veterinario"
        ],
        immediate_actions=[
            "separar en zona limpia y revisar temperatura, dolor, color y consistencia de leche",
            "marcar la leche como no apta hasta valorar",
            "vigilar cria si depende de esa leche",
            "contactar con veterinario si hay fiebre, dolor, ubre caliente o leche anormal"
        ],
        do_not=[
            "no consumir ni mezclar leche anormal",
            "no aplicar antibioticos sin receta ni olvidar periodos de retirada",
            "no forzar ordeno si hay obstruccion o dolor intenso"
        ],
        vet_when="Alta prioridad si hay fiebre, dolor, decaimiento, ubre caliente/dura o leche con sangre, pus o grumos.",
        app_record="Registrar caso sanitario, lado afectado, aspecto de leche, cria asociada y tratamiento solo si lo indica veterinario.",
        rag_query="mastitis ubre leche anormal ovino caprino periodo retirada"
    ),
    TriageRule(
        code="urinary_cat",
        title="Gato que no orina o dolor urinario",
        priority="URGENT",
        terms=[
            "gato no orina", "gata no orina", "no puede orinar", "intenta orinar",
            "maulla al orinar", "sangre en orina", "orina con sangre", "vejiga"
        ],
        reasons=[
            "un bloqueo urinario en gato puede ser mortal en poco tiempo",
            "el dolor urinario requiere valoracion veterinaria"
        ],
        immediate_actions=[
            "mantener al gato tranquilo y en transportin si es posible",
            "llamar o acudir a veterinario de urgencia",
            "anotar desde cuando no orina y si come, vomita o esta decaido"
        ],
        do_not=[
            "no apretar la barriga",
            "no dar medicacion humana",
            "no esperar a manana si no orina"
        ],
        vet_when="Urgente si un gato intenta orinar y no puede, hay dolor, sangre, vomitos o decaimiento.",
        app_record="Registrar como incidencia sanitaria de animal conviviente si se gestiona desde la app.",
        rag_query="gato no orina bloqueo urinario urgencia granja"
    ),
    TriageRule(
        code="heat_cold_stress",
        title="Golpe de calor, hipotermia o cria fria",
        priority="HIGH",
        terms=[
            "golpe de calor", "mucho calor", "al sol", "jadeando por calor",
            "cria fria", "cordero frio", "cabrito frio", "pollito frio",
            "pato frio", "hipotermia", "temblando de frio", "mojado y frio"
        ],
        reasons=[
            "crias y aves mojadas pierden temperatura rapido",
            "el golpe de calor puede ser mortal"
        ],
        immediate_actions=[
            "mover a sombra o zona templada segun el caso",
            "secar cama y animal mojado si procede",
            "ofrecer agua accesible si esta consciente y puede beber",
            "llamar al veterinario si hay debilidad, colapso, respiracion mala o cria que no mama"
        ],
        do_not=[
            "no enfriar bruscamente con agua helada",
            "no dejar crias en cama mojada",
            "no forzar alimento en animales debiles"
        ],
        vet_when="Alta prioridad si hay colapso, cria fria que no mama, ave postrada, jadeo extremo o no responde.",
        app_record="Registrar incidencia, corral, temperatura ambiental, humedad de cama y animales afectados.",
        rag_query="golpe calor hipotermia cria fria aves patos ovino caprino"
    )
]


def classify_triage(message, context=None):
    current_normalized = _normalize(message)
    context_normalized = _normalize(context or "")
    normalized = (
        f"{context_normalized}\n{current_normalized}"
        if context_normalized
        else current_normalized
    )
    species = _detected_species(normalized)

    best_rule = None
    best_matches = []
    best_rank = None
    for rule in RULES:
        current_matches = _matched_terms(current_normalized, rule.terms)
        context_matches = _matched_terms(context_normalized, rule.terms)
        matches = list(dict.fromkeys(current_matches + context_matches))
        if not matches:
            continue

        # A current-message match beats an older context-only match. Context is for
        # follow-ups like "si" or "pero he sacado solo la pata", not for hijacking.
        rank = (
            1 if current_matches else 0,
            PRIORITY_ORDER[rule.priority],
            len(current_matches) * 3 + len(context_matches)
        )

        if best_rank is None or rank > best_rank:
            best_rule = rule
            best_matches = matches
            best_rank = rank

    if best_rule is not None:
        return TriageResult(
            is_relevant=True,
            code=best_rule.code,
            priority=best_rule.priority,
            title=best_rule.title,
            matched_terms=best_matches,
            detected_species=species,
            reasons=best_rule.reasons,
            immediate_actions=best_rule.immediate_actions,
            do_not=best_rule.do_not,
            vet_when=best_rule.vet_when,
            app_record=best_rule.app_record,
            suggested_rag_query=best_rule.rag_query
        )

    has_species = bool(species)
    has_health_context = any(term in normalized for term in HEALTH_CONTEXT_TERMS)
    looks_like_health_question = bool(re.search(r"\b(que hago|que puede ser|esta raro|esta rara|esta mala|esta malo)\b", normalized))

    if has_species and (has_health_context or looks_like_health_question):
        return TriageResult(
            is_relevant=True,
            code="generic_health",
            priority="MEDIUM",
            title="Consulta sanitaria inespecifica",
            matched_terms=[term for term in HEALTH_CONTEXT_TERMS if term in normalized],
            detected_species=species,
            reasons=[
                "hay signos o lenguaje de enfermedad, pero faltan datos para clasificar gravedad",
                "la prioridad sube si hay fiebre, respiracion mala, sangre, dolor, parto, postracion o varios animales"
            ],
            immediate_actions=[
                "separar y observar al animal en un lugar limpio y tranquilo",
                "revisar respiracion, postura, apetito, agua, heces, heridas, mucosas y temperatura si puedes",
                "mirar si hay mas animales del mismo corral o especie afectados"
            ],
            do_not=[
                "no medicar a ciegas",
                "no mezclar con animales vulnerables hasta saber si contagia",
                "no esperar si empeora rapido"
            ],
            vet_when="Contactar con veterinario si hay empeoramiento, fiebre, dolor, no come, no se levanta, sangre, parto o varios afectados.",
            app_record="Registrar caso sanitario con especie, animal/RFID si existe, corral, signos y hora de inicio.",
            suggested_rag_query="consulta sanitaria inespecifica triaje primeros signos animales granja"
        )

    return TriageResult(is_relevant=False, detected_species=species)
