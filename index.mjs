#!/usr/bin/env node
/**
 * @chipdocs/mcp-server — Zero-dependency MCP stdio server for chipdocs.org
 * Works out of the box with Claude Desktop, Cursor, Windsurf, and Antigravity IDE.
 */

import readline from 'node:readline';

const BASE_URL = (process.env.CHIPDOCS_API_URL || 'https://chipdocs.org').replace(/\/+$/, '');
const SERVER_INFO = { name: '@chipdocs/mcp-server', version: '1.0.0' };

const TOOLS = [
  {
    name: 'search_components',
    description: 'Search 7,900+ verified electronic components on chipdocs.org by MPN, LCSC code, manufacturer, or package (QFN, LQFP, SOIC, MODULE, BGA, SOT, THT).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Part number or keyword (e.g. STM32F103, ESP32-S3, CH340, LM2596)' },
        pkg: { type: 'string', description: 'Optional package family filter: QFN, QFP, SOIC, MODULE, BGA, SOT, THT' },
        mfg: { type: 'string', description: 'Optional manufacturer filter (e.g. STMicroelectronics, Espressif, Microchip)' },
        limit: { type: 'integer', default: 10, minimum: 1, maximum: 30 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_component_datasheet_specs',
    description: 'Retrieve full LLM-optimized Markdown technical datasheet summary: pinout table, mechanical envelope, IPC-7351B land pattern, electrical ratings, and direct CAD links.',
    inputSchema: {
      type: 'object',
      properties: {
        part_id: { type: 'string', description: 'MPN (e.g. STM32F103C8T6) or LCSC code (e.g. C8734)' },
      },
      required: ['part_id'],
    },
  },
  {
    name: 'find_component_equivalents',
    description: 'Find drop-in replacements, same-family upgrades, and footprint-compatible alternatives with 0-100% compatibility scores and PCB migration warnings.',
    inputSchema: {
      type: 'object',
      properties: {
        part_id: { type: 'string', description: 'Target MPN or LCSC code (e.g. STM32F103C8T6, CH340G, AMS1117-3.3)' },
        limit: { type: 'integer', default: 12, minimum: 1, maximum: 25 },
      },
      required: ['part_id'],
    },
  },
  {
    name: 'compare_components',
    description: 'Compare 2 to 4 ICs side-by-side: package envelope, pitch, thermal EPAD, supply voltage, and pin-by-pin alignment compatibility percentage.',
    inputSchema: {
      type: 'object',
      properties: {
        parts: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 4,
          description: 'Array of 2-4 MPNs or LCSC codes (e.g. ["STM32F103C8T6", "STM32F401RET6"])',
        },
      },
      required: ['parts'],
    },
  },
  {
    name: 'get_cad_download_links',
    description: 'Get direct CERN-OHL-P-2.0 open-hardware download URLs for KiCad 8 (.zip, .kicad_mod, .kicad_sym), Fusion 360 (.lbr), 3D STEP AP214, WebGL GLB, and 1200x630 Pinout Card PNG.',
    inputSchema: {
      type: 'object',
      properties: {
        part_id: { type: 'string', description: 'MPN or LCSC code' },
      },
      required: ['part_id'],
    },
  },
];

async function fetchJson(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'ChipDocs-MCP/1.0' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`);
  return resp.json();
}

async function fetchText(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'ChipDocs-MCP/1.0', Accept: 'text/markdown' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`);
  return resp.text();
}

async function executeTool(name, args = {}) {
  if (name === 'search_components') {
    const qs = new URLSearchParams({ q: String(args.query || ''), limit: String(args.limit || 10) });
    if (args.pkg) qs.set('pkg', String(args.pkg));
    if (args.mfg) qs.set('mfg', String(args.mfg));
    const data = await fetchJson(`${BASE_URL}/api/v1/components/search?${qs.toString()}`);
    return JSON.stringify(data, null, 2);
  }

  if (name === 'get_component_datasheet_specs') {
    const id = encodeURIComponent(String(args.part_id || '').trim());
    return await fetchText(`${BASE_URL}/api/v1/components/${id}/markdown`);
  }

  if (name === 'find_component_equivalents') {
    const id = encodeURIComponent(String(args.part_id || '').trim());
    const lim = Number(args.limit || 12);
    const data = await fetchJson(`${BASE_URL}/api/v1/alternatives/${id}?limit=${lim}`);
    return JSON.stringify(data, null, 2);
  }

  if (name === 'compare_components') {
    const parts = Array.isArray(args.parts) ? args.parts.map((x) => String(x).trim()).filter(Boolean) : [];
    const data = await fetchJson(`${BASE_URL}/api/v1/compare?parts=${encodeURIComponent(parts.join(','))}`);
    return JSON.stringify(data, null, 2);
  }

  if (name === 'get_cad_download_links') {
    const q = String(args.part_id || '').trim();
    const search = await fetchJson(`${BASE_URL}/api/v1/components/search?q=${encodeURIComponent(q)}&limit=1`);
    const item = search?.components?.[0];
    if (!item) throw new Error(`Component '${q}' not found on chipdocs.org`);
    const pid = encodeURIComponent(item.lcsc_part);
    const slugMpn = encodeURIComponent(item.mpn.replace(/[^A-Za-z0-9_.-]+/g, '-'));
    return JSON.stringify(
      {
        mpn: item.mpn,
        lcsc_part: item.lcsc_part,
        manufacturer: item.canonical_manufacturer,
        package: item.package,
        pin_count: item.pin_count,
        web_studio: `${BASE_URL}/parts/${slugMpn}`,
        equivalents_page: `${BASE_URL}/equivalents/${slugMpn}`,
        downloads: {
          kicad_zip: `${BASE_URL}/api/v1/assets/${pid}/cleanroom/kicad.zip`,
          kicad_footprint: `${BASE_URL}/api/v1/assets/${pid}/cleanroom/footprint.kicad_mod`,
          kicad_symbol: `${BASE_URL}/api/v1/assets/${pid}/cleanroom/symbol.kicad_sym`,
          fusion360_lbr: `${BASE_URL}/api/v1/assets/${pid}/cleanroom/library.lbr`,
          step_3d: `${BASE_URL}/api/v1/assets/${pid}/cleanroom/model.step`,
          glb_3d: `${BASE_URL}/api/v1/assets/${pid}/cleanroom/model.glb`,
          pinout_png: `${BASE_URL}/media/pinout/${slugMpn}-pinout.png`,
        },
      },
      null,
      2
    );
  }

  throw new Error(`Unknown tool: ${name}`);
}

process.stdout.on('error', (err) => {
  if (err?.code === 'EPIPE') process.exit(0);
});

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req;
  try {
    req = JSON.parse(trimmed);
  } catch {
    return;
  }
  const { id, method, params } = req;
  if (method === 'notifications/initialized') return;

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    });
    return;
  }

  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }

  if (method === 'tools/call') {
    try {
      const text = await executeTool(params?.name, params?.arguments || {});
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id,
        result: { isError: true, content: [{ type: 'text', text: `Error: ${err?.message || String(err)}` }] },
      });
    }
    return;
  }

  if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
});
