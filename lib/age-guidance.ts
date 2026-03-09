import type { ChildProfile } from "@/lib/types";
import { getTodayIsoDate } from "@/lib/ui-utils";

const AGE_GUIDANCE_STAGE_KEYS = [
  "before_start",
  "month_5",
  "months_6_8",
  "months_9_11",
  "months_12_18",
  "months_18_36"
] as const;

const AGE_GUIDANCE_PRIORITY_TONES = ["action", "progress", "attention"] as const;
const AGE_GUIDANCE_DEFAULT_STAGE_KEY: AgeGuidanceStageKey = "month_5";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type AgeGuidanceStageKey = (typeof AGE_GUIDANCE_STAGE_KEYS)[number];
export type AgeGuidancePriorityTone = (typeof AGE_GUIDANCE_PRIORITY_TONES)[number];

export type AgeGuidancePriority = {
  id: string;
  badge: string;
  title: string;
  detail: string;
  tone: AgeGuidancePriorityTone;
};

export type AgeGuidanceAsideCard = {
  id: string;
  badge: string;
  title: string;
  detail: string;
  bullets?: string[];
  tone: AgeGuidancePriorityTone;
};

export type AgeGuidanceStage = {
  key: AgeGuidanceStageKey;
  tabLabel: string;
  stageLabel: string;
  summary: string;
  textureLabel: string | null;
  priorities: AgeGuidancePriority[];
  reminders: string[];
  asideKicker?: string;
  asideTitle?: string;
  asideCards?: AgeGuidanceAsideCard[];
};

export type AgeGuidanceSnapshot = {
  title: string;
  subtitle: string;
  currentStageKey: AgeGuidanceStageKey | null;
  defaultStageKey: AgeGuidanceStageKey;
  stages: AgeGuidanceStage[];
  footer: string;
  isAutoPositioned: boolean;
};

