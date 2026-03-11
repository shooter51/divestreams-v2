import { useState } from "react";

export interface TankTypeOption {
  name: string;
  gasTypes: string[];
  rentalPrice: string;
  availableCount: number;
}

export interface TankGasSelectorProps {
  tankTypes: TankTypeOption[];
  participantIndex: number;
  required: boolean;
  defaultBringOwn?: boolean;
  defaultTanks?: { type: string; gasType: string; quantity: number }[];
}

const GAS_TYPE_LABELS: Record<string, string> = {
  air: "Air",
  nitrox32: "Nitrox 32%",
  nitrox36: "Nitrox 36%",
  trimix: "Trimix",
  oxygen: "Oxygen",
};

interface TankRow {
  type: string;
  gasType: string;
  quantity: number;
}

export function TankGasSelector({
  tankTypes,
  participantIndex,
  required,
  defaultBringOwn = false,
  defaultTanks,
}: TankGasSelectorProps) {
  const initialTanks: TankRow[] =
    defaultTanks && defaultTanks.length > 0
      ? defaultTanks.map((t) => ({ type: t.type, gasType: t.gasType, quantity: t.quantity }))
      : tankTypes.length > 0
      ? [{ type: tankTypes[0].name, gasType: tankTypes[0].gasTypes[0] ?? "air", quantity: 1 }]
      : [{ type: "", gasType: "air", quantity: 1 }];

  const [bringOwn, setBringOwn] = useState(defaultBringOwn);
  const [tanks, setTanks] = useState<TankRow[]>(initialTanks);

  function getGasTypesForTank(tankName: string): string[] {
    const found = tankTypes.find((t) => t.name === tankName);
    return found ? found.gasTypes : ["air"];
  }

  function updateTank(index: number, field: keyof TankRow, value: string | number) {
    setTanks((prev) => {
      const updated = [...prev];
      if (field === "quantity") {
        updated[index] = { ...updated[index], quantity: Number(value) };
      } else if (field === "type") {
        const newType = value as string;
        const gasTypes = getGasTypesForTank(newType);
        updated[index] = {
          ...updated[index],
          type: newType,
          gasType: gasTypes[0] ?? "air",
        };
      } else {
        updated[index] = { ...updated[index], [field]: value as string };
      }
      return updated;
    });
  }

  function addTank() {
    if (tanks.length >= 4) return;
    const firstType = tankTypes[0]?.name ?? "";
    const gasTypes = getGasTypesForTank(firstType);
    setTanks((prev) => [
      ...prev,
      { type: firstType, gasType: gasTypes[0] ?? "air", quantity: 1 },
    ]);
  }

  function removeTank(index: number) {
    setTanks((prev) => prev.filter((_, i) => i !== index));
  }

  const prefix = `participantTanks[${participantIndex}]`;

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name={`${prefix}.bringOwn`}
        value={bringOwn ? "true" : "false"}
      />
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={bringOwn}
          onChange={(e) => setBringOwn(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm">I'll bring my own tanks</span>
      </label>

      {!bringOwn && (
        <div className="space-y-2">
          {tanks.map((tank, j) => {
            const gasOptions = getGasTypesForTank(tank.type);
            return (
              <div key={j} className="flex gap-2 items-center">
                {/* Tank type */}
                <div className="flex-1">
                  <select
                    name={`${prefix}.tanks[${j}].type`}
                    value={tank.type}
                    onChange={(e) => updateTank(j, "type", e.target.value)}
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                  >
                    {tankTypes.length === 0 && (
                      <option value="">No tanks available</option>
                    )}
                    {tankTypes.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} (${t.rentalPrice})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gas mix */}
                <div className="flex-1">
                  <select
                    name={`${prefix}.tanks[${j}].gasType`}
                    value={tank.gasType}
                    onChange={(e) => updateTank(j, "gasType", e.target.value)}
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                  >
                    {gasOptions.map((g) => (
                      <option key={g} value={g}>
                        {GAS_TYPE_LABELS[g] ?? g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="w-20">
                  <input
                    type="number"
                    name={`${prefix}.tanks[${j}].quantity`}
                    value={tank.quantity}
                    min={1}
                    max={4}
                    onChange={(e) => updateTank(j, "quantity", e.target.value)}
                    className="w-full px-3 py-2 border border-border-strong rounded-lg bg-surface-raised text-foreground focus:ring-2 focus:ring-brand focus:border-brand text-sm"
                  />
                </div>

                {/* Remove button */}
                {(tanks.length > 1 || !required) && (
                  <button
                    type="button"
                    onClick={() => removeTank(j)}
                    className="text-danger hover:text-danger-hover text-sm px-2 py-2"
                    aria-label="Remove tank"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {tanks.length < 4 && (
            <button
              type="button"
              onClick={addTank}
              className="text-sm text-brand hover:underline"
            >
              + Add another tank
            </button>
          )}
        </div>
      )}
    </div>
  );
}
