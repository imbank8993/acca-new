# Amiri Arabic font

Arabic font used by ACCA-CBT, served locally for ACCA journal, attendance, grades, and other Poppins text. Only Arabic-subset glyphs are registered: Latin Poppins and icon fonts are unaffected. Regular and bold files are included. Italic is synthesized in the composite family, preserving the existing Latin Poppins behavior.

Source: Google Fonts CSS API, Amiri v30, retrieved 2026-10-17.

- https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap
- License: https://github.com/google/fonts/blob/main/ofl/amiri/OFL.txt (copy in OFL.txt).
- Upstream: https://github.com/aliftype/amiri

Arabic faces are also registered under Poppins with a Unicode range. This intentionally supports existing page-specific and mobile Poppins rules without rewriting user text or using DOM mutation observers. Faces match the exact Poppins weights 300–900 loaded by the app. Regular supplies 300–500; bold supplies 600–900. Exact weights are necessary for Unicode composition with the Google Fonts Poppins faces. Font binaries are unmodified.
