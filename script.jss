// --- Constantes de configuration : tout ce qui est "réglable" est ici ---
const GAME = {
  EVENT_CHANCE: 0.22,             // probabilité d'un événement aléatoire à la décroissance de tour (tous les 3 actions)
  EVENT_CHANCE_PER_ACTION: 0.08,  // probabilité plus faible qu'un événement survienne entre deux tours, à chaque action
  DIFFICULTY_STEP: 0.2,           // +20% de décroissance par génération
  CORONATION_DELAY_MS: 1700,      // pause avant l'écran de couronnement, pour laisser voir l'effet
  START_FAIM: 70,
  START_BONHEUR: 70,
  START_SAVOIR: 20,
  START_ROYAUME: 10,
  PROSPERITY_THRESHOLD: 90,       // relevé (était 80) : il fallait beaucoup trop peu d'effort pour l'atteindre
  PROSPERITY_ROYAUME_BONUS: 1,    // gain de Royaume par jauge florissante à chaque cycle
  DECAY_FAIM: 3,
  DECAY_BONHEUR: 2,
  DECAY_SAVOIR: 1,
  DECAY_ROYAUME: 1,
  FEED_PLAY_GAIN: 20,             // gain de jauge sur quiz réussi (nourrir / jouer)
  TEACH_GAIN: 25,                 // gain de jauge sur quiz réussi (instruire)
  FAIL_GAIN: 8,                   // gain de jauge sur quiz raté (le dauphin progresse un peu quand même)
  ROYAUME_ON_QUIZ_SUCCESS: 2,     // réduit (était 5) : trop élevé, rendait la chute à 0 quasi impossible
  ROYAUME_ON_QUIZ_FAIL: -2,       // nouveau : une mauvaise réponse coûte aussi de l'Autorité, pas seulement du Savoir
  REST_BONHEUR_GAIN: 8,
  WRONG_ANSWER_SAVOIR_PENALTY: 5,  // toute mauvaise réponse entame le Savoir, même sur Nourrir/Jouer
  REST_FAIM_GAIN: 5,
  ACTIONS_PER_TURN: 3,             // nombre d'actions avant que la décroissance par tour se déclenche
};

const ORIGINAL_BG = 'radial-gradient(ellipse at top, #1b2a4a 0%, #101b32 70%)';

let stats = { faim: GAME.START_FAIM, bonheur: GAME.START_BONHEUR, savoir: GAME.START_SAVOIR };
let royaume = GAME.START_ROYAUME;
let isKing = false;
let gameOver = false;
let position = 40;
let actionCount = 0;
let sovereignIndex = 0;
let prestige = 0;
let ecus = 0;
const galleryLog = [];

const SAVE_KEY = 'petitDauphinSave';

function saveProgress() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      sovereignIndex, prestige, ecus, galleryLog, proceduralCounters,
      stats, royaume, actionCount, ownedItems: Array.from(ownedItems)
    }));
  } catch (e) { /* stockage indisponible, on continue sans sauvegarder */ }
}
  
function manualSave() {
  saveProgress();
  setChronicle('💾 Partie sauvegardée.');
  flashChronicle();
}
function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    sovereignIndex = saved.sovereignIndex || 0;
    prestige = saved.prestige || 0;
    ecus = saved.ecus || 0;
    if (Array.isArray(saved.galleryLog)) galleryLog.push(...saved.galleryLog);
    if (saved.proceduralCounters) Object.assign(proceduralCounters, saved.proceduralCounters);
    if (saved.stats) stats = saved.stats;
    if (typeof saved.royaume === 'number') royaume = saved.royaume;
    if (typeof saved.actionCount === 'number') actionCount = saved.actionCount;
    if (Array.isArray(saved.ownedItems)) ownedItems = new Set(saved.ownedItems);
    recomputeBonuses();
  } catch (e) { /* sauvegarde corrompue ou absente, on repart de zéro */ }
}

// Les 5 grands "looks" visuels réutilisés par les personnages/drapeaux/décors.
// Chaque souverain du pool pointe vers l'un de ces 5 looks via son champ "era".
const ERA_VISUALS = [
  { label: "Royaume Mérovingien", icon: "🔥",
    sky: "#3a2f1f", skyEnd: "#5a4530", ground: "#2e2013", groundEnd: "#4a341f" },
  { label: "Empire Carolingien", icon: "🦅",
    sky: "#33324a", skyEnd: "#4d4a6e", ground: "#3a2e22", groundEnd: "#55432f" },
  { label: "Moyen Âge capétien", icon: "🏰",
    sky: "#2d3f66", skyEnd: "#24365a", ground: "#3a2e22", groundEnd: "#4a3a28" },
  { label: "Renaissance et premiers Bourbons", icon: "⛪",
    sky: "#1f3a5c", skyEnd: "#2a4a78", ground: "#332a1a", groundEnd: "#4d3f22" },
  { label: "Versailles et époque moderne", icon: "⛲",
    sky: "#4a3f1f", skyEnd: "#8a6f2a", ground: "#5a4a1f", groundEnd: "#c9a227" },
];

