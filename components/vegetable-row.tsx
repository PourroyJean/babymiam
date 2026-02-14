import Image from "next/image";
import { markFirstTasteAction, setExposureAction } from "@/app/actions";
import { FoodMeta } from "@/components/food-meta";

type PreferenceValue = -1 | 0 | 1;
type AllergenStage = 0 | 1 | 2 | 3;

type VegetableRowProps = {
  foodId: number;
  name: string;
  exposureCount: number;
  preference: PreferenceValue;
  firstTastedOn: string | null;
  note: string;
  onCyclePreference: (foodId: number) => void;
  isPreferenceSaving?: boolean;
  isAllergen?: boolean;
  allergenStage?: AllergenStage | null;
};

const ACTION_BUTTON_BASE_CLASS =
  "touch-manipulation appearance-none [-webkit-appearance:none] inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#4c4136] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7a3d] focus-visible:ring-offset-2 active:scale-[0.98]";

const ACTION_VISUAL_BASE_CLASS =
  "pointer-events-none inline-flex h-9 w-9 items-center justify-center rounded-full border-2 bg-[#fcfbf9] text-[#4c4136]";

const SMILEY_VISUAL_BASE_CLASS =
  "pointer-events-none inline-flex h-9 w-9 items-center justify-center border-2 p-0";

function getNextPreference(current: PreferenceValue): PreferenceValue {
  if (current === 0) return 1;
  if (current === 1) return -1;
  return 0;
}

function getPreferenceLabel(preference: PreferenceValue) {
  if (preference === 1) return "aimé";
  if (preference === -1) return "pas aimé";
  return "neutre";
}

function getPreferenceImageSrc(preference: PreferenceValue) {
  if (preference === 1) return "/smiley_ok.png";
  if (preference === -1) return "/smiley_ko.png";
  return "/smiley_neutre.png";
}

function getPreferenceVisualClass(preference: PreferenceValue) {
  if (preference === 1) return "border-emerald-500";
  if (preference === -1) return "border-rose-500";
  return "border-[#b9ac9b]";
}

function getAllergenStageLabel(stage: AllergenStage | null | undefined) {
  if (stage === 3) return "Tigre 3/3";
  if (stage === 2) return "Étape 2/3";
  if (stage === 1) return "Étape 1/3";
  return "À tester";
}

function getAllergenStageClass(stage: AllergenStage | null | undefined) {
  if (stage === 3) return "done";
  if (stage === 2) return "step2";
  if (stage === 1) return "step1";
  return "todo";
}

export function VegetableRow({
  foodId,
  name,
  exposureCount,
  preference,
  firstTastedOn,
  note,
  onCyclePreference,
  isPreferenceSaving = false,
  isAllergen = false,
  allergenStage = null
}: VegetableRowProps) {
  const currentPreferenceLabel = getPreferenceLabel(preference);
  const nextPreference = getNextPreference(preference);
  const nextPreferenceLabel = getPreferenceLabel(nextPreference);
  const hasExposure = exposureCount > 0;
  const allergenStageLabel = getAllergenStageLabel(allergenStage);

  return (
    <li className="w-full rounded-2xl bg-white/75 px-2.5 py-2 sm:px-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 text-[0.98rem] font-semibold leading-tight text-[#3b3128]">
            {name}
          </span>

          {isAllergen ? (
            <span
              className={`allergen-stage-pill ${getAllergenStageClass(allergenStage)}`}
              aria-label={`Statut allergène: ${allergenStageLabel}`}
              title={`Statut allergène: ${allergenStageLabel}`}
            >
              {allergenStageLabel}
            </span>
          ) : null}
        </div>

        <div
          role="group"
          aria-label={`Actions pour ${name}`}
          className="flex flex-wrap items-center justify-start gap-1 sm:justify-end sm:gap-1.5"
        >
          {hasExposure ? (
            <div role="group" aria-label={`Niveau d'exposition pour ${name}`} className="flex items-center gap-1 sm:gap-1.5">
              {[1, 2, 3].map((value) => {
                const isActive = exposureCount >= value;
                const isSelected = exposureCount === value;

                return (
                  <form key={value} action={setExposureAction} className="inline-flex">
                    <input type="hidden" name="foodId" value={foodId} />
                    <button
                      type="submit"
                      name="value"
                      value={value}
                      className={ACTION_BUTTON_BASE_CLASS}
                      aria-label={`${name} - régler la jauge à ${value} sur 3`}
                      aria-pressed={isSelected}
                      title={`Jauge ${value}/3`}
                    >
                      <span
                        aria-hidden="true"
                        className={`${ACTION_VISUAL_BASE_CLASS} text-xs font-extrabold leading-none ${isActive ? "text-white" : "border-[#b9ac9b] text-[#7a6f62]"
                          }`}
                        style={isActive ? { borderColor: "var(--tone-dot-border)", backgroundColor: "var(--tone-dot)" } : undefined}
                      >
                        {value}
                      </span>
                    </button>
                  </form>
                );
              })}
            </div>
          ) : null}

          {!hasExposure ? (
            <div className="flex w-[140px] items-center sm:w-[144px]">
              <form action={markFirstTasteAction} className="inline-flex w-full">
                <input type="hidden" name="foodId" value={foodId} />
                <button
                  type="submit"
                  className={`${ACTION_BUTTON_BASE_CLASS} h-11 w-full min-w-0 rounded-full px-0 py-0`}
                  aria-label={`Marquer ${name} en première bouchée`}
                  title="Première bouchée (jauge 1/3)"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none inline-flex h-9 w-full items-center justify-center rounded-full border-2 border-[#d8a755] bg-[#ffefcb] px-2.5 py-1 text-[0.68rem] font-extrabold leading-none text-[#714f17] whitespace-nowrap"
                  >
                    Première bouchée
                  </span>
                </button>
              </form>
            </div>
          ) : null}

          <button
            type="button"
            className={ACTION_BUTTON_BASE_CLASS}
            onClick={() => onCyclePreference(foodId)}
            aria-pressed={preference !== 0}
            aria-label={`Préférence actuelle pour ${name}: ${currentPreferenceLabel}. Appuyer pour passer à ${nextPreferenceLabel}.`}
            title={`Préférence: ${currentPreferenceLabel} (prochain état: ${nextPreferenceLabel})`}
          >
            <span
              aria-hidden="true"
              className={`${SMILEY_VISUAL_BASE_CLASS} ${getPreferenceVisualClass(preference)} ${isPreferenceSaving ? "opacity-80" : ""
                }`}
            >
              <Image
                src={getPreferenceImageSrc(preference)}
                alt=""
                aria-hidden="true"
                width={36}
                height={36}
                unoptimized
                className="h-full w-full object-contain"
              />
            </span>
          </button>

          <FoodMeta foodId={foodId} foodName={name} firstTastedOn={firstTastedOn} note={note} />
        </div>
      </div>
    </li>
  );
}
