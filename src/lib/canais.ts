export const CANAL_LABEL: Record<string, string> = {
  airbnb: "Airbnb",
  vrbo: "VRBO",
  proprio: "Site próprio",
  por_fora: "Por fora",
  outro: "Outro",
};

export const CANAIS_OPCOES = [
  { value: "airbnb", label: "Airbnb" },
  { value: "vrbo", label: "VRBO" },
  { value: "proprio", label: "Site próprio" },
  { value: "por_fora", label: "Por fora" },
  { value: "outro", label: "Outro" },
];

export const FONTE_TIPO_LABEL: Record<string, string> = {
  airbnb_ical: "Airbnb (iCal)",
  vrbo_ical: "VRBO (iCal)",
  lodgify_api: "Lodgify (API)",
  outro_ical: "Outro (iCal)",
};

export const FONTE_TIPOS_OPCOES = [
  { value: "airbnb_ical", label: "Airbnb (iCal)" },
  { value: "vrbo_ical", label: "VRBO (iCal)" },
  { value: "lodgify_api", label: "Lodgify (API)" },
  { value: "outro_ical", label: "Outro (iCal)" },
];

/** Canal da reserva a partir do tipo de fonte (para iCal). */
export function canalDeFonteIcal(tipo: string): string {
  if (tipo === "airbnb_ical") return "airbnb";
  if (tipo === "vrbo_ical") return "vrbo";
  return "outro";
}
