// Express Server with Server-Sent Events (SSE) & SQLite - Web Lead Scraper
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { runScrape } from './scraper.js';
import { generateSalesPitch } from './pitchGenerator.js';

const app = express();
const port = 3000;
const leadsFilePath = './leads.json';
const dbFilePath = './leads.db';

let db = null;

app.use(cors());
app.use(express.json());

// --- LOCAL STORAGE PERSISTENCE HANDLERS (AUTO-HEAL) ---
const sanitizeLead = (lead) => {
  let modified = false;
  if (lead.category) {
    const cleanCat = lead.category.replace(/^[0-9.,()\s·]+/, '').trim();
    if (cleanCat !== lead.category) {
      lead.category = cleanCat;
      modified = true;
    }
  }
  if (lead.opportunities && lead.rating !== null) {
    const ratingNum = parseFloat(lead.rating);
    if (ratingNum >= 4.2) {
      const filtered = lead.opportunities.filter(opp => opp !== 'REPUTACAO_BAIXA');
      if (filtered.length !== lead.opportunities.length) {
        lead.opportunities = filtered;
        modified = true;
      }
    }
  }
  // Auto-heal corrupted reviewsCount (rating * 10 bug)
  if (lead.rating !== null && lead.reviewsCount !== null) {
    const ratingX10 = Math.round(parseFloat(lead.rating) * 10);
    if (lead.reviewsCount === ratingX10 && ratingX10 > 0) {
      lead.reviewsCount = 0;
      modified = true;
    }
  }
  return { lead, modified };
};

// --- SQLITE DATABASE MANAGER & AUTO-MIGRATION ---
const initDatabase = async () => {
  try {
    db = await open({
      filename: dbFilePath,
      driver: sqlite3.Database
    });

    // Create the leads table if not exists
    await db.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        phone TEXT,
        email TEXT,
        website TEXT,
        websiteType TEXT,
        address TEXT,
        rating REAL,
        reviewsCount INTEGER,
        latitude REAL,
        longitude REAL,
        mapsUrl TEXT,
        imageUrl TEXT,
        photos TEXT,
        brandColors TEXT,
        styleEsthetic TEXT,
        services TEXT,
        hasSSL INTEGER,
        hasCustomDomain INTEGER,
        hasWhatsapp INTEGER,
        opportunities TEXT,
        salesPitch TEXT,
        timestamp INTEGER
      )
    `);

    console.log("[Database] Banco de dados SQLite inicializado com sucesso.");

    // Trigger migration from leads.json if it exists
    await migrateFromJson();
  } catch (err) {
    console.error("Erro crítico na inicialização do banco SQLite:", err.message);
    process.exit(1);
  }
};

const migrateFromJson = async () => {
  try {
    if (fs.existsSync(leadsFilePath)) {
      console.log("[Migration] Detectado arquivo leads.json histórico. Iniciando migração para o SQLite...");
      const data = fs.readFileSync(leadsFilePath, 'utf8');
      const leads = JSON.parse(data || '[]');
      
      let count = 0;
      for (const lead of leads) {
        const { lead: cleanLead } = sanitizeLead(lead);
        await saveLeadToDb(cleanLead);
        count++;
      }
      
      console.log(`[Migration] Migração concluída com sucesso! ${count} leads importados para o SQLite.`);
      
      // Rename files to prevent re-migration
      const backupPath = './leads_backup.json';
      fs.renameSync(leadsFilePath, backupPath);
      console.log(`[Migration] Arquivo original leads.json renomeado para ${backupPath} como backup.`);
    }
  } catch (err) {
    console.error("[Migration] Falha durante a execução da migração de dados:", err.message);
  }
};

const saveLeadToDb = async (lead) => {
  const { lead: cleanLead } = sanitizeLead(lead);
  await db.run(`
    INSERT OR REPLACE INTO leads (
      id, name, category, phone, email, website, websiteType, address, 
      rating, reviewsCount, latitude, longitude, mapsUrl, imageUrl, 
      photos, brandColors, styleEsthetic, services, hasSSL, 
      hasCustomDomain, hasWhatsapp, opportunities, salesPitch, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    cleanLead.id,
    cleanLead.name,
    cleanLead.category || '',
    cleanLead.phone || '',
    cleanLead.email || '',
    cleanLead.website || '',
    cleanLead.websiteType || 'SEM_SITE',
    cleanLead.address || '',
    cleanLead.rating,
    cleanLead.reviewsCount,
    cleanLead.latitude,
    cleanLead.longitude,
    cleanLead.mapsUrl || '',
    cleanLead.imageUrl || '',
    JSON.stringify(cleanLead.photos || []),
    JSON.stringify(cleanLead.brandColors || []),
    cleanLead.styleEsthetic || 'Sem Website',
    JSON.stringify(cleanLead.services || []),
    cleanLead.hasSSL ? 1 : 0,
    cleanLead.hasCustomDomain ? 1 : 0,
    cleanLead.hasWhatsapp ? 1 : 0,
    JSON.stringify(cleanLead.opportunities || []),
    cleanLead.salesPitch || '',
    cleanLead.timestamp || Date.now()
  ]);
};

