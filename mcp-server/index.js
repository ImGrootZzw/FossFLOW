#!/usr/bin/env node
/**
 * FossFLOW MCP server
 *
 * Lets any MCP-capable AI session create isometric network topology diagrams
 * that open directly in FossFLOW.
 *
 * Transport: stdio, newline-delimited JSON-RPC 2.0 (no dependencies).
 * Output:    <repo>/topologies/<slug>.json  (configurable via FOSSFLOW_TOPOLOGIES_DIR)
 *
 * Tools:
 *   create_topology  create/replace a diagram from nodes + links
 *   list_topologies  list generated diagrams
 *   get_topology     return one diagram (summary by default, full JSON optional)
 *   delete_topology  remove a diagram
 *   list_icons       available built-in icon ids
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR =
  process.env.FOSSFLOW_TOPOLOGIES_DIR || path.join(ROOT, 'topologies');

const SERVER_INFO = { name: 'fossflow-mcp', version: '1.0.0' };

// Built-in (core isoflow) icon ids, safe to reference from diagram items
const CORE_ICONS = [
  'server',
  'storage',
  'switch-module',
  'router',
  'firewall',
  'cloud',
  'loadbalancer',
  'dns',
  'vm',
  'desktop',
  'laptop',
  'mobiledevice',
  'printer',
  'tower',
  'user',
  'queue',
  'cache',
  'lock',
  'mail',
  'mailmultiple',
  'office',
  'cube',
  'sphere',
  'pyramid',
  'diamond',
  'document',
  'image',
  'plane',
  'truck',
  'truck-2',
  'cardterminal',
  'paymentcard',
  'function-module',
  'package-module',
  'cronjob',
  'speech',
  'block',
  'isoflow'
];

// Friendly aliases so callers do not need to know exact ids
const ICON_ALIASES = {
  database: 'storage',
  db: 'storage',
  disk: 'storage',
  nas: 'storage',
  switch: 'switch-module',
  sw: 'switch-module',
  lb: 'loadbalancer',
  'load-balancer': 'loadbalancer',
  balance: 'loadbalancer',
  pc: 'desktop',
  computer: 'desktop',
  workstation: 'desktop',
  phone: 'mobiledevice',
  mobile: 'mobiledevice',
  ap: 'tower',
  wifi: 'tower',
  wireless: 'tower',
  gateway: 'router',
  route: 'router',
  fw: 'firewall',
  ids: 'firewall',
  ips: 'firewall',
  person: 'user',
  people: 'user',
  group: 'user',
  web: 'server',
  app: 'server',
  api: 'server',
  mq: 'queue',
  queue: 'queue',
  cache: 'cache',
  redis: 'cache',
  proxy: 'switch-module',
  container: 'cube',
  vm: 'vm',
  virtual: 'vm'
};

const PALETTE = [
  { id: 'color1', value: '#0392ff' },
  { id: 'color2', value: '#22c55e' },
  { id: 'color3', value: '#f59e0b' },
  { id: 'color4', value: '#ef4444' },
  { id: 'color5', value: '#8b5cf6' },
  { id: 'color6', value: '#64748b' }
];

const NOTE_LIMIT = 100;
const DESC_LIMIT = 1000;

const uid = () => crypto.randomUUID();

const slugify = (value) => {
  const slug = String(value || 'topology')
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'topology';
};

const clampText = (value, limit, fallback = '') => {
  const text = value === undefined || value === null ? fallback : String(value);
  return text.length > limit ? text.slice(0, limit) : text;
};

const resolveIcon = (icon) => {
  if (!icon) return 'server';
  const key = String(icon).trim().toLowerCase();
  if (CORE_ICONS.includes(key)) return key;
  if (ICON_ALIASES[key]) return ICON_ALIASES[key];
  const compact = key.replace(/[-_\s]+/g, '');
  const match = CORE_ICONS.find((candidate) => {
    return candidate.replace(/-/g, '') === compact;
  });
  return match || 'server';
};

/**
 * Assign layers with a BFS from nodes that have no incoming links.
 * Falls back to declaration order for cycles.
 */