const AGE_GUIDANCE_REFERENCE: { footer: string; stages: AgeGuidanceStage[] } = {
  footer: "",
  stages: [
    {
      key: "before_start",
      tabLabel: "Avant 5 m",
      stageLabel: "Avant démarrage",
      summary: "",
      textureLabel: null,
      priorities: [],
      reminders: [],
      asideCards: []
    },
    {
      key: "month_5",
      tabLabel: "5 mois",
      stageLabel: "5 mois",
      summary:
        "Certains bébés commencent à montrer de l'intérêt pour les aliments solides. Le lait maternel ou infantile reste l'essentiel de l'alimentation, mais de petites découvertes à la cuillère peuvent commencer si bébé semble prêt.",
      textureLabel: "Texture conseillée: purée lisse",
      priorities: [
        {
          id: "month-5-readiness-signs",
          badge: "Observation",
          title: "Signes que bébé pourrait être prêt",
          detail:
            "Tête tenue de façon stable, regard attiré par la nourriture, bouche qui s'ouvre quand la cuillère approche, purée avalée sans être repoussée avec la langue. Si ces signes ne sont pas présents, il est tout à fait normal d'attendre encore quelques semaines.",
          tone: "attention"
        },
        {
          id: "month-5-first-tastes",
          badge: "Comment commencer",
          title: "Démarrer très simplement",
          detail:
            "Propose une ou deux cuillères de purée lisse quand bébé est calme et disponible. Laisse-le découvrir sans forcer, avec un aliment simple à la fois, bien mixé: carotte, courgette, patate douce, poire ou pomme cuite.",
          tone: "action"
        },
        {
          id: "month-5-keep-in-mind",
          badge: "À garder en tête",
          title: "Rester souple et progressif",
          detail:
            "Les quantités peuvent être très petites au début, c'est normal. Le but est d'abord la découverte, pas de remplacer un repas, et chaque bébé avance à son propre rythme.",
          tone: "progress"
        }
      ],
      reminders: [],
      asideKicker: "Côté cuisine",
      asideTitle: "Préparation",
      asideCards: [
        {
          id: "month-5-vegetable-prep",
          badge: "Légumes",
          title: "Préparer une première purée très simple",
          detail:
            "Purée lisse, cuisson vapeur ou à l'eau, sans sel. Ajouter 1 à 2 c. à café d'huile végétale pour 100 g de purée, ou un peu de beurre ou de crème fraîche. Commencer sur un seul repas par jour, quelques cuillères avant la tétée ou le biberon, puis augmenter progressivement jusqu'à 130 g.",
          tone: "progress"
        },
        {
          id: "month-5-fruit-prep",
          badge: "Fruits",
          title: "Introduire les fruits après quinze jours environ",
          detail:
            "Quand les légumes sont bien acceptés, proposer une purée lisse de pomme, puis associer d'autres fruits. Rester sur un repas par jour, quelques cuillères avant la tétée ou le biberon, avec une progression jusqu'à 130 g. À mesure que les purées augmentent, les biberons ou tétées peuvent diminuer progressivement, autour de 120 à 150 ml.",
          tone: "action"
        }
      ]
    },
    {
      key: "months_6_8",
      tabLabel: "6-8 mois",
      stageLabel: "6-8 mois",
      summary:
        "Bébé s'habitue aux premières purées. Cette période ouvre souvent une diversification plus progressive: nouveaux aliments, textures un peu plus variées et repas qui commencent à se structurer doucement. Le lait reste encore une base importante de son alimentation.",
      textureLabel:
        "Texture: purées moins lisses, plus épaisses, légèrement granuleuses. Premiers morceaux fondants si bébé tient assis avec maintien.",
      priorities: [
        {
          id: "months-6-8-meal-evolution",
          badge: "Comment évoluer",
          title: "Faire grandir les repas sans brusquer",
          detail:
            "Proposer plus de légumes et de fruits, introduire de petites quantités de protéines bien mixées, garder des textures lisses ou légèrement épaissies, et installer peu à peu un rythme de repas régulier dans la journée.",
          tone: "action"
        },
        {
          id: "months-6-8-observation",
          badge: "Repères utiles",
          title: "Observer avant d'accélérer",
          detail:
            "Certains aliments peuvent être refusés plusieurs fois avant d'être acceptés. Les repas restent aussi des moments d'apprentissage et de découverte: regarde surtout l'intérêt de bébé pour les aliments et sa capacité à avaler des textures un peu plus épaisses.",
          tone: "attention"
        },
        {
          id: "months-6-8-rhythm",
          badge: "À garder en tête",
          title: "Avancer avec régularité",
          detail:
            "L'idée n'est pas d'aller vite, mais d'élargir progressivement ce que bébé connaît déjà. Une progression douce, répétée et régulière aide souvent mieux qu'un grand changement d'un coup.",
          tone: "progress"
        }
      ],
      reminders: [],
      asideKicker: "Côté cuisine",
      asideTitle: "Préparation",
      asideCards: [
        {
          id: "months-6-8-fats-and-cereals",
          badge: "Légumes, fruits et céréales",
          title: "Élargir les bases du quotidien",
          detail:
            "Les bases du quotidien s'élargissent et les repas deviennent un peu plus complets.",
          bullets: [
            "Tous les légumes et fruits peuvent désormais entrer dans les repas.",
            "Ajouter systématiquement 1 cuillère à café d'huile végétale avec les légumes.",
            "Introduire les céréales infantiles ou des féculents mixés (riz, pomme de terre). Les céréales peuvent aussi aller dans le biberon du soir.",
            "Une biscotte sans sucre ajouté peut être écrasée dans la compote."
          ],
          tone: "progress"
        },
        {
          id: "months-6-8-proteins",
          badge: "Protéines",
          title: "Introduire de très petites portions bien mixées",
          detail:
            "Les protéines arrivent en petite quantité, une seule fois par jour. La viande et le poisson apportent du fer utile à cet âge.",
          bullets: [
            "Viande, poisson ou oeuf dur peuvent être proposés bien mixés, dans la purée de légumes.",
            "Toutes les viandes conviennent, y compris le jambon cuit sans gras ni couenne, il vaut mieux limiter les abats et la charcuterie.",
            "Tous les poissons conviennent, gras ou maigres, frais ou surgelés (hors poissons panés).",
            "Chaque semaine donner : 2 fois du poisson, 2 fois de la viande et 1 fois de l'oeuf.",
            "Ne pas dépasser 10 g de viande ou de poisson, soit environ 2 cuillères à café, ou 1/4 d'oeuf dur par jour."
          ],
          tone: "action"
        }
      ]
    },
    {
      key: "months_9_11",
      tabLabel: "9-11 mois",
      stageLabel: "9-11 mois",
      summary: "",
      textureLabel: null,
      priorities: [],
      reminders: [],
      asideCards: []
    },
    {
      key: "months_12_18",
      tabLabel: "12-18 mois",
      stageLabel: "12-18 mois",
      summary: "",
      textureLabel: null,
      priorities: [],
      reminders: [],
      asideCards: []
    },
    {
      key: "months_18_36",
      tabLabel: "18-36 mois",
      stageLabel: "18-36 mois",
      summary: "",
      textureLabel: null,
      priorities: [],
      reminders: [],
      asideCards: []
    }
  ]
};