// --- Les 59 souverains réels + prétendants, générés depuis le fichier de données validé ---
const SOVEREIGNS = [
  { name: 'Clovis Ier', dynastie: 'Merovingiens', regne: '481-511', type: 'reel', score: 75, note: 'Unifie les Francs, conversion au catholicisme, fondateur', era: 0 },
  { name: 'Clotaire Ier', dynastie: 'Merovingiens', regne: '511-561', type: 'reel', score: 55, note: 'Reunifie le royaume par heritage', era: 0 },
  { name: 'Dagobert Ier', dynastie: 'Merovingiens', regne: '629-639', type: 'reel', score: 65, note: 'Dernier roi merovingien actif, reformes, essor de Saint-Denis', era: 0 },
  { name: 'Childeric III', dynastie: 'Merovingiens', regne: '743-751', type: 'reel', score: 5, note: 'Roi faineant, depose par Pepin le Bref, tonsure et enferme au monastere', era: 0 },
  { name: 'Pepin le Bref', dynastie: 'Carolingiens', regne: '751-768', type: 'reel', score: 60, note: 'Fonde la dynastie, sacre par le pape, victoires en Italie', era: 1 },
  { name: 'Charlemagne', dynastie: 'Carolingiens', regne: '768-814', type: 'reel', score: 95, note: "Empereur d'Occident, expansion massive, renaissance carolingienne", era: 1 },
  { name: 'Louis Ier le Pieux', dynastie: 'Carolingiens', regne: '814-840', type: 'reel', score: 35, note: 'Empire fracture par les luttes entre ses fils', era: 1 },
  { name: 'Charles II le Chauve', dynastie: 'Carolingiens', regne: '840-877', type: 'reel', score: 45, note: 'Traite de Verdun, mais invasions vikings', era: 1 },
  { name: 'Louis II le Begue', dynastie: 'Carolingiens', regne: '877-879', type: 'reel', score: 25, note: 'Regne tres court et fragile', era: 1 },
  { name: 'Charles III le Simple', dynastie: 'Carolingiens', regne: '898-922', type: 'reel', score: 20, note: 'Capture et emprisonne par ses vassaux, depossede', era: 1 },
  { name: "Louis IV d'Outremer", dynastie: 'Carolingiens', regne: '936-954', type: 'reel', score: 30, note: 'Roi conteste, luttes contre les grands seigneurs', era: 1 },
  { name: 'Lothaire', dynastie: 'Carolingiens', regne: '954-986', type: 'reel', score: 35, note: 'Regne instable face a la puissance des Capetiens montants', era: 1 },
  { name: 'Louis V le Faineant', dynastie: 'Carolingiens', regne: '986-987', type: 'reel', score: 10, note: "Regne d'un an, mort prematuree, dernier Carolingien", era: 1 },
  { name: 'Hugues Capet', dynastie: 'Capetiens directs', regne: '987-996', type: 'reel', score: 55, note: 'Fonde la dynastie capetienne, autorite royale encore faible', era: 2 },
  { name: 'Robert II le Pieux', dynastie: 'Capetiens directs', regne: '996-1031', type: 'reel', score: 45, note: 'Roi pieux mais peu de pouvoir reel', era: 2 },
  { name: 'Henri Ier', dynastie: 'Capetiens directs', regne: '1031-1060', type: 'reel', score: 40, note: 'Regne discret, domaine royal restreint', era: 2 },
  { name: 'Philippe Ier', dynastie: 'Capetiens directs', regne: '1060-1108', type: 'reel', score: 40, note: 'Regne long mais remariage scandaleux, excommunie', era: 2 },
  { name: 'Louis VI le Gros', dynastie: 'Capetiens directs', regne: '1108-1137', type: 'reel', score: 60, note: "Renforce l'autorite royale face aux seigneurs pillards", era: 2 },
  { name: 'Louis VII le Jeune', dynastie: 'Capetiens directs', regne: '1137-1180', type: 'reel', score: 40, note: "Deuxieme croisade en echec, repudie Alienor d'Aquitaine", era: 2 },
  { name: 'Philippe II Auguste', dynastie: 'Capetiens directs', regne: '1180-1223', type: 'reel', score: 90, note: 'Victoire de Bouvines (1214), double le domaine royal', era: 2 },
  { name: 'Louis VIII le Lion', dynastie: 'Capetiens directs', regne: '1223-1226', type: 'reel', score: 55, note: 'Regne court mais efficace, conquetes dans le Sud', era: 2 },
  { name: 'Louis IX (Saint Louis)', dynastie: 'Capetiens directs', regne: '1226-1270', type: 'reel', score: 100, note: 'Justice royale exemplaire, croisades, canonise saint', era: 2 },
  { name: 'Philippe III le Hardi', dynastie: 'Capetiens directs', regne: '1270-1285', type: 'reel', score: 35, note: "Croisade d'Aragon desastreuse", era: 2 },
  { name: 'Philippe IV le Bel', dynastie: 'Capetiens directs', regne: '1285-1314', type: 'reel', score: 70, note: "Renforce l'Etat, proces des Templiers, finances fragilisees", era: 2 },
  { name: 'Louis X le Hutin', dynastie: 'Capetiens directs', regne: '1314-1316', type: 'reel', score: 25, note: 'Regne bref et sans grand accomplissement', era: 2 },
  { name: 'Jean Ier le Posthume', dynastie: 'Capetiens directs', regne: '1316', type: 'reel', score: 0, note: "Mort a 5 jours, n'a jamais vraiment regne", era: 2 },
  { name: 'Philippe V le Long', dynastie: 'Capetiens directs', regne: '1316-1322', type: 'reel', score: 40, note: 'Reformes administratives, regne discret', era: 2 },
  { name: 'Charles IV le Bel', dynastie: 'Capetiens directs', regne: '1322-1328', type: 'reel', score: 30, note: 'Dernier Capetien direct, pas de fils, fin de la lignee', era: 2 },
  { name: 'Philippe VI', dynastie: 'Valois', regne: '1328-1350', type: 'reel', score: 30, note: 'Defaite de Crecy (1346), debut de la guerre de Cent Ans', era: 2 },
  { name: 'Jean II le Bon', dynastie: 'Valois', regne: '1350-1364', type: 'reel', score: 10, note: 'Capture a Poitiers (1356), rancon ecrasante', era: 2 },
  { name: 'Charles V le Sage', dynastie: 'Valois', regne: '1364-1380', type: 'reel', score: 75, note: "Reconquiert le terrain perdu, reforme l'administration", era: 2 },
  { name: 'Charles VI le Fou', dynastie: 'Valois', regne: '1380-1422', type: 'reel', score: 5, note: "Sombre dans la folie, desastre d'Azincourt, deshérite son fils", era: 2 },
  { name: 'Charles VII le Victorieux', dynastie: 'Valois', regne: '1422-1461', type: 'reel', score: 80, note: "Reconquete grace a Jeanne d'Arc, chasse les Anglais", era: 2 },
  { name: 'Louis XI', dynastie: 'Valois', regne: '1461-1483', type: 'reel', score: 65, note: 'Renforce l\'Etat, roi ruse et impopulaire', era: 2 },
  { name: 'Charles VIII', dynastie: 'Valois', regne: '1483-1498', type: 'reel', score: 40, note: "Campagnes d'Italie couteuses et peu fructueuses", era: 2 },
  { name: 'Louis XII', dynastie: 'Valois', regne: '1498-1515', type: 'reel', score: 60, note: 'Pere du peuple, bonne administration', era: 3 },
  { name: 'Francois Ier', dynastie: 'Valois', regne: '1515-1547', type: 'reel', score: 80, note: 'Victoire de Marignan, mecene de la Renaissance, captivite a Pavie', era: 3 },
  { name: 'Henri II', dynastie: 'Valois', regne: '1547-1559', type: 'reel', score: 55, note: 'Recupere Calais, mort accidentelle en tournoi', era: 3 },
  { name: 'Francois II', dynastie: 'Valois', regne: '1559-1560', type: 'reel', score: 15, note: "Regne d'un an, mort jeune, sous influence des Guise", era: 3 },
  { name: 'Charles IX', dynastie: 'Valois', regne: '1560-1574', type: 'reel', score: 10, note: 'Massacre de la Saint-Barthelemy (1572)', era: 3 },
  { name: 'Henri III', dynastie: 'Valois', regne: '1574-1589', type: 'reel', score: 25, note: 'Guerres de religion, assassine, dernier Valois', era: 3 },
  { name: 'Henri IV', dynastie: 'Bourbons', regne: '1589-1610', type: 'reel', score: 85, note: 'Edit de Nantes, pacifie le royaume, assassine en pleine popularite', era: 3 },
  { name: 'Louis XIII', dynastie: 'Bourbons', regne: '1610-1643', type: 'reel', score: 60, note: "Regne efface derriere Richelieu, renforcement de l'Etat", era: 3 },
  { name: 'Louis XIV', dynastie: 'Bourbons', regne: '1643-1715', type: 'reel', score: 95, note: 'Vainc la Fronde, Versailles, apogee du royaume, le Grand Siecle', era: 4 },
  { name: 'Louis XV', dynastie: 'Bourbons', regne: '1715-1774', type: 'reel', score: 35, note: 'Perte du Canada et des Indes, impopularite croissante', era: 4 },
  { name: 'Louis XVI', dynastie: 'Bourbons', regne: '1774-1792', type: 'reel', score: 18, note: 'Reformes sincères (aboli la torture, edit de tolerance), mais indecis face a la crise, depose et execute', era: 4 },
  { name: 'Louis XVIII', dynastie: 'Restauration', regne: '1814-1824', type: 'reel', score: 45, note: 'Restauration, Charte constitutionnelle', era: 4 },
  { name: 'Charles X', dynastie: 'Restauration', regne: '1824-1830', type: 'reel', score: 20, note: 'Chasse par la revolution de 1830', era: 4 },
  { name: 'Louis-Philippe Ier', dynastie: 'Monarchie de Juillet', regne: '1830-1848', type: 'reel', score: 40, note: 'Roi des Francais, chasse par la revolution de 1848', era: 4 },
  { name: 'Louis XIX', dynastie: 'Non-regnant (legitimiste)', regne: '1830', type: 'non_regnant', score: 0, note: "Roi environ 20 minutes lors de l'abdication en cascade de Charles X", era: 4 },
  { name: 'Henri V', dynastie: 'Non-regnant (legitimiste)', regne: '1844-1883', type: 'non_regnant', score: 0, note: 'Comte de Chambord, jamais couronne, refuse le drapeau tricolore', era: 4 },
  { name: 'Jean III', dynastie: 'Non-regnant (legitimiste)', regne: '1883-1887', type: 'non_regnant', score: 0, note: 'Comte de Montizon, pretendant legitimiste', era: 4 },
  { name: 'Charles XI', dynastie: 'Non-regnant (legitimiste)', regne: '1887-1901', type: 'non_regnant', score: 0, note: 'Duc de Madrid, pretendant legitimiste', era: 4 },
  { name: 'Jacques Ier', dynastie: 'Non-regnant (legitimiste)', regne: '1901-1931', type: 'non_regnant', score: 0, note: "Duc d'Anjou et de Madrid, pretendant legitimiste", era: 4 },
  { name: 'Charles XII', dynastie: 'Non-regnant (legitimiste)', regne: '1931-1936', type: 'non_regnant', score: 0, note: "Duc d'Anjou et de San Jaime, pretendant legitimiste", era: 4 },
  { name: 'Alphonse Ier', dynastie: 'Non-regnant (legitimiste)', regne: '1936-1941', type: 'non_regnant', score: 0, note: "Alphonse XIII d'Espagne, pretendant legitimiste", era: 4 },
  { name: 'Henri VI', dynastie: 'Non-regnant (legitimiste)', regne: '1941-1975', type: 'non_regnant', score: 0, note: "Duc d'Anjou et de Segovie, pretendant legitimiste", era: 4 },
  { name: 'Alphonse II', dynastie: 'Non-regnant (legitimiste)', regne: '1975-1989', type: 'non_regnant', score: 0, note: "Duc d'Anjou et de Cadix, pretendant legitimiste", era: 4 },
  { name: 'Louis XX', dynastie: 'Non-regnant (legitimiste)', regne: 'depuis 1989', type: 'non_regnant', score: 0, note: 'Louis-Alphonse de Bourbon, pretendant legitimiste actuel', era: 4 },
];

