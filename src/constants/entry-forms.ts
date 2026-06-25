export type FieldOption = { label: string; value: string };

export type EntryField =
  | { kind: 'time'; key: string; label: string }
  | { kind: 'text'; key: string; label: string; placeholder?: string; multiline?: boolean }
  | { kind: 'number'; key: string; label: string; placeholder?: string }
  | { kind: 'single'; key: string; label: string; options: FieldOption[] }
  | { kind: 'dropdown'; key: string; label: string; options?: FieldOption[]; optionsSource?: 'classrooms' }
  | { kind: 'multi'; key: string; label: string; options: FieldOption[] }
  | { kind: 'toggle'; key: string; label: string }
  | { kind: 'media'; key: string; label: string }
  | { kind: 'activity_picker'; key: string; label: string };

export type EntryFormConfig = { title: string; fields: EntryField[] };

const opts = (...labels: string[]): FieldOption[] => labels.map((l) => ({ label: l, value: l }));
const NOTES: EntryField = { kind: 'text', key: 'notes', label: 'Notes', placeholder: 'Optional notes', multiline: true };
const MEDIA: EntryField = { kind: 'media', key: 'media', label: 'Photo / video' };

export const ENTRY_FORMS: Record<string, EntryFormConfig> = {
  check_in: {
    title: 'Check in',
    fields: [{ kind: 'time', key: 'time', label: 'Time' }, NOTES, MEDIA],
  },
  activity: {
    title: 'Activity',
    fields: [
      { kind: 'activity_picker', key: 'activity_id', label: 'Choose an activity' },
      { kind: 'text', key: 'description', label: 'Description', placeholder: 'What did they do?', multiline: true },
      MEDIA,
    ],
  },
  health: {
    title: 'Health',
    fields: [
      { kind: 'single', key: 'health', label: 'Health', options: opts('Fine', 'Sick', 'Injured') },
      {
        kind: 'multi',
        key: 'observations',
        label: 'Observations',
        options: opts(
          'Runny nose', 'Cough', 'Diarrhea', 'Fever', 'Vomiting', 'Breathing abnormally',
          'Skin rash', 'Cuts / scratches', 'Bruises', 'Behavior', 'Other',
        ),
      },
      NOTES,
    ],
  },
  temperature: {
    title: 'Temperature',
    fields: [
      { kind: 'time', key: 'time', label: 'Time' },
      { kind: 'single', key: 'health', label: 'Health', options: opts('Normal', 'Fever') },
      { kind: 'number', key: 'temperature', label: 'Temperature (°C)', placeholder: 'e.g. 37.0' },
      NOTES,
    ],
  },
  food: {
    title: 'Food',
    fields: [
      {
        kind: 'dropdown',
        key: 'meal',
        label: 'Meal',
        options: opts('Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner', 'Evening snack', 'Fluids', 'Other'),
      },
      { kind: 'single', key: 'quantity', label: 'Quantity', options: opts('All', 'Most', 'Some', 'None') },
      { kind: 'text', key: 'food', label: 'Food', placeholder: 'What did they eat?' },
      MEDIA,
    ],
  },
  sleep: {
    title: 'Sleep',
    fields: [
      { kind: 'time', key: 'start_time', label: 'Start time' },
      { kind: 'time', key: 'end_time', label: 'End time' },
      { kind: 'toggle', key: 'didnt_sleep', label: "Didn't sleep" },
      NOTES,
    ],
  },
  toilet: {
    title: 'Toilet',
    fields: [
      { kind: 'time', key: 'time', label: 'Time' },
      { kind: 'single', key: 'type', label: 'Type', options: opts('Peed', 'Potty', 'Diaper', 'Underwear') },
      NOTES,
    ],
  },
  mood: {
    title: 'Mood',
    fields: [
      {
        kind: 'dropdown',
        key: 'mood',
        label: 'Mood',
        options: opts(
          'Affectionate', 'Aggressive', 'Confrontational', 'Content', 'Cooperative', 'Curious', 'Demanding',
          'Determined', 'Distracted', 'Emotional', 'Energetic', 'Excited', 'Frustrated', 'Giggly', 'Grumpy',
          'Happy', 'Impatient', 'Irritable', 'Lethargic', 'Other', 'Playful', 'Sad', 'Sensitive', 'Shy',
          'Silly', 'Sleepy', 'Sweet', 'Thoughtful', 'Uneasy',
        ),
      },
      { kind: 'single', key: 'level', label: 'Level', options: opts('Slightly', 'Somewhat', 'Very', 'Extremely') },
      NOTES,
      MEDIA,
    ],
  },
  supplies: {
    title: 'Supplies',
    fields: [
      {
        kind: 'multi',
        key: 'supplies',
        label: 'Supplies needed',
        options: opts('Diapers', 'Wipes', 'Cream', 'Clothes', 'Water bottle', 'Other'),
      },
      NOTES,
    ],
  },
  notes: {
    title: 'Notes',
    fields: [{ kind: 'text', key: 'notes', label: 'Notes', placeholder: 'Write a note…', multiline: true }, MEDIA],
  },
  move_rooms: {
    title: 'Move rooms',
    fields: [{ kind: 'dropdown', key: 'room', label: 'Room', optionsSource: 'classrooms' }],
  },
  checkout: {
    title: 'Checkout',
    fields: [{ kind: 'time', key: 'time', label: 'Time' }, NOTES, MEDIA],
  },
};
