import { ParsedEvent } from './parser.js';

export interface UserScheduleConfig {
  myGroup: string;
  includeStages?: boolean;
}

export interface EnrichedEvent extends ParsedEvent {
  assignedLocation: string;
}

export function normalizeGroupId(groupInput: string): string {
  const match = groupInput.match(/\d+/);
  if (!match) return groupInput.trim();
  const num = parseInt(match[0], 10);
  return `Gr${num.toString().padStart(2, '0')}`;
}

export function filterAndAssignStudentSchedule(
  events: ParsedEvent[],
  config: UserScheduleConfig
): EnrichedEvent[] {
  const targetGroup = normalizeGroupId(config.myGroup);

  return events
    .filter(ev => {
      if (/stage/i.test(ev.type) || /stage/i.test(ev.ue)) {
        return config.includeStages ?? true;
      }
      if (ev.groups.length === 0) {
        return true;
      }
      return ev.groups.map(normalizeGroupId).includes(targetGroup);
    })
    .map(ev => {
      let assignedLocation = ev.location.join(', ');

      if (ev.groups.length > 1 && ev.location.length === ev.groups.length) {
        const groupIndex = ev.groups.map(normalizeGroupId).indexOf(targetGroup);
        if (groupIndex !== -1 && ev.location[groupIndex]) {
          assignedLocation = ev.location[groupIndex];
        }
      }

      return {
        ...ev,
        assignedLocation: assignedLocation || 'Non précisé'
      };
    });
}