const REAL_COUNT = SOVEREIGNS.filter(s => s.type === 'reel').length; // 51
const PROCEDURAL_NAMES = ['Louis', 'Henri', 'Philippe', 'Charles', 'Jean', 'François', 'Robert'];
const proceduralStart = { Louis: 21, Henri: 8, Philippe: 9, Charles: 13, Jean: 5, 'François': 3, Robert: 3 };
const proceduralCounters = Object.assign({}, proceduralStart);

function toRoman(num) {
  const table = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let result = '';
  for (const [value, symbol] of table) {
    while (num >= value) { result += symbol; num -= value; }
  }
  return result;
}

function generateProceduralSovereign(n) {
  const name = PROCEDURAL_NAMES[n % PROCEDURAL_NAMES.length];
  const numeral = proceduralCounters[name];
  proceduralCounters[name] += 1;
  return {
    name: name + ' ' + toRoman(numeral),
    dynastie: 'Lignée imaginaire', regne: 'règne fictif', type: 'procedural',
    score: null, note: 'Souverain imaginaire, généré pour prolonger la dynastie au-delà des rois et prétendants réels.',
    era: 4,
  };
}

function getCurrentSovereign() {
  if (sovereignIndex < SOVEREIGNS.length) return SOVEREIGNS[sovereignIndex];
  return generateProceduralSovereign(sovereignIndex - SOVEREIGNS.length);
}

// Événements aléatoires rares, en plus de la routine des 4 actions
const randomEvents = [
  { stat: 'bonheur', amount: -15, extra: { stat: 'royaume', amount: -8 },
    line: "☠️ La peste frappe le royaume. Le peuple est terrifié et la cour s'inquiète." },
  { stat: 'faim', amount: -20,
    line: "🌾 Une disette frappe les campagnes. Les récoltes ont manqué." },
  { stat: 'royaume', amount: 10, extra: { stat: 'savoir', amount: 5 },
    line: "📯 Un ambassadeur étranger apporte des présents et de nouvelles idées à la cour." },
  { stat: 'faim', amount: 15, extra: { stat: 'royaume', amount: 3 },
    line: "🌻 Une récolte exceptionnelle remplit les greniers du royaume." },
  { stat: 'royaume', amount: -10,
    line: "🗡️ Un complot se trame parmi les nobles. La couronne vacille." },
];

function applyEventEffect(key, amount) {
  if (key === 'royaume') royaume = clamp(royaume + amount);
  else stats[key] = clamp(stats[key] + amount);
}

function flashChronicle() {
  const el = document.getElementById('chronicle');
  el.classList.add('event-flash');
  setTimeout(() => el.classList.remove('event-flash'), 1300);
}

function triggerRandomEvent() {
  const event = randomEvents[Math.floor(Math.random() * randomEvents.length)];
  applyEventEffect(event.stat, event.amount);
  if (event.extra) applyEventEffect(event.extra.stat, event.extra.amount);
  setChronicle(event.line);
  flashChronicle();
}

function maybeTriggerEvent() {
  if (Math.random() > GAME.EVENT_CHANCE) return false;
  triggerRandomEvent();
  return true;
}

