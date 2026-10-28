import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASE_PATH,
  stateFromLocation,
  stateFromSearch,
  stateToLocation,
  stateToUrl
} from "./url-state";
import { DEFAULT_STATE, explorerReducer, sanitizeState } from "./filters";

describe("url-state path-based SEO routing (Option A)", () => {
  it("defaults to overview when loading base path without params", () => {
    const state = stateFromLocation(DEFAULT_BASE_PATH, "");
    expect(state.tab).toBe("overview");
    expect(state.profile).toBeNull();
    expect(state.grant).toBeNull();
  });

  it("parses tab paths correctly", () => {
    expect(stateFromLocation(`${DEFAULT_BASE_PATH}/grants`, "").tab).toBe("table");
    expect(stateFromLocation(`${DEFAULT_BASE_PATH}/analytics`, "").tab).toBe("charts");
    expect(stateFromLocation(`${DEFAULT_BASE_PATH}/map`, "").tab).toBe("map");
    expect(stateFromLocation(`${DEFAULT_BASE_PATH}/compare`, "").tab).toBe("compare");
    expect(stateFromLocation(`${DEFAULT_BASE_PATH}/about`, "").tab).toBe("about");
  });

  it("parses grant deep detail path /grants/:uid", () => {
    const state = stateFromLocation(`${DEFAULT_BASE_PATH}/grants/0ab12cd34ef`, "");
    expect(state.tab).toBe("table");
    expect(state.grant).toBe("0ab12cd34ef");
    expect(state.profile).toBeNull();
  });

  it("parses recipient profile path /recipients/:id", () => {
    const state = stateFromLocation(`${DEFAULT_BASE_PATH}/recipients/national-theatre`, "");
    expect(state.profile).toEqual({ kind: "recipient", id: "national-theatre" });
    expect(state.grant).toBeNull();
  });

  it("parses place profile path /places/:id with URL decoding", () => {
    const state = stateFromLocation(`${DEFAULT_BASE_PATH}/places/Manchester`, "");
    expect(state.profile).toEqual({ kind: "place", id: "Manchester" });
  });

  it("parses discipline profile path /disciplines/:id", () => {
    const state = stateFromLocation(`${DEFAULT_BASE_PATH}/disciplines/Visual%20arts`, "");
    expect(state.profile).toEqual({ kind: "discipline", id: "Visual arts" });
  });

  it("parses nested grant under profile /recipients/:id/grants/:uid", () => {
    const state = stateFromLocation(
      `${DEFAULT_BASE_PATH}/recipients/royal-opera-house/grants/fedcba98765`,
      ""
    );
    expect(state.profile).toEqual({ kind: "recipient", id: "royal-opera-house" });
    expect(state.grant).toBe("fedcba98765");
  });

  it("preserves query filter parameters on top of path routes", () => {
    const state = stateFromLocation(
      `${DEFAULT_BASE_PATH}/grants`,
      "?q=orchestra&year=2024-2025&sort=amount&order=asc"
    );
    expect(state.tab).toBe("table");
    expect(state.q).toBe("orchestra");
    expect(state.years).toEqual(["2024-2025"]);
    expect(state.sortField).toBe("award_amount");
    expect(state.sortOrder).toBe("asc");
  });

  it("supports backward compatibility for legacy query string links", () => {
    const legacyState = stateFromSearch("?view=analytics&grant=0ab12cd34ef&profile=recipient:sadlers-wells");
    expect(legacyState.tab).toBe("charts");
    expect(legacyState.grant).toBe("0ab12cd34ef");
    expect(legacyState.profile).toEqual({ kind: "recipient", id: "sadlers-wells" });
  });

  it("serializes tab state to clean pathname without query params", () => {
    const loc = stateToLocation({ ...DEFAULT_STATE, tab: "charts" });
    expect(loc.pathname).toBe(`${DEFAULT_BASE_PATH}/analytics`);
    expect(loc.search).toBe("");
  });

  it("serializes recipient profile to /recipients/:slug (e.g. battersea arts centre -> battersea-arts-centre)", () => {
    const loc = stateToLocation({
      ...DEFAULT_STATE,
      profile: { kind: "recipient", id: "battersea arts centre" }
    });
    expect(loc.pathname).toBe(`${DEFAULT_BASE_PATH}/recipients/battersea-arts-centre`);
    expect(loc.search).toBe("");
  });

  it("serializes place profile to /places/:slug (e.g. City of London -> city-of-london)", () => {
    const loc = stateToLocation({
      ...DEFAULT_STATE,
      profile: { kind: "place", id: "City of London" }
    });
    expect(loc.pathname).toBe(`${DEFAULT_BASE_PATH}/places/city-of-london`);
    expect(loc.search).toBe("");
  });

  it("serializes discipline profile to /disciplines/:slug (e.g. Visual arts -> visual-arts)", () => {
    const loc = stateToLocation({
      ...DEFAULT_STATE,
      profile: { kind: "discipline", id: "Visual arts" }
    });
    expect(loc.pathname).toBe(`${DEFAULT_BASE_PATH}/disciplines/visual-arts`);
    expect(loc.search).toBe("");
  });

  it("serializes filters into clean query string while keeping path clean", () => {
    const url = stateToUrl({
      ...DEFAULT_STATE,
      tab: "table",
      q: "theatre",
      years: ["2023-2024", "2024-2025"]
    });
    expect(url).toBe(
      `${DEFAULT_BASE_PATH}/grants?q=theatre&year=2023-2024&year=2024-2025`
    );
  });
});

describe("profile navigation & sanitizeState stability", () => {
  it("clears profile and grant when setTab is dispatched from a profile view", () => {
    const profileState = {
      ...DEFAULT_STATE,
      tab: "overview" as const,
      profile: { kind: "recipient" as const, id: "bradford-culture-company-ltd" },
      grant: "test-grant-1"
    };

    const nextState = explorerReducer(profileState, { type: "setTab", tab: "charts" });
    expect(nextState.tab).toBe("charts");
    expect(nextState.profile).toBeNull();
    expect(nextState.grant).toBeNull();

    const loc = stateToLocation(nextState);
    expect(loc.pathname).toBe(`${DEFAULT_BASE_PATH}/analytics`);
  });

  it("clears profile when closeProfile is dispatched", () => {
    const profileState = {
      ...DEFAULT_STATE,
      profile: { kind: "recipient" as const, id: "bradford-culture-company-ltd" }
    };

    const nextState = explorerReducer(profileState, { type: "closeProfile" });
    expect(nextState.profile).toBeNull();

    const loc = stateToLocation(nextState);
    expect(loc.pathname).toBe(DEFAULT_BASE_PATH);
  });

  it("sanitizeState returns the exact same state reference when profile is already canonical", () => {
    const emptyOptions = {
      years: [],
      areas: [],
      localAuthorities: [],
      disciplines: [],
      strands: [],
      priorities: [],
      placeGroups: [],
      deprivation: []
    };

    const state = {
      ...DEFAULT_STATE,
      profile: { kind: "recipient" as const, id: "bradford culture company ltd" }
    };

    const clean = sanitizeState(state, emptyOptions, {
      resolveProfile: () => "bradford culture company ltd"
    });

    // Reference equality is critical to avoid infinite re-render loops in useEffect
    expect(clean).toBe(state);
  });
});
