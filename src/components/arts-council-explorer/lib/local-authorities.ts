import { foldText } from "./text";

// Local authorities abolished, merged or renamed since April 2018, mapped to
// their successors. Lets grants be compared on current boundaries: a 2019
// grant in "Harrogate" counts towards "North Yorkshire".
//
// Successors are chained, so "Taunton Deane" resolves to "Somerset West and
// Taunton" (2019) and then to "Somerset" (2023).
const SUCCESSORS: Record<string, string> = {
  // 2018: renamed
  Shepway: "Folkestone and Hythe",
  // 2019: Dorset
  Bournemouth: "Bournemouth, Christchurch and Poole",
  Christchurch: "Bournemouth, Christchurch and Poole",
  Poole: "Bournemouth, Christchurch and Poole",
  "East Dorset": "Dorset",
  "North Dorset": "Dorset",
  Purbeck: "Dorset",
  "West Dorset": "Dorset",
  "Weymouth and Portland": "Dorset",
  // 2019: Suffolk
  "Forest Heath": "West Suffolk",
  "St Edmundsbury": "West Suffolk",
  "Suffolk Coastal": "East Suffolk",
  Waveney: "East Suffolk",
  // 2019: Somerset districts merged (then abolished in 2023)
  "Taunton Deane": "Somerset West and Taunton",
  "West Somerset": "Somerset West and Taunton",
  // 2020: Buckinghamshire
  "Aylesbury Vale": "Buckinghamshire",
  Chiltern: "Buckinghamshire",
  "South Bucks": "Buckinghamshire",
  Wycombe: "Buckinghamshire",
  // 2021: Northamptonshire
  Corby: "North Northamptonshire",
  "East Northamptonshire": "North Northamptonshire",
  Kettering: "North Northamptonshire",
  Wellingborough: "North Northamptonshire",
  Daventry: "West Northamptonshire",
  Northampton: "West Northamptonshire",
  "South Northamptonshire": "West Northamptonshire",
  // 2023: Cumbria
  Allerdale: "Cumberland",
  Carlisle: "Cumberland",
  Copeland: "Cumberland",
  "Barrow-in-Furness": "Westmorland and Furness",
  Eden: "Westmorland and Furness",
  "South Lakeland": "Westmorland and Furness",
  // 2023: North Yorkshire
  Craven: "North Yorkshire",
  Hambleton: "North Yorkshire",
  Harrogate: "North Yorkshire",
  Richmondshire: "North Yorkshire",
  Ryedale: "North Yorkshire",
  Scarborough: "North Yorkshire",
  Selby: "North Yorkshire",
  // 2023: Somerset
  Mendip: "Somerset",
  Sedgemoor: "Somerset",
  "South Somerset": "Somerset",
  "Somerset West and Taunton": "Somerset"
};

/**
 * Matching key for local authority names. Treats as equal: "Bristol, City
 * of" / "City of Bristol" / "Bristol City Council", "St. Helens" /
 * "St Helens", "Newcastle-upon-Tyne" / "Newcastle upon Tyne".
 */
export const localAuthorityKey = (name: string): string =>
  foldText(name)
    .replace(/&/g, " and ")
    .replace(/,\s*(?:city|county) of$/, "")
    .replace(/^(?:city|county|royal borough|london borough|metropolitan borough|borough) of\s+/, "")
    .replace(/\s+(?:metropolitan borough|borough|district|city|county)?\s*council$/, "")
    .replace(/['\u2019.]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const SUCCESSOR_INDEX = new Map(
  Object.entries(SUCCESSORS).map(([from, to]) => [localAuthorityKey(from), to])
);

/** The authority that covers this area today. Returns the input if it's still current. */
export const currentLocalAuthority = (name: string): string => {
  let current = name;
  for (let step = 0; step < 4; step += 1) {
    const next = SUCCESSOR_INDEX.get(localAuthorityKey(current));
    if (!next || next === current) break;
    current = next;
  }
  return current;
};