// --- Banques de questions, une par action ---
const feedBank = [
  { q: "Quel légume était absent des tables royales médiévales (arrivé bien plus tard en France) ?", options: ["La pomme de terre", "Le chou", "La fève"], correct: 0 },
  { q: "Quel plat est typique d'un banquet royal médiéval ?", options: ["Une tourte de gibier", "Une pizza", "Un hamburger"], correct: 0 },
  { q: "Quelle boisson était couramment servie à table, plus que l'eau jugée impure ?", options: ["Le vin coupé d'eau", "Le soda", "Le café glacé"], correct: 0 },
  { q: "Quel épice, très chère, symbolisait le prestige d'un banquet royal ?", options: ["Le poivre", "Le paprika", "Le piment"], correct: 0 },
  { q: "Le sucre, au Moyen Âge, était surtout utilisé comme...", options: ["Un remède de pharmacien, très rare", "Un ingrédient banal et bon marché", "Un colorant textile"], correct: 0 },
  { q: "Quelle céréale servait de base au pain quotidien au Moyen Âge ?", options: ["Le blé", "Le maïs", "Le riz"], correct: 0 },
  { q: "Que mangeaient le plus souvent les paysans, faute de viande ?", options: ["Une soupe ou bouillie de céréales et légumes", "Des steaks grillés", "Des huîtres"], correct: 0 },
  { q: "Le sel était-il un produit courant ou une denrée précieuse et taxée ?", options: ["Précieux et taxé (la gabelle)", "Courant et gratuit", "Interdit à la vente"], correct: 0 },
  { q: "Quel fruit était totalement absent des tables médiévales françaises ?", options: ["L'ananas", "La pomme", "La poire"], correct: 0 },
  { q: "Quelle viande était réservée à la noblesse via le droit de chasse ?", options: ["Le gibier (cerf, sanglier)", "Le poulet", "Le porc"], correct: 0 },
  { q: "Quel édulcorant, avant le sucre raffiné, servait à sucrer les plats ?", options: ["Le miel", "Le sirop d'érable", "L'aspartam"], correct: 0 },
  { q: "Les repas de la noblesse étaient-ils servis en plusieurs services successifs ?", options: ["Oui, en plusieurs services fastueux", "Non, tout était servi en une seule fois", "Non, chacun mangeait dans sa chambre"], correct: 0 },
  { q: "Quelle boisson chaude, aujourd'hui courante, était totalement inconnue en France avant le XVIIe siècle ?", options: ["Le café", "Le vin chaud", "L'hydromel"], correct: 0 },
];

const playBank = [
  { q: "Quel loisir était réservé à la noblesse pour chasser le gibier à plumes ?", options: ["La chasse au faucon", "Le flipper", "Le jeu vidéo"], correct: 0 },
  { q: "Quel jeu, ancêtre du tennis, se pratiquait déjà à la cour ?", options: ["Le jeu de paume", "Le bowling", "Le ping-pong"], correct: 0 },
  { q: "Quel divertissement mettait en scène des chevaliers en armure s'affrontant à cheval ?", options: ["Le tournoi de joute", "Le rallye automobile", "Le tir à l'arc laser"], correct: 0 },
  { q: "Quel jeu de plateau, originaire d'Orient, était très prisé des seigneurs médiévaux ?", options: ["Les échecs", "Le Monopoly", "Le Uno"], correct: 0 },
  { q: "Les bals à la cour se dansaient principalement au son de...", options: ["Luths et violes", "Guitares électriques", "Synthétiseurs"], correct: 0 },
  { q: "Quel instrument à cordes pincées était emblématique des troubadours ?", options: ["Le luth", "La guitare électrique", "Le piano"], correct: 0 },
  { q: "Quel divertissement mêlait acrobates, jongleurs et conteurs sur les places publiques ?", options: ["Les spectacles de ménestrels et jongleurs", "Le cinéma ambulant", "Les concerts de rock"], correct: 0 },
  { q: "La chasse était-elle un loisir libre pour tous, ou réservée par rang social ?", options: ["Réservée selon des droits hiérarchisés", "Libre et ouverte à tous sans restriction", "Interdite à la noblesse"], correct: 0 },
  { q: "Quel jeu de hasard, joué avec des cubes numérotés, était répandu jusqu'à la cour ?", options: ["Les dés", "Les cartes à jouer modernes", "Le poker"], correct: 0 },
  { q: "Quelles fêtes rythmaient l'année et rassemblaient la cour autour de banquets ?", options: ["Les fêtes religieuses (Noël, Pâques...)", "Le Nouvel An chinois", "Halloween"], correct: 0 },
  { q: "Quel loisir nécessitait un cheval dressé et un gantelet de cuir ?", options: ["La fauconnerie", "Le jeu de paume", "Les échecs"], correct: 0 },
  { q: "Les tournois de chevalerie servaient-ils uniquement au divertissement ?", options: ["Non, aussi à l'entraînement militaire et au prestige", "Oui, purement pour le spectacle", "Non, c'était une punition judiciaire"], correct: 0 },
  { q: "Quel sport actuel, sous sa forme moderne, n'existait pas du tout au Moyen Âge ?", options: ["Le football moderne", "La chasse", "Les échecs"], correct: 0 },
];

