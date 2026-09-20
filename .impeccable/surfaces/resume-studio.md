# Surface: Resume PDF studio

Mode: Operate
Audience: a candidate staring at their own resume, trying to fix the page a parser and a hiring lens will see.
Job: drop a PDF, review it on the paper, act on Jev notes without leaving the page.
Constraints: PDF is the canvas; LinkedIn PDF is coming soon; notes are overlays; drawing is manual; do not flatten the page into a textarea as the primary view.

## Direction contract

THESIS: The resume page is the workspace. Chat, triggers, and Jev notes overlay the paper the way a reviewer marks a printed packet — not a two-column extract-and-sidebar.
OWN-WORLD: Near-black desk (`#07070d`), ivory paper, gold action, cyan/rose/green severity inks. Syne for the product voice, Instrument Sans for UI, Times on the paper itself.
STORY: Drop a PDF. The page appears. Review with Jev. Pins land on regions. Open a pin and talk there. The rest of the chrome stays out of the way.
FIRST VIEWPORT: Full-viewport stage. Empty: a letter-sized drop plate in the center with Resume PDF vs LinkedIn PDF (disabled). Loaded: the paper centered, floating bottom triggers, margin notes after review. Mobile: paper full-width, pins, bottom sheet for the active note.
FORM: Established jevsume world, Operate, extension of the current review surface. Seed: not rolled — specified request, incumbent identity kept.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
