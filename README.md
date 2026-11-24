# @chipdocs/mcp-server

Official **Model Context Protocol (MCP)** server for [chipdocs.org](https://chipdocs.org) — give Claude, Cursor, Windsurf, or Antigravity direct access to 7,900+ verified electronic components, datasheet pinout tables, IPC-7351B footprints, drop-in replacements, side-by-side IC comparisons, and 3D STEP/KiCad downloads.

## Tools Included
- `search_components` — Ranked search by MPN, LCSC code, manufacturer, or package
- `get_component_datasheet_specs` — Clean Markdown pinout table, mechanical envelope, and electrical specs
- `find_component_equivalents` — Compatibility-scored drop-in & functional alternatives
- `compare_components` — Side-by-side spec & pin-by-pin alignment diff
- `get_cad_download_links` — Direct KiCad 8, Fusion 360 `.lbr`, 3D `.STEP` & Pinout Card URLs

## Install in Claude Desktop / Cursor / Antigravity
```json
{
  "mcpServers": {
    "chipdocs": {
      "command": "npx",
      "args": ["-y", "@chipdocs/mcp-server"]
    }
  }
}
```

## Publish to npm
```bash
cd integrations/chipdocs-mcp-server
npm login
npm publish --access public
```