const teachBank = [
  { q: "Quel roi a fait construire le château de Versailles ?", options: ["Louis XIV", "Louis IX", "Charlemagne"], correct: 0 },
  { q: "En quelle année a eu lieu le sacre de Charlemagne ?", options: ["800", "1515", "1066"], correct: 0 },
  { q: "Qui était surnommé \"le Roi Soleil\" ?", options: ["Louis XVI", "Louis XIV", "Henri IV"], correct: 1 },
  { q: "Quel roi a promulgué l'édit de Nantes ?", options: ["Henri IV", "François Ier", "Philippe le Bel"], correct: 0 },
  { q: "Contre qui François Ier a-t-il remporté la bataille de Marignan en 1515 ?", options: ["Les Suisses", "Les Anglais", "Les Espagnols"], correct: 0 },
  { q: "Qui était le premier roi de la dynastie capétienne ?", options: ["Hugues Capet", "Clovis", "Charles VII"], correct: 0 },
  { q: "Quel roi a été guidé par Jeanne d'Arc ?", options: ["Charles VII", "Louis XI", "Philippe Auguste"], correct: 0 },
  { q: "Sous quel roi la Bastille a-t-elle été prise, en 1789 ?", options: ["Louis XVI", "Louis XV", "Louis XIV"], correct: 0 },
  { q: "Quel traité de 843 partage l'empire carolingien entre les petits-fils de Charlemagne ?", options: ["Le traité de Verdun", "Le traité de Westphalie", "Le traité de Troyes"], correct: 0 },
  { q: "Quelle guerre opposa la France et l'Angleterre de 1337 à 1453 ?", options: ["La guerre de Cent Ans", "La guerre de Trente Ans", "La guerre de Sept Ans"], correct: 0 },
  { q: "Quel événement tragique se produit à Paris dans la nuit du 23 au 24 août 1572 ?", options: ["Le massacre de la Saint-Barthélemy", "La prise de la Bastille", "Le sacre de Charlemagne"], correct: 0 },
  { q: "Quel ministre réforme les finances et l'économie sous Louis XIV ?", options: ["Colbert", "Necker", "Sully"], correct: 0 },
  { q: "Quel roi fait construire la Sainte-Chapelle à Paris ?", options: ["Saint Louis (Louis IX)", "Philippe Auguste", "Louis XIV"], correct: 0 },
  { q: "Quelle épidémie ravage la France et l'Europe au milieu du XIVe siècle ?", options: ["La peste noire", "Le choléra", "La grippe espagnole"], correct: 0 },
  { q: "Qui est le cardinal principal ministre de Louis XIII ?", options: ["Richelieu", "Mazarin", "Fleury"], correct: 0 },
  { q: "Quel roi de France meurt accidentellement lors d'un tournoi en 1559 ?", options: ["Henri II", "François Ier", "Charles IX"], correct: 0 },
];

  const SOVEREIGN_QUESTIONS = {
  'Clovis Ier': [
    { q: "Vers quelle année Clovis a-t-il été baptisé à Reims ?", options: ["496", "800", "987"], correct: 0 },
    { q: "Quelle bataille Clovis remporte-t-il contre les Alamans, motivant sa conversion selon la légende ?", options: ["Tolbiac", "Bouvines", "Poitiers"], correct: 0 },
  ],
  'Charlemagne': [
    { q: "Quelle ville Charlemagne choisit-il comme capitale de son empire ?", options: ["Aix-la-Chapelle", "Paris", "Reims"], correct: 0 },
    { q: "Comment appelle-t-on l'essor culturel et intellectuel encouragé par Charlemagne ?", options: ["La renaissance carolingienne", "Le siècle des Lumières", "L'âge d'or capétien"], correct: 0 },
  ],
  'Hugues Capet': [
    { q: "Quel dernier roi carolingien Hugues Capet succède-t-il en 987 ?", options: ["Louis V le Fainéant", "Charles III le Simple", "Louis IV d'Outremer"], correct: 0 },
  ],
  'Philippe II Auguste': [
    { q: "En quelle année Philippe Auguste remporte-t-il la bataille de Bouvines ?", options: ["1214", "1180", "1300"], correct: 0 },
    { q: "Quelle forteresse parisienne Philippe Auguste fait-il construire ?", options: ["Le Louvre", "La Bastille", "Le Palais-Royal"], correct: 0 },
  ],
  'Louis IX (Saint Louis)': [
    { q: "Lors de quelle croisade Saint Louis meurt-il, en 1270 ?", options: ["La huitième croisade, à Tunis", "La première croisade", "La croisade des Albigeois"], correct: 0 },
    { q: "En quelle année Saint Louis est-il canonisé par le pape ?", options: ["1297", "1270", "1226"], correct: 0 },
  ],
  'Philippe IV le Bel': [
    { q: "En quelle année Philippe le Bel fait-il arrêter les Templiers ?", options: ["1307", "1214", "1328"], correct: 0 },
    { q: "Quelle ville devient le siège de la papauté sous son influence ?", options: ["Avignon", "Rome", "Reims"], correct: 0 },
  ],
  'Charles VII le Victorieux': [
    { q: "Dans quelle ville Charles VII est-il sacré grâce à Jeanne d'Arc, en 1429 ?", options: ["Reims", "Paris", "Orléans"], correct: 0 },
  ],
  'Louis XI': [
    { q: "Quel surnom donne-t-on à Louis XI pour son habileté diplomatique retorse ?", options: ["L'universelle araignée", "Le Roi-Soleil", "Le Bien-Aimé"], correct: 0 },
  ],
  'Francois Ier': [
    { q: "Quel établissement d'enseignement François Ier fonde-t-il en 1530 ?", options: ["Le Collège de France", "La Sorbonne", "Saint-Cyr"], correct: 0 },
    { q: "Comment s'appelle la rencontre faste entre François Ier et Henri VIII d'Angleterre en 1520 ?", options: ["Le Camp du Drap d'Or", "Le Traité de Verdun", "Les États Généraux"], correct: 0 },
  ],
  'Henri IV': [
    { q: "Quelle phrase Henri IV aurait-il prononcée en se convertissant au catholicisme ?", options: ["Paris vaut bien une messe", "L'État, c'est moi", "Après moi, le déluge"], correct: 0 },
    { q: "Quel plat Henri IV souhaitait-il voir sur la table de chaque paysan le dimanche ?", options: ["Une poule au pot", "Un gigot d'agneau", "Une tourte de gibier"], correct: 0 },
  ],
  'Louis XIV': [
    { q: "En quelle année la cour s'installe-t-elle définitivement à Versailles ?", options: ["1682", "1643", "1715"], correct: 0 },
    { q: "Quel édit Louis XIV révoque-t-il en 1685, retirant leurs droits aux protestants ?", options: ["L'édit de Nantes", "L'édit de Fontainebleau", "L'édit de tolérance"], correct: 0 },
  ],
  'Louis XVI': [
    { q: "Quel pays Louis XVI soutient-il militairement contre les Britanniques en 1778 ?", options: ["Les insurgés américains", "L'Espagne", "La Prusse"], correct: 0 },
    { q: "Comment s'appelle la tentative de fuite ratée de la famille royale en 1791 ?", options: ["La fuite à Varennes", "La Fronde", "La Terreur"], correct: 0 },
  ],
};

// --- Config par action : quelle jauge, quels gains, quels textes ---
const actionConfig = {
  feed: {
    eyebrow: "Le repas royal", bank: feedBank, stat: 'faim',
    successGain: GAME.FEED_PLAY_GAIN, failGain: GAME.FAIL_GAIN,
    royaumeSuccess: GAME.ROYAUME_ON_QUIZ_SUCCESS, royaumeFail: GAME.ROYAUME_ON_QUIZ_FAIL,
    correctLine: "Le dauphin savoure un repas digne de son rang.",
    wrongLine: "Le repas n'était pas tout à fait d'époque... mais il a mangé.",
    move: true,
  },
  play: {
    eyebrow: "Le temps du loisir", bank: playBank, stat: 'bonheur',
    successGain: GAME.FEED_PLAY_GAIN, failGain: GAME.FAIL_GAIN,
    royaumeSuccess: GAME.ROYAUME_ON_QUIZ_SUCCESS, royaumeFail: GAME.ROYAUME_ON_QUIZ_FAIL,
    correctLine: "Le dauphin s'est diverti comme il se doit à la cour.",
    wrongLine: "Le jeu choisi n'existait pas encore... mais il s'est amusé quand même.",
    move: true,
  },
  teach: {
    eyebrow: "Leçon du précepteur", bank: teachBank, stat: 'savoir',
    successGain: GAME.TEACH_GAIN, failGain: GAME.FAIL_GAIN,
    royaumeSuccess: GAME.ROYAUME_ON_QUIZ_SUCCESS, royaumeFail: GAME.ROYAUME_ON_QUIZ_FAIL,
    correctLine: "Bien répondu ! Le dauphin retient sa leçon.",
    wrongLine: "Pas tout à fait... mais il progresse un peu quand même.",
    move: false,
  },
};

const usedQuestions = { feed: [], play: [], teach: [] };
let currentAction = null;
let pendingCorrect = false;

const SHOP_ITEMS = [
  { id: 'cour_joyeuse', name: 'Cour joyeuse', icon: '🎭', cost: 3,
    description: '+10 Bonheur de départ à chaque nouveau règne.',
    effect: { type: 'startStat', stat: 'bonheur', amount: 10 } },
  { id: 'grenier_royal', name: 'Grenier royal', icon: '🌾', cost: 10,
    description: '+10 Faim de départ à chaque nouveau règne.',
    effect: { type: 'startStat', stat: 'faim', amount: 10 } },
  { id: 'garde_royale', name: 'Garde royale', icon: '🛡️', cost: 12,
    description: "+10 Autorité de départ à chaque nouveau règne.",
    effect: { type: 'startRoyaume', amount: 10 } },
  { id: 'precepteur_particulier', name: 'Précepteur particulier', icon: '📖', cost: 15,
    description: '+10 Savoir de départ à chaque nouveau règne.',
    effect: { type: 'startStat', stat: 'savoir', amount: 10 } },
  { id: 'conseiller_clement', name: 'Conseiller clément', icon: '🕊️', cost: 25,
    description: 'Réduit de 2 la pénalité de Savoir infligée par une mauvaise réponse.',
    effect: { type: 'savoirPenaltyReduction', amount: 2 } },
  { id: 'tresorier_habile', name: 'Trésorier habile', icon: '💰', cost: 30,
    description: '+1 Autorité supplémentaire à chaque bonne réponse.',
    effect: { type: 'royaumeGainBonus', amount: 1 } },
];

