import { db } from "./index.js";

const ROWS = "ABCDEFGHIJKL".split("");
const SLOTS = [1,2,3,4,5,6,7];
const FLOORS = [1,2,3];
const SIDES = ["L","R"]; // L=Izq, R=Der

export function makeLocationId(floor, side, row, slot) {
  const s2 = String(slot).padStart(2, "0");
  return `F${floor}-${side}-${row}${s2}`;
}

export async function seedLocationsIfEmpty() {
  const count = await db.locations.count();
  if (count > 0) return;

  let orderNo = 1;
  const locations = [];

  // FIFO por zona: piso -> lado -> fila -> slot
  for (const floor of FLOORS) {
    for (const side of SIDES) {
      for (const row of ROWS) {
        for (const slot of SLOTS) {
          locations.push({
            id: makeLocationId(floor, side, row, slot),
            floor,
            side,
            row,
            slot,
            orderNo: orderNo++,
            occupiedBy: null,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  await db.locations.bulkAdd(locations);
}