const getAllLeads = async () => {
  const rows = await db.all(`SELECT * FROM leads ORDER BY timestamp DESC`);
  return rows.map(row => {
    const lead = {
      id: row.id,
      name: row.name,
      category: row.category,
      phone: row.phone,
      email: row.email,
      website: row.website,
      websiteType: row.websiteType,
      address: row.address,
      rating: row.rating,
      reviewsCount: row.reviewsCount,
      latitude: row.latitude,
      longitude: row.longitude,
      mapsUrl: row.mapsUrl,
      imageUrl: row.imageUrl,
      photos: JSON.parse(row.photos || '[]'),
      brandColors: JSON.parse(row.brandColors || '[]'),
      styleEsthetic: row.styleEsthetic,
      services: JSON.parse(row.services || '[]'),
      hasSSL: !!row.hasSSL,
      hasCustomDomain: !!row.hasCustomDomain,
      hasWhatsapp: !!row.hasWhatsapp,
      opportunities: JSON.parse(row.opportunities || '[]'),
      salesPitch: row.salesPitch,
      timestamp: row.timestamp
    };
    const { lead: cleanLead } = sanitizeLead(lead);
    return cleanLead;
  });
};

const deleteLeadFromDb = async (leadId) => {
  await db.run(`DELETE FROM leads WHERE id = ?`, [leadId]);
};

// List of connected SSE clients
let sseClients = [];
let isScrapingActive = false;
let cancelRequested = false;

// Helper to broadcast SSE events to all connected clients
const broadcastEvent = (event, data) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(payload);
    } catch (e) {
      console.error("Failed to write to SSE client:", e);
    }
  });
};