let ownedItems = new Set();

const bonuses = {
  startFaim: 0, startBonheur: 0, startSavoir: 0, startRoyaume: 0,
  savoirPenaltyReduction: 0, royaumeGainBonus: 0,
};

function recomputeBonuses() {
  bonuses.startFaim = 0;
  bonuses.startBonheur = 0;
  bonuses.startSavoir = 0;
  bonuses.startRoyaume = 0;
  bonuses.savoirPenaltyReduction = 0;
  bonuses.royaumeGainBonus = 0;
  for (const item of SHOP_ITEMS) {
    if (!ownedItems.has(item.id)) continue;
    const e = item.effect;
    if (e.type === 'startStat' && e.stat === 'faim') bonuses.startFaim += e.amount;
    else if (e.type === 'startStat' && e.stat === 'bonheur') bonuses.startBonheur += e.amount;
    else if (e.type === 'startStat' && e.stat === 'savoir') bonuses.startSavoir += e.amount;
    else if (e.type === 'startRoyaume') bonuses.startRoyaume += e.amount;
    else if (e.type === 'savoirPenaltyReduction') bonuses.savoirPenaltyReduction += e.amount;
    else if (e.type === 'royaumeGainBonus') bonuses.royaumeGainBonus += e.amount;
  }
}

function freshStats() {
  return {
    faim: clamp(GAME.START_FAIM + bonuses.startFaim),
    bonheur: clamp(GAME.START_BONHEUR + bonuses.startBonheur),
    savoir: clamp(GAME.START_SAVOIR + bonuses.startSavoir),
  };
}

function freshRoyaume() {
  return clamp(GAME.START_ROYAUME + bonuses.startRoyaume);
}

function buyItem(id) {
  const item = SHOP_ITEMS.find(i => i.id === id);
  if (!item || ownedItems.has(id)) return;
  if (ecus < item.cost) {
    setChronicle("Pas assez d'Écus pour acheter " + item.name + ".");
    flashChronicle();
    return;
  }
  ecus -= item.cost;
  ownedItems.add(id);
  recomputeBonuses();
  saveProgress();
  document.getElementById('ecusValue').textContent = '🪙 Écus : ' + ecus;
  setChronicle(item.name + ' rejoint votre trésor royal !');
  flashChronicle();
  renderShop();
}

function renderShop() {
  const listEl = document.getElementById('shopList');
  listEl.innerHTML = SHOP_ITEMS.map(item => {
    const owned = ownedItems.has(item.id);
    const affordable = ecus >= item.cost;
    const btnLabel = owned ? 'Acquis' : (item.cost + ' 🪙');
    const btnDisabled = owned || !affordable ? 'disabled' : '';
    return `
      <div class="shop-entry">
        <div class="shop-entry-info">
          <div class="shop-entry-name">${item.icon} ${item.name}</div>
          <div class="shop-entry-desc">${item.description}</div>
        </div>
        <button class="shop-buy-btn" ${btnDisabled} onclick="buyItem('${item.id}')">${btnLabel}</button>
      </div>
    `;
  }).join('');
}

function openShop() {
  renderShop();
  document.getElementById('shopOverlay').classList.add('open');
}

function closeShop() {
  document.getElementById('shopOverlay').classList.remove('open');
}

function clamp(v) { return Math.max(0, Math.min(100, v)); }

function setChronicle(text) {
  document.getElementById('chronicle').textContent = text;
}

function setButtonsDisabled(disabled) {
  ['btn-feed', 'btn-play', 'btn-teach', 'btn-rest'].forEach(id => {
    document.getElementById(id).disabled = disabled;
  });
}

function moveCharacter() {
  position = position === 40 ? 340 : 40;
  document.getElementById('character').style.left = position + 'px';
}

function updateFlag() {
  const flag = document.getElementById('flagBanner');
  flag.classList.remove('crisis', 'glorious');
  if (royaume < 30) flag.classList.add('crisis');
  else if (royaume > 70) flag.classList.add('glorious');
}

function updateBars() {
  document.getElementById('bar-faim').style.width = stats.faim + '%';
  document.getElementById('bar-bonheur').style.width = stats.bonheur + '%';
  document.getElementById('bar-savoir').style.width = stats.savoir + '%';
  document.getElementById('bar-royaume').style.width = royaume + '%';

  const moodEl = document.getElementById('mood');
  const avg = (stats.faim + stats.bonheur + stats.savoir) / 3;
  moodEl.textContent = avg > 60 ? '😊' : avg > 30 ? '😐' : '😢';

  updateFlag();
  document.getElementById('prestigeEstimate').textContent = 'Prestige estimé en fin de règne : ~' + estimatePrestige();
  checkEndStates();
  saveProgress();
}

// --- Quiz générique, partagé par nourrir / jouer / instruire ---
function pickQuestion(type) {
  const bank = actionConfig[type].bank;
  if (usedQuestions[type].length >= bank.length) usedQuestions[type] = [];
  let idx;
  do { idx = Math.floor(Math.random() * bank.length); } while (usedQuestions[type].includes(idx));
  usedQuestions[type].push(idx);
  return bank[idx];
}
  
function shuffleOptions(question) {
  const indices = question.options.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return {
    q: question.q,
    options: indices.map(i => question.options[i]),
    correct: indices.indexOf(question.correct),
  };
}

const usedSpecificQuestions = {};

function pickTeachQuestion() {
  const sovereign = getCurrentSovereign();
  const specific = SOVEREIGN_QUESTIONS[sovereign.name];
  if (specific && specific.length > 0) {
    if (!usedSpecificQuestions[sovereign.name]) usedSpecificQuestions[sovereign.name] = [];
    const usedList = usedSpecificQuestions[sovereign.name];
    if (usedList.length < specific.length) {
      let idx;
      do { idx = Math.floor(Math.random() * specific.length); } while (usedList.includes(idx));
      usedList.push(idx);
      return specific[idx];
    }
  }
  return pickQuestion('teach');
}
  
function startQuiz(type) {
  if (gameOver) return;
  currentAction = type;
  const cfg = actionConfig[type];
  const question = type === 'teach'
    ? shuffleOptions(pickTeachQuestion())
    : shuffleOptions(pickQuestion(type));

  document.getElementById('quizEyebrow').textContent = cfg.eyebrow;
  const qEl = document.getElementById('quizQuestion');
  const optsEl = document.getElementById('quizOptions');
  const feedbackEl = document.getElementById('quizFeedback');
  const continueBtn = document.getElementById('quizContinue');

  qEl.textContent = question.q;
  optsEl.innerHTML = '';
  feedbackEl.textContent = '';
  continueBtn.classList.remove('visible');

  question.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = opt;
    btn.onclick = () => answerQuiz(i, question.correct, btn, optsEl);
    optsEl.appendChild(btn);
  });

  document.getElementById('quizOverlay').classList.add('open');
}

