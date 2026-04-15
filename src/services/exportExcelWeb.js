import * as XLSX from "xlsx";
import { db } from "../db/index.js";

function buildSummary(locations) {
  const total = locations.length;
  const occupied = locations.filter((l) => !!l.occupiedBy).length;
  const free = total - occupied;

  const byZone = {};
  for (const l of locations) {
    const key = `F${l.floor}-${l.side}`;
    byZone[key] ||= { zone: key, total: 0, occupied: 0, free: 0 };
    byZone[key].total += 1;
    if (l.occupiedBy) byZone[key].occupied += 1;
  }
  Object.values(byZone).forEach((z) => (z.free = z.total - z.occupied));

  return [
    { metric: "generatedAt", value: new Date().toISOString() },
    { metric: "totalLocations", value: total },
    { metric: "occupiedLocations", value: occupied },
    { metric: "freeLocations", value: free },
    ...Object.values(byZone).map((z) => ({
      metric: z.zone,
      value: `total=${z.total} occupied=${z.occupied} free=${z.free}`,
    })),
  ];
}

export async function exportXlsxWeb() {
  const [pallets, locations, movements, plans, qcSessions, qcSamples] = await Promise.all([
    db.pallets.toArray(),
    db.locations.toArray(),
    db.movements.toArray(),
    db.plans ? db.plans.toArray() : Promise.resolve([]),
    db.qcSessions ? db.qcSessions.toArray() : Promise.resolve([]),
    db.qcSamples ? db.qcSamples.toArray() : Promise.resolve([]),
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSummary(locations)), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pallets), "Pallets");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(locations), "Locations");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movements), "Movements");
  if (plans?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plans), "Plans");
  }
  if (qcSessions?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qcSessions), "QC_Sessions");
  }
  if (qcSamples?.length) {
    // Flatten leve: arrays a string para Excel
    const flat = qcSamples.map((s) => ({
      ...s,
      sampleWindowLabels: Array.isArray(s.sampleWindowLabels) ? s.sampleWindowLabels.join(" | ") : s.sampleWindowLabels,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat), "QC_Samples");
  }

  const filename = `coldroom_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
