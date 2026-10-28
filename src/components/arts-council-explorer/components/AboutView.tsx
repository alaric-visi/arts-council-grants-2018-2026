import { useState } from "react";
import type { ReactNode } from "react";
import { formatFY, isFYInProgress } from "../lib/fiscal";
import { formatAmount, formatISODate } from "../lib/format";
import type { DatasetMeta } from "../lib/types";
import { FOCUS_RING } from "./ui";

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="p-5 sm:p-6 bg-white/[0.02] backdrop-blur-md border border-white/10 rounded-xl">
    <h3 className="text-sm font-semibold tracking-wide uppercase text-white/85 font-mono mb-3">{title}</h3>
    <div className="space-y-3 text-white/70 text-sm leading-relaxed max-w-[75ch] font-light">{children}</div>
  </section>
);

const Term = ({ term, children }: { term: string; children: ReactNode }) => (
  <div>
    <dt className="font-medium text-white">{term}</dt>
    <dd className="text-white/80 mt-0.5">{children}</dd>
  </div>
);

/** Methodology: sources, cleaning, definitions, limitations, and how to cite. */
export const AboutView = ({ meta, citationName }: { meta: DatasetMeta | null; citationName: string }) => {
  const [copied, setCopied] = useState(false);
  const years = meta?.funding_years ?? [];
  const first = years[0]?.funding_year;
  const last = years[years.length - 1]?.funding_year;
  const inProgress = last ? isFYInProgress(last) : false;
  const built = meta ? formatISODate(meta.generated_at.slice(0, 10)) : null;
  const pop = meta?.populations;
  const url = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`;
  const citation = `${citationName}. National Lottery Project Grants awarded by Arts Council England${first && last ? `, ${formatFY(first)} to ${formatFY(last)}` : ""}. Data built ${built ?? "(date unknown)"}. ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="about">
      <Section title="What this covers">
        <p>
          Grants from Arts Council England’s National Lottery Project Grants programme, as published by ACE in its lists of awards
          {first && last ? `, from ${formatFY(first)} to ${formatFY(last)}` : ""}.
          {meta && ` ${meta.row_count.toLocaleString("en-GB")} grants worth ${formatAmount(meta.total_awarded)} in total.`}
          {built && ` This copy of the data was built on ${built}`}
          {meta?.latest_award_date && `, with awards up to ${formatISODate(meta.latest_award_date)}`}.
        </p>
        {inProgress && last && (
          <p>{formatFY(last)} is still in progress, so its figures will grow as ACE publishes more awards.</p>
        )}
        <p>It doesn’t include other ACE funding, such as National Portfolio Organisations or Develop Your Creative Practice.</p>
        {meta && meta.source_files.length > 0 && (
          <details className="text-sm">
            <summary className={`cursor-pointer text-white/80 hover:text-white rounded ${FOCUS_RING}`}>
              Source files ({meta.source_files.length})
            </summary>
            <ul className="mt-2 space-y-1 font-mono text-xs text-white/75">
              {meta.source_files.map((f) => (
                <li key={f.name}>
                  {f.name}: {f.rows.toLocaleString("en-GB")} grants
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      <Section title="How the data is cleaned">
        <ul className="list-disc pl-5 space-y-2">
          <li>Spellings of disciplines and strands are made consistent between years. Different strands are never merged: “£15,000 and below” (earlier rounds) and “£30,000 and below” (later rounds) stay separate.</li>
          <li>Recipients are grouped when their names differ only in case, accents, spacing, punctuation, “&”/“and” or “Limited”/“Ltd”. Other merges (such as “The Foo Trust” and “Foo Trust”) are made only after a person reviews them.</li>
          <li>Whether a recipient is an individual or an organisation isn’t in ACE’s data. It’s inferred from the name, is sometimes wrong, and is always labelled as inferred.</li>
          <li>Local authorities are shown on current boundaries: grants recorded under authorities abolished or merged since 2018 (for example Harrogate, now part of North Yorkshire) count towards their successor. The authority as recorded is still shown on each grant.</li>
          <li>The decision month and quarter are taken from the award date.</li>
        </ul>
      </Section>

      <Section title="What the figures mean">
        <dl className="space-y-3">
          <Term term="Funding year">ACE’s financial year, 1 April to 31 March.</Term>
          <Term term="Year-on-year change">
            Compared with the previous financial year. For a year still in progress, it compares the same period of each year (awards up to the latest date published so far), not a part-year with a full one.
          </Term>
          <Term term="Median and mean award">The median is the middle award when sorted; half are larger and half smaller. Because a few large grants pull the mean up, the median is the better guide to a typical award.</Term>
          <Term term="Size brackets">Up to £15,000; £15,000 to £30,000; £30,000 to £100,000; over £100,000. They follow ACE’s strand thresholds: “up to” includes the amount, “over” doesn’t.</Term>
          <Term term="New and returning recipients">
            A recipient is new in the year of their first grant anywhere in this dataset. {first && `${formatFY(first)} isn’t shown in that chart, because the data starts there and every recipient would look new.`}
          </Term>
          <Term term="Linked charts">Each chart applies all your filters except its own, so it can show the options you haven’t chosen. Stats, the table and exports use every filter.</Term>
          <Term term="Per resident">
            {pop
              ? `Funding divided by the ONS mid-year population estimate${pop.year ? ` for ${pop.year}` : ""} (${pop.source}). An ACE area’s population is the sum of the districts whose grants are mostly recorded in that area, because ACE areas aren’t an official statistical geography.`
              : "Shown when the dataset is built with ONS population estimates; this copy wasn’t."}
          </Term>
        </dl>
      </Section>

      {(meta?.designations?.length || meta?.deprivation) && (
        <Section title="Place lenses">
          {meta?.designations?.map((d) => (
            <p key={d.id}>
              <strong className="text-white">
                {d.name}
                {d.period ? ` (${d.period})` : ""}
              </strong>
              : {d.places.length} local authorities{d.source ? `, from ${d.source}` : ""}. Lists are matched on current boundaries: where a listed district has since merged into a larger authority, the whole successor counts.
            </p>
          ))}
          {meta?.designations?.length ? (
            <p>Designations cover set periods and have changed over time; grants from any year are shown against each list as published.</p>
          ) : null}
          {meta?.deprivation && (
            <p>
              <strong className="text-white">Deprivation</strong>: English Indices of Deprivation{meta.deprivation.edition ? ` ${meta.deprivation.edition}` : ""}, “{meta.deprivation.measure}” for {meta.deprivation.districts} districts (rank 1 is the most deprived), grouped into fifths. It describes places, not the people who received grants.
            </p>
          )}
        </Section>
      )}

      <Section title="Limitations">
        <ul className="list-disc pl-5 space-y-2">
          <li>Figures are as published by ACE. Awards later withdrawn or changed may not be reflected.</li>
          <li>ACE publishes the names of individual recipients; they’re shown here as published.</li>
          <li>A grant is counted where ACE records it, which is usually the recipient’s base rather than everywhere the work happens.</li>
          <li>Recipient grouping is cautious, so one organisation can occasionally appear under two names.</li>
        </ul>
      </Section>

      <Section title="How to cite">
        <p className="font-mono text-xs bg-white/5 border border-white/10 rounded-lg p-3 text-white/80 break-words">{citation}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={copy}
            className={`px-3 py-1.5 border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-mono text-white/80 hover:text-white transition-colors cursor-pointer ${FOCUS_RING}`}
          >
            Copy citation
          </button>
          <span role="status" className="text-xs text-emerald-400 font-mono">
            {copied ? "Citation copied" : ""}
          </span>
        </div>
        <p className="text-sm">
          Grant data: Arts Council England. Boundaries and population estimates: Office for National Statistics, licensed under the Open Government Licence v3.0.
        </p>
      </Section>
    </div>
  );
};
