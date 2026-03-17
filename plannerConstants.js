export const PRIORITY_ORDER = [
  "urgent",
  "today",
  "week",
  "weekend",
  "open",
  "leisure",
];

export const PRIORITY_META = {
  urgent: {
    id: "urgent",
    label: "Next 12 Hours",
    shortLabel: "Urgent",
    color: "#d95f5f",
    surface: "#fff0ef",
  },
  today: {
    id: "today",
    label: "Next 24 Hours",
    shortLabel: "Today",
    color: "#ef8f35",
    surface: "#fff4e9",
  },
  week: {
    id: "week",
    label: "This Week",
    shortLabel: "Week",
    color: "#d1a321",
    surface: "#fff9e8",
  },
  weekend: {
    id: "weekend",
    label: "Weekend",
    shortLabel: "Weekend",
    color: "#2f9b74",
    surface: "#edf9f2",
  },
  open: {
    id: "open",
    label: "Open",
    shortLabel: "Open",
    color: "#4a84d8",
    surface: "#edf4ff",
  },
  leisure: {
    id: "leisure",
    label: "Leisure",
    shortLabel: "Leisure",
    color: "#8b67d9",
    surface: "#f2edff",
  },
};

export const DEFAULT_CATEGORIES = [
  {
    id: "work",
    name: "Work",
    emoji: "\uD83D\uDCBC",
    color: "#ef8f35",
    system: true,
  },
  {
    id: "personal",
    name: "Personal",
    emoji: "\uD83C\uDFE0",
    color: "#2f9b74",
    system: true,
  },
  {
    id: "health",
    name: "Health",
    emoji: "\uD83D\uDCAA",
    color: "#d1a321",
    system: true,
  },
  {
    id: "events",
    name: "Events & Meetings",
    emoji: "\uD83D\uDCC5",
    color: "#d95f5f",
    system: true,
  },
];

export const CATEGORY_COLOR_CHOICES = [
  "#d95f5f",
  "#ef8f35",
  "#d1a321",
  "#2f9b74",
  "#4a84d8",
  "#8b67d9",
];

export const CATEGORY_EMOJI_CHOICES = [
  "\uD83D\uDCC1",
  "\uD83C\uDFAF",
  "\uD83D\uDCDA",
  "\uD83C\uDFA8",
  "\uD83C\uDFC3",
  "\uD83C\uDF73",
  "\u2708\uFE0F",
  "\uD83C\uDFB5",
  "\uD83D\uDED2",
  "\uD83E\uDDD8",
  "\uD83D\uDCA1",
  "\uD83D\uDD27",
];

export const SETTINGS_KEY = "daily_planner_settings_v3";
export const API_ENDPOINT = "/.netlify/functions/tasks";