const assignLayers = (nodes, links) => {
  const ids = nodes.map((n) => n.id);
  const indegree = new Map(ids.map((id) => [id, 0]));
  const out = new Map(ids.map((id) => [id, []]));

  links.forEach((link) => {
    if (!indegree.has(link.from) || !indegree.has(link.to)) return;
    indegree.set(link.to, (indegree.get(link.to) || 0) + 1);
    out.get(link.from).push(link.to);
  });

  const layer = new Map();
  const queue = [];

  ids.forEach((id) => {
    if (indegree.get(id) === 0) {
      layer.set(id, 0);
      queue.push(id);
    }
  });

  // Cycle or fully linked graph: start from the first node
  if (queue.length === 0 && ids.length > 0) {
    layer.set(ids[0], 0);
    queue.push(ids[0]);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const base = layer.get(current) ?? 0;
    (out.get(current) || []).forEach((next) => {
      const candidate = base + 1;
      if ((layer.get(next) ?? -1) < candidate) {
        layer.set(next, candidate);
        queue.push(next);
      }
    });
  }

  ids.forEach((id) => {
    if (!layer.has(id)) layer.set(id, 0);
  });

  return layer;
};

const layoutNodes = (nodes, links) => {
  const layer = assignLayers(nodes, links);
  const byLayer = new Map();

  nodes.forEach((node) => {
    const value = layer.get(node.id) ?? 0;
    if (!byLayer.has(value)) byLayer.set(value, []);
    byLayer.get(value).push(node);
  });

  const X_STEP = 4;
  const Y_STEP = 4;

  return nodes.map((node) => {
    if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
      return { ...node, tile: { x: Math.round(node.x), y: Math.round(node.y) } };
    }

    const value = layer.get(node.id) ?? 0;
    const siblings = byLayer.get(value) || [node];
    const index = siblings.findIndex((n) => n.id === node.id);
    const offset = (siblings.length - 1) / 2;

    return {
      ...node,
      tile: {
        x: value * X_STEP,
        y: Math.round((index - offset) * Y_STEP)
      }
    };
  });
};

/**
 * Shift the layout so its centre sits near tile (0, 0).
 * The canvas is centred on tile 0,0 when a diagram is opened, so this keeps
 * the whole topology visible without relying on fit-to-view.
 */
const centreNodes = (nodes) => {
  if (nodes.length === 0) return nodes;

  const xs = nodes.map((n) => n.tile.x);
  const ys = nodes.map((n) => n.tile.y);
  const offsetX = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
  const offsetY = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);

  return nodes.map((node) => {
    return {
      ...node,
      tile: { x: node.tile.x - offsetX, y: node.tile.y - offsetY }
    };
  });
};

const buildDiagram = ({ name, description, nodes, links, viewName }) => {
  const prepared = centreNodes(layoutNodes(nodes, links));

  const items = prepared.map((node) => {
    const item = {
      id: node.id,
      name: clampText(node.label || node.name || node.id, NOTE_LIMIT, node.id),
      icon: resolveIcon(node.icon)
    };

    if (node.description) {
      item.description = `<p>${clampText(node.description, DESC_LIMIT)}</p>`;
    }

    return item;
  });

  const viewItems = prepared.map((node) => {
    return { id: node.id, tile: node.tile, labelHeight: 80 };
  });

  const nodeById = new Map(prepared.map((n) => [n.id, n]));

  const connectors = links.map((link) => {
    const from = nodeById.get(link.from);
    const to = nodeById.get(link.to);
    const anchors = [{ id: uid(), ref: { item: from.id } }];

    (link.via || []).forEach((point) => {
      anchors.push({
        id: uid(),
        ref: { tile: { x: Math.round(point.x), y: Math.round(point.y) } }
      });
    });

    anchors.push({ id: uid(), ref: { item: to.id } });

    const connector = {
      id: uid(),
      color: link.color && PALETTE.some((c) => c.id === link.color)
        ? link.color
        : 'color1',
      anchors,
      style: ['SOLID', 'DOTTED', 'DASHED'].includes(link.style)
        ? link.style
        : 'SOLID',
      width: Number.isFinite(link.width) ? link.width : 8,
      showArrow: link.arrow !== false
    };

    if (link.label) {
      connector.labels = [
        {
          id: uid(),
          text: clampText(link.label, NOTE_LIMIT),
          position: 50,
          showLine: false
        }
      ];
    }

    return connector;
  });

  return {
    title: clampText(name, NOTE_LIMIT, 'Topology'),
    description: description ? clampText(description, DESC_LIMIT) : undefined,
    version: '1.0.0',
    icons: [],
    colors: PALETTE,
    items,
    views: [
      {
        id: 'main',
        name: clampText(viewName || 'Main', NOTE_LIMIT, 'Main'),
        items: viewItems,
        connectors,
        rectangles: [],
        textBoxes: []
      }
    ]
  };
};

