import * as cheerio from 'cheerio';

export interface ParsedEvent {
  id: string;
  dateStr: string;
  startTime: string;
  endTime: string;
  ue: string;
  type: string;
  memo: string;
  location: string[];
  teachers: string[];
  groups: string[];
  isRattrapage: boolean;
}

export function parseHyperplanningHTML(html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];

  $('.EmploiDuTemps_Element').each((_, element) => {
    const el = $(element);
    const id = el.attr('id');
    if (!id || el.hasClass('conteneur-multiple')) return;

    const srOnlyText = el.find('.sr-only').first().text().trim();
    const timeMatch = srOnlyText.match(/Cours du (.+?) de (\d{1,2}) heures? (\d{2}) à (\d{1,2}) heures? (\d{2})/i);

    let dateStr = '';
    let startTime = '';
    let endTime = '';

    if (timeMatch) {
      dateStr = timeMatch[1].trim();
      startTime = `${timeMatch[2].padStart(2, '0')}:${timeMatch[3]}`;
      endTime = `${timeMatch[4].padStart(2, '0')}:${timeMatch[5]}`;
    } else {
      const titleAttr = el.find('.cours-simple').attr('title') || '';
      const fallbackMatch = titleAttr.match(/de (\d{2}h\d{2}) à (\d{2}h\d{2})/);
      if (fallbackMatch) {
        startTime = fallbackMatch[1].replace('h', ':');
        endTime = fallbackMatch[2].replace('h', ':');
      }
    }

    if (!startTime || !endTime) return;

    const memoEl = el.find('.contenuMemo');
    const memo = memoEl.attr('title') || memoEl.find('[title]').attr('title') || memoEl.text().trim();

    const location: string[] = [];
    const groups: string[] = [];

    el.find('p[role="link"]').each((_, p) => {
      const linkText = $(p).text().trim();
      if (/^Gr\d+/i.test(linkText)) {
        groups.push(linkText);
      } else if (/AMPHI|ED|SALLE|STAGE|MOODLE|DISTANCIEL/i.test(linkText)) {
        location.push(linkText);
      }
    });

    const contenuDivs = el.find('.contenu').not('.contenuMemo');
    let ue = '';
    const teachers: string[] = [];

    contenuDivs.each((_, div) => {
      const text = $(div).clone().children().remove().end().text().trim();
      if (!text) return;

      if (/^L2-/i.test(text)) {
        ue = text;
      } else if (
        !groups.includes(text) &&
        !location.includes(text) &&
        !['Cours', 'ED', 'Stage', 'Support Moodl'].includes(text)
      ) {
        teachers.push(text);
      }
    });

    const isRattrapage = el.find('.bandeau-rattr').length > 0;
    const typeLabel = el.find('.blocCouleur').parent().text().trim() || (el.hasClass('cours-ms') ? 'ED' : 'Cours');

    events.push({
      id,
      dateStr,
      startTime,
      endTime,
      ue: ue || 'Enseignement',
      type: typeLabel,
      memo,
      location: Array.from(new Set(location)),
      teachers: Array.from(new Set(teachers)),
      groups: Array.from(new Set(groups)),
      isRattrapage,
    });
  });

  return events;
}