function answerQuiz(chosen, correct, btnEl, optsEl) {
  const feedbackEl = document.getElementById('quizFeedback');
  const continueBtn = document.getElementById('quizContinue');
  Array.from(optsEl.children).forEach(b => b.onclick = null);

  const cfg = actionConfig[currentAction];
  if (chosen === correct) {
    btnEl.classList.add('correct');
    feedbackEl.textContent = cfg.correctLine + (cfg.royaumeSuccess > 0 ? ` (+${cfg.royaumeSuccess} Royaume)` : '');
    pendingCorrect = true;
  } else {
    btnEl.classList.add('wrong');
    optsEl.children[correct].classList.add('correct');
    feedbackEl.textContent = cfg.wrongLine + ` (-${GAME.WRONG_ANSWER_SAVOIR_PENALTY} Savoir)`;
    pendingCorrect = false;
  }
  continueBtn.classList.add('visible');
}

function closeQuiz() {
  document.getElementById('quizOverlay').classList.remove('open');
  const cfg = actionConfig[currentAction];

  if (pendingCorrect) {
    stats[cfg.stat] = clamp(stats[cfg.stat] + cfg.successGain);
    royaume = clamp(royaume + cfg.royaumeSuccess + bonuses.royaumeGainBonus);
  } else {
    if (cfg.stat !== 'savoir') {
      stats[cfg.stat] = clamp(stats[cfg.stat] + cfg.failGain);
    }
    stats.savoir = clamp(stats.savoir - Math.max(GAME.WRONG_ANSWER_SAVOIR_PENALTY - bonuses.savoirPenaltyReduction, 0));
    royaume = clamp(royaume + cfg.royaumeFail);
  }

  if (cfg.move) moveCharacter();
  updateBars();
  registerAction();
}

function rest() {
  if (gameOver) return;
  stats.bonheur = clamp(stats.bonheur + GAME.REST_BONHEUR_GAIN);
  stats.faim = clamp(stats.faim + GAME.REST_FAIM_GAIN);
  setChronicle("Le dauphin fait la sieste sous un dais. Il se repose, bercé par les ménestrels.");
  updateBars();
  registerAction();
}

// --- Fins de partie ---
const endContent = {
  faim: { emoji: '💀', title: 'Mort de faim', messages: [
    "Le dauphin, affamé, n'a pas survécu à l'hiver. Le royaume est en deuil.",
    "Les greniers étaient vides depuis trop longtemps. Le dauphin s'est éteint.",
    "Faute de pain, le petit dauphin n'a pas tenu jusqu'au printemps.",
  ] },
  bonheur: { emoji: '💔', title: 'Mort de tristesse', messages: [
    "Privé de joie, le dauphin s'est éteint de chagrin, seul dans ses appartements.",
    "Sans un seul instant de bonheur, le cœur du dauphin a fini par se briser.",
    "La mélancolie a eu raison du petit dauphin, oublié dans son ennui.",
  ] },
  savoir: { emoji: '🥴', title: 'Le dauphin sombre dans la folie', messages: [
    "Livré à lui-même, sans précepteur, son esprit s'est égaré. Il erre dans les couloirs du château.",
    "Faute d'instruction, le dauphin a perdu pied avec la raison.",
    "Sans leçons, l'esprit du dauphin s'est effrité peu à peu.",
  ] },
  royaume: { emoji: '⚔️', title: 'La Fronde a triomphé', messages: [
    "Négligé, le royaume s'est soulevé. Les nobles ont pris le pouvoir. Le dauphin est déchu.",
    "La couronne a vacillé trop longtemps. La Fronde a fini par l'emporter.",
    "Faute d'autorité, les grands seigneurs ont pris le contrôle du royaume.",
  ] },
  victory: { emoji: '👑', title: 'Couronnement', messages: [
    "Le dauphin achève sa formation et est jugé digne de régner. Une nouvelle page de la lignée s'écrit.",
  ], chronicle: '👑 Vive le Roi ! Sa formation est achevée.' },
};

