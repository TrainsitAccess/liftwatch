# Roosevelt (41400) — outstanding question, posted to Discord 2026-07-16

Deferred in the station-review queue (`cta:41400`) pending firsthand answers.
Paste responses back to Claude in the `/liftwatch-station-review` session —
they'll be used to finalize the model in `src/catalog/cta-models.ts`.

## What we know for sure

- CTA's live alert feed has only ever named ONE elevator here: "the transfer
  tunnel elevator at Roosevelt (Red, Orange and Green Lines)" (id
  `41400-TRANSFER-TUNNEL`, first observed 2026-07-08).
- CTA's ASAP Strategic Plan (Tables 14/15, elevator replacement program) says
  Roosevelt has **3 elevators total**.
- chicago-L.org (third-party, not agency) describes only 2: a "main"
  street→mezzanine elevator plus the transfer tunnel elevator to the elevated
  (Orange/Green) — accounting for only 2 of the agency's 3.

## The post as sent

> Hey — I'm building a little side project called LiftWatch that tracks
> transit elevator outages (not live yet, still putting it together), and
> I'm stuck on Chicago's Roosevelt station (Red/Orange/Green).
>
> CTA's live alerts have only ever mentioned one elevator there — the
> "transfer tunnel elevator" — but CTA's own elevator replacement plan says
> the station has 3 elevators total. So there are 2 I can't account for at
> all, and I don't want to just guess at the layout.
>
> If you've actually used this station, I'd love to know:
> - Do Red Line riders and Orange/Green riders use the same elevator to get
>   to street level, or different ones?
> - Is there an elevator that goes straight from the street to the elevated
>   (Orange/Green) platform, separate from anything underground?
> - What does the "transfer tunnel elevator" actually connect — underground
>   to elevated, or something else?
> - However many elevators you remember seeing/using there and roughly where
>   they are
>
> Photos or just "here's what I remember" would help a ton — the one
> write-up I found online only describes 2 of the 3 elevators CTA says
> exist, and I don't want to model this wrong.

## Answers received

Bryce got a full structural answer via Discord (2026-07-16):

> Roosevelt has 3 elevators
>
> 1 elevator from street level to the elevated Green/Orange Line station
>
> 1 elevator from street level to the transfer tunnel to the red line
>
> 1 elevator from the transfer tunnel to the Red Line subway platform
>
> Red line riders use a separate elevator from Green/Orange Line riders to
> get to street level
>
> There is one elevator straight from the Green/Orange Line platform to
> street level

Resolved: TWO independent chains, not one. Green/Orange = one elevator
straight to street. Red Line = two segments (street→mezzanine/tunnel,
mezzanine/tunnel→platform). Bryce confirmed the real observed id
(`41400-TRANSFER-TUNNEL`) maps to the mezzanine/tunnel→platform leg — the
shared choke point for both Red riders arriving from street and
Orange/Green riders transferring down to the Red platform, which is why
the live alert text names all three lines.

**Follow-up correction (2026-07-16, same day):** Bryce found a 4th
elevator, a genuinely separate entrance not in the original agency count
of 3 — street (1155 S State St) to the Red Line mezzanine. It lands at a
different physical space than the transfer-tunnel entrance, but both
funnel into the same elevator down to the platform, making the
street-to-mezzanine leg **redundant** (2 entrances) rather than sole
access. The mezzanine-to-platform leg stays sole access.

Modeled in `src/catalog/cta-models.ts` 2026-07-16 (confidence 8/10).
