import { useEffect, useRef } from "react";
import type { ProfileKind } from "../../lib/filters";
import type { ProfileContext } from "./context";
import { DisciplineProfile } from "./DisciplineProfile";
import { PlaceProfile } from "./PlaceProfile";
import { RecipientProfile } from "./RecipientProfile";

/** A profile page. Focus moves to its heading so screen readers announce the change of page. */
export const ProfileView = ({ kind, id, ctx }: { kind: ProfileKind; id: string; ctx: ProfileContext }) => {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const heading = root.current?.querySelector<HTMLElement>("#ace-profile-title");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [kind, id]);
  return (
    <div ref={root}>
      {kind === "recipient" && <RecipientProfile id={id} ctx={ctx} />}
      {kind === "place" && <PlaceProfile id={id} ctx={ctx} />}
      {kind === "discipline" && <DisciplineProfile id={id} ctx={ctx} />}
    </div>
  );
};