function pickEndMessage(cause) {
  const msgs = endContent[cause].messages;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function applyEraDecor() {
  const sovereign = getCurrentSovereign();
  const visual = ERA_VISUALS[sovereign.era];
  const courtyard = document.querySelector('.courtyard');
  courtyard.style.background =
    `linear-gradient(180deg, ${visual.sky} 0%, ${visual.skyEnd} 55%, ${visual.ground} 55%, ${visual.groundEnd} 100%)`;
  document.getElementById('eraIcon').textContent = visual.icon;

  const character = document.getElementById('character');
  character.classList.remove('era-0', 'era-1', 'era-2', 'era-3', 'era-4');
  character.classList.add('era-' + sovereign.era);

  const flagBanner = document.getElementById('flagBanner');
  flagBanner.classList.remove('era-0', 'era-1', 'era-2', 'era-3', 'era-4');
  flagBanner.classList.add('era-' + sovereign.era);
}

function updateSovereignHeader() {
  const sovereign = getCurrentSovereign();
  document.getElementById('sovereignName').textContent = 'Le Dauphin';
  document.getElementById('sovereignMeta').textContent =
    'Destiné à devenir ' + sovereign.name + ' — ' + ERA_VISUALS[sovereign.era].label;
  document.getElementById('prestigeValue').textContent = '⚜️ Prestige (Gloire de la lignée) : ' + prestige;
  document.getElementById('ecusValue').textContent = '🪙 Écus : ' + ecus;
  applyEraDecor();
}

function computeScore() {
  const avgNeeds = (stats.faim + stats.bonheur + stats.savoir) / 3;
  return Math.round(clamp(avgNeeds * 0.7 + royaume * 0.3));
}

function estimatePrestige() {
  const finalScore = computeScore();
  return Math.max(Math.round(finalScore / 10), 1);
}

function openGallery() {
  const listEl = document.getElementById('galleryList');
  if (galleryLog.length === 0) {
    listEl.innerHTML = '<p style="font-style:italic;">Aucun règne achevé pour l\'instant.</p>';
  } else {
    listEl.innerHTML = galleryLog.slice().reverse().map(entry => `
      <div class="gallery-entry">
        <div class="g-name">${entry.name} — ${entry.causeLabel}</div>
        <div class="g-score">Score : ${entry.score}${entry.refScore !== null ? ' (réel : ' + entry.refScore + ')' : ''} — +${entry.prestigeGain} Prestige</div>
      </div>
    `).join('');
  }
  document.getElementById('galleryOverlay').classList.add('open');
}

function closeGallery() {
  document.getElementById('galleryOverlay').classList.remove('open');
}

function checkEndStates() {
  if (gameOver) return;
  if (stats.faim <= 0) { endRun('faim'); return; }
  if (stats.bonheur <= 0) { endRun('bonheur'); return; }
  if (stats.savoir <= 0) { endRun('savoir'); return; }
  if (royaume <= 0) { endRun('royaume'); return; }
  if (stats.savoir >= 100 && stats.faim >= 75 && stats.bonheur >= 80) { endRun('victory'); }
}

function endRun(cause) {
  gameOver = true;
  setButtonsDisabled(true);

  const sovereign = getCurrentSovereign();
  const finalScore = computeScore();
  const prestigeGain = Math.max(Math.round(finalScore / 10), 1) + (cause === 'victory' ? 5 : 0);
  prestige += prestigeGain;
  ecus += prestigeGain; // même formule que le Prestige pour l'instant, mais dépensable dans la boutique

  galleryLog.push({
    name: sovereign.name,
    causeLabel: endContent[cause].title,
    score: finalScore,
    refScore: sovereign.score,
    prestigeGain,
  });

  if (cause === 'victory') {
    document.getElementById('character').classList.add('is-king');
    document.getElementById('crown').classList.add('visible');
    document.getElementById('pageBody').style.background = 'linear-gradient(#f7d774, #1b2a4a)';
    document.getElementById('character').style.transform = 'scale(1.3)';
  }
  setChronicle(endContent[cause].chronicle || endContent[cause].title);

  setTimeout(() => showEndScreen(cause, sovereign, finalScore, prestigeGain),
    cause === 'victory' ? GAME.CORONATION_DELAY_MS : 0);
}

function showEndScreen(cause, sovereign, finalScore, prestigeGain) {
  const content = endContent[cause];
  const box = document.getElementById('endBox');
  box.classList.remove('victory', 'defeat');
  box.classList.add(cause === 'victory' ? 'victory' : 'defeat');

  document.getElementById('endEmoji').textContent = content.emoji;
  document.getElementById('endTitle').textContent = cause === 'victory' ? 'Couronnement de ' + sovereign.name : content.title;
  document.getElementById('endMessage').textContent = pickEndMessage(cause);

  const compareEl = document.getElementById('scoreCompare');
  if (sovereign.score !== null) {
    compareEl.textContent = `Votre score : ${finalScore}. ${sovereign.name} (réel) avait atteint ${sovereign.score} : ${sovereign.note}`;
  } else {
    compareEl.textContent = `Votre score : ${finalScore}. ${sovereign.name} est un souverain imaginaire, sans référence historique.`;
  }
  document.getElementById('prestigeGain').textContent = `+${prestigeGain} Prestige (total : ${prestige})`;

  const btn = document.getElementById('endActionBtn');
  btn.textContent = 'Souverain suivant';
  btn.onclick = nextSovereign;

  document.getElementById('endOverlay').classList.add('open');
}

function nextSovereign() {
  document.getElementById('endOverlay').classList.remove('open');

  const wasLastReal = sovereignIndex === REAL_COUNT - 1;
  const wasLastNonRegnant = sovereignIndex === SOVEREIGNS.length - 1;
  sovereignIndex += 1;

  stats = freshStats();
  royaume = freshRoyaume();
  isKing = false;
  gameOver = false;
  position = 40;
  actionCount = 0;
  updateTurnCounter();

  document.getElementById('character').style.transform = 'scale(1)';
  document.getElementById('character').style.left = '40px';
  document.getElementById('character').classList.remove('is-king');
  document.getElementById('crown').classList.remove('visible');
  document.getElementById('pageBody').style.background = ORIGINAL_BG;

  updateSovereignHeader();
  setButtonsDisabled(false);

  if (wasLastReal) {
    setChronicle('Les rois de France s\'arrêtent ici. Place aux prétendants qui n\'ont jamais régné.');
  } else if (wasLastNonRegnant) {
    setChronicle('La lignée continue désormais avec des souverains imaginaires.');
  } else {
    setChronicle('Un nouveau souverain naît. Le royaume attend beaucoup de lui.');
  }
  updateBars();
}

// --- Le tour : chaque action compte, la décroissance arrive tous les 3 tours (pas de timer) ---
function registerAction() {
  if (gameOver) return;
  actionCount += 1;
  updateTurnCounter();
  if (actionCount >= GAME.ACTIONS_PER_TURN) {
    actionCount = 0;
    updateTurnCounter();
    applyTurnDecay();
  } else if (Math.random() < GAME.EVENT_CHANCE_PER_ACTION) {
    // Un événement peut aussi survenir entre deux journées, pas seulement à la décroissance de tour.
    triggerRandomEvent();
    updateBars();
  }
}

function updateTurnCounter() {
  for (let i = 0; i < GAME.ACTIONS_PER_TURN; i++) {
    const dot = document.getElementById('turnDot' + i);
    if (dot) dot.classList.toggle('filled', i < actionCount);
  }
}

function applyTurnDecay() {
  const sovereign = getCurrentSovereign();
  const difficulty = 1 + sovereign.era * GAME.DIFFICULTY_STEP; // dynastie plus tardive = plus exigeante
  stats.faim = clamp(stats.faim - Math.round(GAME.DECAY_FAIM * difficulty));
  stats.bonheur = clamp(stats.bonheur - Math.round(GAME.DECAY_BONHEUR * difficulty));
  stats.savoir = clamp(stats.savoir - Math.round(GAME.DECAY_SAVOIR * difficulty));
  royaume = clamp(royaume - Math.round(GAME.DECAY_ROYAUME * difficulty));

  const prosperousStats = ['faim', 'bonheur', 'savoir'].filter(k => stats[k] > GAME.PROSPERITY_THRESHOLD).length;
  let prosperityGain = 0;
  if (prosperousStats === 3) {
    prosperityGain = GAME.PROSPERITY_ROYAUME_BONUS;
    royaume = clamp(royaume + prosperityGain);
  }

  const eventFired = maybeTriggerEvent();
  if (!eventFired && prosperityGain > 0) {
    setChronicle(`Le royaume prospère sous votre gouverne (+${prosperityGain} Royaume).`);
  } else if (!eventFired && (stats.faim < 20 || stats.bonheur < 20)) {
    setChronicle("Le dauphin semble contrarié. Occupez-vous de lui.");
  }
  updateBars();
}
  
// Outil de test : ouvrir la console du navigateur (F12) et taper jumpTo("Louis XIV")
// ou jumpTo(43) pour sauter directement à un souverain par nom ou par index.
window.jumpTo = function(target) {
  let index;
  if (typeof target === 'number') {
    index = target;
  } else {
    index = SOVEREIGNS.findIndex(s => s.name.toLowerCase().includes(String(target).toLowerCase()));
    if (index === -1) { console.log('Souverain introuvable :', target); return; }
  }
  sovereignIndex = index;
  stats = freshStats();
  royaume = freshRoyaume();
  isKing = false;
  gameOver = false;
  actionCount = 0;
  document.getElementById('character').classList.remove('is-king');
  document.getElementById('crown').classList.remove('visible');
  document.getElementById('pageBody').style.background = ORIGINAL_BG;
  setButtonsDisabled(false);
  loadProgress();
  updateSovereignHeader();
  updateTurnCounter();
  updateBars();
  console.log('Sauté à :', getCurrentSovereign().name, '(era', getCurrentSovereign().era + ')');
};

  
loadProgress();
recomputeBonuses();
updateSovereignHeader();
updateTurnCounter();
updateBars();
