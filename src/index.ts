import * as fs from 'fs';
import * as path from 'path';
import { scrapeAllWeeksHtmls } from './scraper.js';
import { parseHyperplanningHTML, ParsedEvent } from './parser.js';
import { filterAndAssignStudentSchedule } from './filter.js';
import { buildIcsFeed } from './ical.js';

const GROUPS: string[] = [];
for (let i = 1; i <= 20; i++) {
  GROUPS.push(`Gr${i.toString().padStart(2, '0')}`);
}

async function run(): Promise<void> {
  const outDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const url = 'http://planning.medecine.univ-paris-diderot.fr/hp/invite' ;
  const weeklyHtmls = await scrapeAllWeeksHtmls(url, 4);

  console.log(`[Extraction] Analyse de ${weeklyHtmls.length} semaines...`);
  const eventsMap = new Map<string, ParsedEvent>();

  for (const html of weeklyHtmls) {
    const weekEvents = parseHyperplanningHTML(html);
    for (const ev of weekEvents) {
      const key = `${ev.dateStr}-${ev.startTime}-${ev.ue}-${ev.memo}`;
      if (!eventsMap.has(key)) {
        eventsMap.set(key, ev);
      }
    }
  }

  const allMonthEvents = Array.from(eventsMap.values());
  console.log(`-> ${allMonthEvents.length} cours uniques cumulés sur le mois.`);

  const currentYear = new Date().getFullYear();
  const repoOwner = process.env.GITHUB_REPOSITORY_OWNER || 'Charles';
  const repoFullName = process.env.GITHUB_REPOSITORY || 'Charles/dfgsm2_calendar';
  const repoParts = repoFullName.split('/');
  const repoName = repoParts.length > 1 ? repoParts[1] : 'dfgsm2_calendar';

  // 1. Flux promo complet
  const promoFeed = await buildIcsFeed(
    allMonthEvents.map(e => ({ ...e, assignedLocation: e.location.join(', ') || 'Non précisé' })),
    currentYear
  );
  fs.writeFileSync(path.join(outDir, 'promo.ics'), promoFeed, 'utf-8');

  // 2. Flux par groupe
  const stats: { group: string; count: number; file: string }[] = [];

  for (const group of GROUPS) {
    const studentEvents = filterAndAssignStudentSchedule(allMonthEvents, {
      myGroup: group,
      includeStages: true
    });

    const icsContent = await buildIcsFeed(studentEvents, currentYear);
    const fileName = `${group.toLowerCase()}.ics`;
    fs.writeFileSync(path.join(outDir, fileName), icsContent, 'utf-8');

    stats.push({ group, count: studentEvents.length, file: fileName });
  }

  // 3. Portail web d'accueil
  const cardsHtml = stats
    .map(s => {
      return `      <a class="card" href="webcal://${repoOwner}.github.io/${repoName}/${s.file}">
        <strong>${s.group}</strong>
        <span>${s.count} séances</span><br>
        <span style="color:#0969da; font-size:0.85rem;">S'abonner</span>
      </a>`;
    })
    .join('\n');

  const htmlIndex = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Abonnements Agenda DFGSM2</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #222; }
    h1 { color: #800040; margin-bottom: 0.2rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .card { border: 1px solid #e1e4e8; border-radius: 8px; padding: 12px; text-align: center; text-decoration: none; color: inherit; background: #fafbfc; transition: 0.15s ease; }
    .card:hover { border-color: #800040; transform: translateY(-2px); }
    .card strong { display: block; font-size: 1.1rem; color: #800040; }
    .promo-box { background: #fdf2f7; border: 1px solid #d6a0c8; border-radius: 8px; padding: 16px; margin-bottom: 2rem; }
    .promo-box a { color: #800040; font-weight: bold; }
  </style>
</head>
<body>
  <h1>DFGSM2 • Synchronisation Hyperplanning</h1>
  <p class="meta">Actualisé sur 4 semaines glissantes chaque dimanche à 20h00 UTC.<br>Dernière extraction : ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>

  <div class="promo-box">
    <strong>Toute la promotion (cours non filtrés) :</strong><br>
    <a href="webcal://${repoOwner}.github.io/${repoName}/promo.ics">S'abonner au flux complet (promo.ics)</a>
  </div>

  <h2>Choisir un groupe d'ED :</h2>
  <div class="grid">
${cardsHtml}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(outDir, 'index.html'), htmlIndex, 'utf-8');
  console.log(`[Succès] Fichiers générés dans public/`);
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
