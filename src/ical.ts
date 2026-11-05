import { createEvents, EventAttributes } from 'ics';
import { EnrichedEvent } from './filter.js';

const MONTH_MAP: Record<string, number> = {
  janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12
};

function toIcsEvent(ev: EnrichedEvent, defaultYear: number): EventAttributes {
  const parts = ev.dateStr.split(' ');
  const day = parseInt(parts[0], 10) || 1;
  const month = MONTH_MAP[parts[1]?.toLowerCase()] ?? 11;

  let year = defaultYear;
  if (month <= 7 && new Date().getMonth() >= 7) {
    year += 1;
  }

  const [startH, startM] = ev.startTime.split(':').map(Number);
  const [endH, endM] = ev.endTime.split(':').map(Number);

  const prefixRattr = ev.isRattrapage ? '[RATTRAPAGE] ' : '';
  const typeTag = ev.type ? `[${ev.type}] ` : '';
  const summary = `${prefixRattr}${typeTag}${ev.ue}`.trim();

  const descriptionLines = [
    ev.memo ? `Détail : ${ev.memo}` : '',
    ev.teachers.length > 0 ? `Enseignant(s) : ${ev.teachers.join(', ')}` : '',
    ev.groups.length > 0 ? `Groupes concernés : ${ev.groups.join(', ')}` : '',
    `Salle assignée : ${ev.assignedLocation}`,
    '',
    `Source : Hyperplanning DFGSM2`
  ].filter(Boolean);

  const rawUid = `${year}-${month}-${day}-${ev.startTime}-${ev.ue}-${ev.assignedLocation}`;
  const uid = Buffer.from(rawUid).toString('base64').replace(/=/g, '') + '@dfgsm2.medecine';

  return {
    uid,
    title: summary,
    description: descriptionLines.join('\n'),
    location: ev.assignedLocation,
    start: [year, month, day, startH, startM],
    end: [year, month, day, endH, endM],
    status: 'CONFIRMED',
    busyStatus: 'BUSY',
    productId: 'dfgsm2-hyperplanning-sync'
  };
}

export async function buildIcsFeed(events: EnrichedEvent[], defaultYear: number): Promise<string> {
  const icsEvents = events.map(e => toIcsEvent(e, defaultYear));

  return new Promise((resolve, reject) => {
    createEvents(icsEvents, (error, value) => {
      if (error) return reject(error);
      resolve(value);
    });
  });
}
