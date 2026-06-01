# Supabase — database schema

This folder version-controls the **database schema history** for the MajorCycle
Supabase project, so the repo (not just the live database) records how the schema
was built and changed.

## `migrations/`

One timestamped SQL file per schema change, in `YYYYMMDDHHMMSS_name.sql` order:

| Migration | What it does |
|---|---|
| `…_create_core_tables.sql` | `stocks`, `price_bars`, `profiles`, `analysis_runs`, `universe_log` + indexes + RLS |
| `…_add_enriched_data_columns.sql` | Enriched JSONB columns on `stocks` (statements, holders, PE history, etc.) |
| `…_add_earnings_staleness_columns.sql` | `next_earnings_date` + `enriched_updated_at` (drive the smart-refresh staleness check) |
| `…_allow_index_market.sql` | Extends the `valid_market` CHECK to allow `market='index'` (benchmark indices) |

These files mirror, one-for-one, the migrations recorded in Supabase's own
migration history (`supabase_migrations.schema_migrations`). They were applied to
the live project through the Supabase MCP integration; these files were then
back-filled from that history so the repo is the source of truth going forward.

## Going forward

- **Adding a schema change via MCP (current workflow):** apply the migration through
  the Supabase integration, then add a matching `migrations/<timestamp>_<name>.sql`
  file here in the same PR.
- **Adding a schema change via the Supabase CLI (optional):** run `supabase init`
  (generates `config.toml`) and `supabase link --project-ref <ref>`, author the
  change with `supabase migration new <name>`, then `supabase db push`.

> **Note:** there is no `config.toml` yet — the project is managed through MCP, not
> the CLI. Run `supabase init` if/when you want CLI-based workflows.