const normalizeNodes = (nodes) => {
  const seen = new Set();

  return (nodes || []).map((node, index) => {
    let id = String(node.id || node.label || `node-${index + 1}`)
      .trim()
      .replace(/\s+/g, '-');
    if (!id) id = `node-${index + 1}`;

    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);

    return {
      ...node,
      id,
      x: Number.isFinite(node.x) ? node.x : undefined,
      y: Number.isFinite(node.y) ? node.y : undefined
    };
  });
};

const validateTopology = (nodes, links) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('nodes must be a non-empty array');
  }

  const ids = new Set(nodes.map((n) => n.id));
  (links || []).forEach((link, index) => {
    if (!ids.has(link.from)) {
      throw new Error(`links[${index}].from "${link.from}" is not a known node id`);
    }
    if (!ids.has(link.to)) {
      throw new Error(`links[${index}].to "${link.to}" is not a known node id`);
    }
  });
};

const ensureOutDir = () => fs.mkdirSync(OUT_DIR, { recursive: true });

const listFiles = () => {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((file) => {
      const full = path.join(OUT_DIR, file);
      const stat = fs.statSync(full);
      let title = path.basename(file, '.json');
      let nodes = 0;
      let links = 0;

      try {
        const data = JSON.parse(fs.readFileSync(full, 'utf8'));
        title = data.title || title;
        nodes = (data.items || []).length;
        links = (data.views?.[0]?.connectors || []).length;
      } catch {
        /* keep defaults for broken files */
      }

      return {
        file,
        path: full,
        title,
        nodes,
        links,
        updatedAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
};

const openHint = (filePath) => {
  return (
    `Open it in FossFLOW: hamburger menu (bottom-left) -> Open -> pick the file. ` +
    `Path: ${filePath}`
  );
};

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

const tools = {
  create_topology: {
    description:
      'Create (or overwrite) an isometric network topology diagram from nodes and links. ' +
      'Returns the JSON file path; open it in FossFLOW via the main menu -> Open.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Diagram title' },
        description: { type: 'string', description: 'Optional diagram description' },
        viewName: { type: 'string', description: 'Name of the single view (default "Main")' },
        overwrite: {
          type: 'boolean',
          description: 'Overwrite an existing diagram with the same slug (default false)'
        },
        nodes: {
          type: 'array',
          minItems: 1,
          description: 'Devices/servers in the topology',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Stable id, referenced by links' },
              label: { type: 'string', description: 'Text shown under the icon' },
              icon: {
                type: 'string',
                description:
                  'Icon id or alias (server, storage/database, switch, router, firewall, cloud, loadbalancer, vm, desktop, laptop, tower/ap, user, printer, queue, cache)'
              },
              description: { type: 'string', description: 'Longer description shown in the node tooltip' },
              x: { type: 'number', description: 'Optional tile x (auto layout when omitted)' },
              y: { type: 'number', description: 'Optional tile y (auto layout when omitted)' }
            },
            required: ['id']
          }
        },
        links: {
          type: 'array',
          description: 'Connections between nodes',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Source node id' },
              to: { type: 'string', description: 'Target node id' },
              label: { type: 'string', description: 'Optional link label' },
              color: { type: 'string', description: 'color1..color6' },
              style: { type: 'string', enum: ['SOLID', 'DOTTED', 'DASHED'] },
              width: { type: 'number', description: 'Stroke width (default 8)' },
              arrow: { type: 'boolean', description: 'Show arrow head (default true)' },
              via: {
                type: 'array',
                description: 'Optional waypoint tiles to route the line around obstacles',
                items: {
                  type: 'object',
                  properties: { x: { type: 'number' }, y: { type: 'number' } },
                  required: ['x', 'y']
                }
              }
            },
            required: ['from', 'to']
          }
        }
      },
      required: ['name', 'nodes']
    },
    run: (args) => {
      const nodes = normalizeNodes(args.nodes);
      const links = args.links || [];
      validateTopology(nodes, links);

      const diagram = buildDiagram({
        name: args.name,
        description: args.description,
        nodes,
        links,
        viewName: args.viewName
      });

      ensureOutDir();
      const slug = slugify(args.name);
      const filePath = path.join(OUT_DIR, `${slug}.json`);

      if (fs.existsSync(filePath) && args.overwrite !== true) {
        throw new Error(
          `${filePath} already exists. Pass overwrite: true or choose another name.`
        );
      }

      fs.writeFileSync(filePath, JSON.stringify(diagram, null, 2), 'utf8');

      const lines = [
        `Created "${diagram.title}" with ${nodes.length} node(s) and ${links.length} link(s).`,
        `File: ${filePath}`,
        '',
        'Nodes (tile x, y):',
        ...nodes.map((node, index) => {
          const tile = diagram.views[0].items[index].tile;
          return `  - ${node.id} "${node.label || node.id}" icon=${resolveIcon(node.icon)} at (${tile.x}, ${tile.y})`;
        }),
        '',
        openHint(filePath)
      ];

      return lines.join('\n');
    }
  },

  list_topologies: {
    description: 'List topology diagrams previously generated in the topologies folder.',
    inputSchema: { type: 'object', properties: {} },
    run: () => {
      const files = listFiles();
      if (files.length === 0) {
        return `No diagrams yet. Folder: ${OUT_DIR}`;
      }
      return [
        `Found ${files.length} diagram(s) in ${OUT_DIR}:`,
        ...files.map((f) => {
          return `  - ${f.title} (${f.file}) — ${f.nodes} nodes, ${f.links} links, updated ${f.updatedAt}`;
        })
      ].join('\n');
    }
  },

  get_topology: {
    description: 'Read a generated diagram. Returns a summary, or the full JSON when full=true.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Diagram name or slug/file name' },
        full: { type: 'boolean', description: 'Return full diagram JSON instead of a summary' }
      },
      required: ['name']
    },
    run: (args) => {
      const slug = slugify(args.name);
      const candidates = [path.join(OUT_DIR, `${slug}.json`), path.join(OUT_DIR, args.name)];

      const filePath = candidates.find((candidate) => fs.existsSync(candidate));
      if (!filePath) {
        throw new Error(`Diagram "${args.name}" not found in ${OUT_DIR}`);
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      if (args.full) return raw;

      const data = JSON.parse(raw);
      const view = data.views?.[0] || { items: [], connectors: [] };
      const tiles = new Map(view.items.map((i) => [i.id, i.tile]));

      return [
        `Title: ${data.title}`,
        `File: ${filePath}`,
        `Nodes: ${(data.items || []).length}, links: ${(view.connectors || []).length}`,
        '',
        ...(data.items || []).map((item) => {
          const tile = tiles.get(item.id) || { x: 0, y: 0 };
          return `  - ${item.id} "${item.name}" icon=${item.icon} at (${tile.x}, ${tile.y})`;
        })
      ].join('\n');
    }
  },

  delete_topology: {
    description: 'Delete a generated diagram file.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Diagram name or slug' } },
      required: ['name']
    },
    run: (args) => {
      const slug = slugify(args.name);
      const filePath = path.join(OUT_DIR, `${slug}.json`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Diagram "${args.name}" not found (${filePath})`);
      }
      fs.unlinkSync(filePath);
      return `Deleted ${filePath}`;
    }
  },

  list_icons: {
    description: 'List icon ids that can be used for nodes.',
    inputSchema: { type: 'object', properties: {} },
    run: () => {
      const aliases = Object.entries(ICON_ALIASES)
        .map(([alias, id]) => `${alias}->${id}`)
        .join(', ');
      return [`Core icon ids (${CORE_ICONS.length}):`, CORE_ICONS.join(', '), '', `Aliases: ${aliases}`].join(
        '\n'
      );
    }
  }
};

// ---------------------------------------------------------------------------
// JSON-RPC plumbing
// ---------------------------------------------------------------------------

const send = (payload) => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

const reply = (id, result) => send({ jsonrpc: '2.0', id, result });

const replyError = (id, code, message) => {
  send({ jsonrpc: '2.0', id, error: { code, message } });
};

const handleRequest = (request) => {
  const { id, method, params } = request;

  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: params?.protocolVersion || '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO
    });
  }

  if (method === 'tools/list') {
    return reply(id, {
      tools: Object.entries(tools).map(([name, tool]) => {
        return {
          name,
          description: tool.description,
          inputSchema: tool.inputSchema
        };
      })
    });
  }

  if (method === 'tools/call') {
    const name = params?.name;
    const tool = tools[name];

    if (!tool) {
      return replyError(id, -32602, `Unknown tool: ${name}`);
    }

    try {
      const text = tool.run(params?.arguments || {});
      return reply(id, { content: [{ type: 'text', text }], isError: false });
    } catch (error) {
      return reply(id, {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      });
    }
  }

  if (method === 'ping') {
    return reply(id, {});
  }

  return replyError(id, -32601, `Method not found: ${method}`);
};

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }

  // Notifications have no id and expect no response
  if (message.id === undefined) return;

  try {
    handleRequest(message);
  } catch (error) {
    replyError(message.id, -32603, error.message);
  }
});

rl.on('close', () => process.exit(0));