// SSE streaming endpoint
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Keep connection alive
  res.write(': keepalive\n\n');

  sseClients.push(res);
  console.log(`[Server] Cliente conectado para stream em tempo real. Total de conexões: ${sseClients.length}`);

  // Send current scraping status initially
  const statusPayload = {
    event: 'status',
    data: { state: isScrapingActive ? 'running' : 'idle', message: isScrapingActive ? 'Raspagem ativa em progresso...' : 'Pronto para iniciar busca.' }
  };
  res.write(`event: ${statusPayload.event}\ndata: ${JSON.stringify(statusPayload.data)}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
    console.log(`[Server] Cliente desconectado. Total de conexões: ${sseClients.length}`);
  });
});

// REST endpoint to load all saved leads from SQLite
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await getAllLeads();
    res.json(leads);
  } catch (err) {
    console.error("Erro ao carregar leads do SQLite:", err.message);
    res.status(500).json({ error: "Falha ao carregar base de dados." });
  }
});

// REST endpoint to delete a lead persistently from SQLite
app.delete('/api/leads/*', async (req, res) => {
  try {
    const leadId = req.params[0];
    await deleteLeadFromDb(leadId);
    res.json({ status: "success", message: "Lead removido localmente do banco relacional SQLite." });
  } catch (err) {
    console.error("Erro ao deletar lead do banco SQLite:", err.message);
    res.status(500).json({ error: "Falha ao remover lead da base de dados relacional." });
  }
});

// REST endpoint to delete multiple leads persistently from SQLite (Bulk Delete)
app.post('/api/leads/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Lista de IDs inválida para exclusão múltipla." });
    }
    const placeholders = ids.map(() => '?').join(',');
    await db.run(`DELETE FROM leads WHERE id IN (${placeholders})`, ids);
    res.json({ status: "success", message: `${ids.length} leads removidos do banco relacional SQLite.` });
  } catch (err) {
    console.error("Erro ao deletar múltiplos leads do banco SQLite:", err.message);
    res.status(500).json({ error: "Falha ao deletar múltiplos leads da base de dados relacional." });
  }
});


// REST endpoint to cancel the scraping process
app.post('/api/cancel', (req, res) => {
  if (isScrapingActive) {
    cancelRequested = true;
    broadcastEvent('status', { state: 'cancelling', message: 'Cancelamento solicitado pelo usuário...' });
    res.json({ status: "cancelling", message: "Cancelamento solicitado." });
  } else {
    res.status(400).json({ error: "Nenhuma busca ativa em andamento para cancelar." });
  }
});

// Trigger Scrape Session Route
app.post('/api/scrape', async (req, res) => {
  const { niche, location, limit } = req.body;

  if (!niche) {
    return res.status(400).json({ error: "Nicho/Palavra-chave é obrigatório." });
  }

  if (isScrapingActive) {
    return res.status(409).json({ error: "Já existe uma sessão de extração em andamento." });
  }

  const parsedLimit = parseInt(limit) || 0;

  // Start scraper session asynchronously
  isScrapingActive = true;
  cancelRequested = false;
  broadcastEvent('status', { state: 'running', message: `Iniciando robô para buscar por "${niche}" em "${location || 'global'}" (limite: ${parsedLimit || 'sem limite'})` });

  // Run Puppeteer
  (async () => {
    try {
      const existingLeads = await getAllLeads();
      // Only treat as persistent duplicate if it is a fully valid, non-corrupted lead
      const existingIds = new Set(
        existingLeads
          .filter(l => !(l.rating > 0 && l.reviewsCount === 0))
          .map(l => l.id)
      );

      await runScrape(
        niche,
        location,
        parsedLimit,
        (progressMessage) => {
          // Stream logs in real-time
          broadcastEvent('log', { message: progressMessage, timestamp: Date.now() });
        },
        async (lead) => {
          // Generate Sales Pitch proposal based on extracted lead B2B signals
          lead.salesPitch = generateSalesPitch(lead);
          
          // Persist lead locally in SQLite leads.db
          await saveLeadToDb(lead);
          
          // Stream lead back to React frontend immediately!
          broadcastEvent('lead', lead);
        },
        existingIds, // Pass Set to skip duplicates persistently!
        () => cancelRequested
      );

      broadcastEvent('status', { state: 'finished', message: 'Extração concluída com sucesso!' });
    } catch (err) {
      console.error("Critical error in Puppeteer automation:", err);
      broadcastEvent('status', { state: 'failed', message: `Erro na extração: ${err.message}` });
    } finally {
      isScrapingActive = false;
      cancelRequested = false;
      broadcastEvent('status', { state: 'idle', message: 'Sessão encerrada.' });
    }
  })();

  return res.json({ status: "started", message: "Extração inicializada com sucesso em segundo plano." });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: "online", scrapingActive: isScrapingActive });
});

// Start database and listening
initDatabase().then(() => {
  app.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 CLI WEB Lead Scraper - Web Backend rodando na porta ${port}`);
    console.log(`👉 Stream SSE ativo em: http://localhost:${port}/api/stream`);
    console.log(`======================================================\n`);
  });
});