function isValidIsoDate(value: string | null | undefined) {
  if (!value || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function getAgeInMonths(birthDate: string | null, nowIsoDate: string) {
  if (typeof birthDate !== "string" || !isValidIsoDate(birthDate) || !isValidIsoDate(nowIsoDate)) return null;

  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [nowYear, nowMonth, nowDay] = nowIsoDate.split("-").map(Number);
  if ([birthYear, birthMonth, birthDay, nowYear, nowMonth, nowDay].some((part) => !Number.isFinite(part))) {
    return null;
  }

  let months = (nowYear - birthYear) * 12 + (nowMonth - birthMonth);
  if (nowDay < birthDay) {
    months -= 1;
  }

  return months < 0 ? null : months;
}

function getStageKey(ageInMonths: number): AgeGuidanceStageKey {
  if (ageInMonths < 5) return "before_start";
  if (ageInMonths < 6) return "month_5";
  if (ageInMonths < 9) return "months_6_8";
  if (ageInMonths < 12) return "months_9_11";
  if (ageInMonths < 18) return "months_12_18";
  return "months_18_36";
}

function formatAgeLabel(ageInMonths: number) {
  return `${ageInMonths} mois`;
}

export async function buildAgeGuidanceSnapshot(params: {
  childProfile: ChildProfile | null;
  currentIsoDate?: string;
}): Promise<AgeGuidanceSnapshot> {
  const currentIsoDate =
    typeof params.currentIsoDate === "string" && isValidIsoDate(params.currentIsoDate)
      ? params.currentIsoDate
      : getTodayIsoDate();
  const stages = AGE_GUIDANCE_REFERENCE.stages;
  const ageInMonths = getAgeInMonths(params.childProfile?.birthDate || null, currentIsoDate);
  const currentStageKey = ageInMonths === null ? null : getStageKey(ageInMonths);
  const defaultStageKey = currentStageKey ?? AGE_GUIDANCE_DEFAULT_STAGE_KEY;
  const childName = params.childProfile?.firstName?.trim() || "Bébé";
  const currentStage = currentStageKey ? stages.find((stage) => stage.key === currentStageKey) ?? null : null;

  return {
    title:
      ageInMonths === null
        ? "Guide diversification par âge"
        : `${childName} a ${formatAgeLabel(ageInMonths)} aujourd'hui`,
    subtitle:
      currentStage && ageInMonths !== null
        ? `Bloc du moment: ${currentStage.tabLabel}`
        : "Ajoute la date de naissance pour mettre automatiquement le bon bloc en avant.",
    currentStageKey,
    defaultStageKey,
    stages,
    footer: AGE_GUIDANCE_REFERENCE.footer,
    isAutoPositioned: currentStageKey !== null
  };
}
