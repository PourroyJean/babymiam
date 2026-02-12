import { setExposureAction, setPreferenceAction } from "@/app/actions";
import { FoodMeta } from "@/components/food-meta";

type FoodRowProps = {
  foodId: number;
  name: string;
  exposureCount: number;
  preference: -1 | 0 | 1;
  firstTastedOn: string | null;
  note: string;
};

export function FoodRow({
  foodId,
  name,
  exposureCount,
  preference,
  firstTastedOn,
  note
}: FoodRowProps) {
  return (
    <li className="food-row">
      <span className="food-name">{name}</span>

      <form action={setExposureAction} className="dot-form">
        <input type="hidden" name="foodId" value={foodId} />
        <input type="hidden" name="current" value={exposureCount} />
        {[1, 2, 3].map((value) => (
          <button
            key={value}
            type="submit"
            name="value"
            value={value}
            className={`dot ${exposureCount >= value ? "active" : ""}`}
            aria-label={`${name} - rond ${value}`}
          />
        ))}
      </form>

      <div className="preference-group">
        <form action={setPreferenceAction} className="preference-form">
          <input type="hidden" name="foodId" value={foodId} />
          <input type="hidden" name="current" value={preference} />
          <input type="hidden" name="value" value="1" />
          <button
            type="submit"
            className={`pref-btn pref-plus ${preference === 1 ? "active" : ""}`}
            aria-label={`${name} aimé`}
            aria-pressed={preference === 1}
            title="Bébé a aimé"
          >
            🙂
          </button>
        </form>

        <form action={setPreferenceAction} className="preference-form">
          <input type="hidden" name="foodId" value={foodId} />
          <input type="hidden" name="current" value={preference} />
          <input type="hidden" name="value" value="-1" />
          <button
            type="submit"
            className={`pref-btn pref-minus ${preference === -1 ? "active" : ""}`}
            aria-label={`${name} non aimé`}
            aria-pressed={preference === -1}
            title="Bébé n'a pas aimé"
          >
            🙁
          </button>
        </form>
      </div>

      <FoodMeta foodId={foodId} firstTastedOn={firstTastedOn} note={note} />
    </li>
  );
}
