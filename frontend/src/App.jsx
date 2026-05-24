// React B2B Lead Dashboard & Diagnostic Console - G-Maps Scraper Web App
import React, { useState, useEffect, useRef } from 'react';

function App() {
  // --- STATE MANAGEMENT ---
  const [leads, setLeads] = useState([]);
  const [logs, setLogs] = useState([
    { text: '📟 Sistema inicializado. Pronto para iniciar buscas.', timestamp: Date.now(), type: 'info' }
  ]);
  const [status, setStatus] = useState({ state: 'idle', message: 'Pronto para iniciar busca.' });
  
  // Form parameters
  const [niche, setNiche] = useState('Clinica de Estetica');
  const [location, setLocation] = useState('Belo Horizonte');
  const [limit, setLimit] = useState(50);
  const [isUnlimited, setIsUnlimited] = useState(false);

  // Layout & Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLead, setSelectedLead] = useState(null);
  const [checkedLeadIds, setCheckedLeadIds] = useState([]);
  
  // Table Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOpportunity, setSelectedOpportunity] = useState('ALL');
  const [filterOnlyWithEmail, setFilterOnlyWithEmail] = useState(false);
  const [filterOnlyWithWhatsapp, setFilterOnlyWithWhatsapp] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Refs for UI Scrolling
  const terminalBodyRef = useRef(null);

  // --- REAL-TIME DATA LOAD AND SSE CONNECTION ---
  const sanitizeLead = (lead) => {
    if (lead.category) {
      lead.category = lead.category.replace(/^[0-9.,()\s·]+/, '').trim();
    }
    if (lead.opportunities && lead.rating !== null) {
      const ratingNum = parseFloat(lead.rating);
      if (ratingNum >= 4.2) {
        lead.opportunities = lead.opportunities.filter(opp => opp !== 'REPUTACAO_BAIXA');
      }
    }
    // Auto-heal corrupted reviewsCount (rating * 10 bug)
    if (lead.rating !== null && lead.reviewsCount !== null) {
      const ratingX10 = Math.round(parseFloat(lead.rating) * 10);
      if (lead.reviewsCount === ratingX10 && ratingX10 > 0) {
        lead.reviewsCount = 0;
      }
    }
    return lead;
  };

  useEffect(() => {
    // Load previously saved leads persistently from local JSON backend on component mount
    const fetchSavedLeads = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/leads');
        if (response.ok) {
          const data = await response.json();
          // Load leads sorted by newest first
          const sanitized = data.map(sanitizeLead);
          setLeads(sanitized.reverse());
        }
      } catch (err) {
        console.error('Falha ao carregar leads locais persistidos:', err);
      }
    };
    fetchSavedLeads();

    // Establish connection to backend SSE streaming endpoint
    const eventSource = new EventSource('http://localhost:3000/api/stream');

    eventSource.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data);
        setStatus(data);
      } catch (err) {
        console.error('Failed to parse status SSE:', err);
      }
    });

    eventSource.addEventListener('log', (e) => {
      try {
        const data = JSON.parse(e.data);
        
        // Categorize logs for rich UI styling
        let type = 'info';
        if (data.message.startsWith('[Erro')) {
          type = 'error';
        } else if (data.message.startsWith('[Website') || data.message.startsWith('[Robô] Extraindo') || data.message.startsWith('[Robô] Clicando')) {
          type = 'system';
        }

        setLogs((prev) => [
          ...prev, 
          { text: data.message, timestamp: data.timestamp || Date.now(), type }
        ]);
      } catch (err) {
        console.error('Failed to parse log SSE:', err);
      }
    });

    eventSource.addEventListener('lead', (e) => {
      try {
        const newLead = JSON.parse(e.data);
        const cleanLead = sanitizeLead(newLead);
        
        setLeads((prev) => {
          // Prevent duplicates in real time using base64 ID
          if (prev.some((lead) => lead.id === cleanLead.id)) {
            return prev;
          }
          return [cleanLead, ...prev]; // Push newer leads to the top of the feed
        });
      } catch (err) {
        console.error('Failed to parse lead SSE:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.warn('SSE EventSource experienced a network disruption. Automatic reconnect is active.', err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Monospace Terminal Auto-Scroll Effect
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedOpportunity, filterOnlyWithEmail, filterOnlyWithWhatsapp]);

  // --- ACTIONS HANDLERS ---
  const handleStartScrape = async (e) => {
    e.preventDefault();
    if (!niche.trim()) {
      alert('Por favor, informe o nicho de prospecção.');
      return;
    }

    if (status.state === 'running') {
      alert('Já existe uma busca em andamento. Aguarde a finalização ou reinicie.');
      return;
    }

    // Clear previous dashboard logs and reset table to visualize the new search
    setLogs([
      { text: `🔄 Iniciando nova sessão de busca por "${niche}" em "${location || 'global'}"...`, timestamp: Date.now(), type: 'system' }
    ]);
    setLeads([]);
    setSelectedLead(null);
    setCheckedLeadIds([]);

    try {
      const response = await fetch('http://localhost:3000/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          niche,
          location,
          limit: isUnlimited ? 0 : parseInt(limit) || 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao acionar robô.');
      }
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        { text: `[Erro Inicialização] ${err.message}`, timestamp: Date.now(), type: 'error' }
      ]);
      setStatus({ state: 'failed', message: `Erro ao iniciar busca: ${err.message}` });
    }
  };

  const handleCancelScrape = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/cancel', {
        method: 'POST'
      });
      if (response.ok) {
        setLogs((prev) => [
          ...prev,
          { text: '🛑 Cancelamento solicitado pelo usuário...', timestamp: Date.now(), type: 'system' }
        ]);
      }
    } catch (err) {
      console.error('Falha ao cancelar busca:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (checkedLeadIds.length === 0) return;
    if (confirm(`Deseja excluir permanentemente os ${checkedLeadIds.length} leads selecionados do disco?`)) {
      try {
        const response = await fetch('http://localhost:3000/api/leads/bulk-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids: checkedLeadIds })
        });
        if (response.ok) {
          setLeads(prev => prev.filter(l => !checkedLeadIds.includes(l.id)));
          if (selectedLead && checkedLeadIds.includes(selectedLead.id)) {
            setSelectedLead(null);
          }
          setCheckedLeadIds([]);
        } else {
          alert('Falha ao excluir múltiplos leads do servidor.');
        }
      } catch (err) {
        console.error('Erro ao deletar múltiplos leads:', err);
        alert('Erro de conexão ao remover múltiplos leads.');
      }
    }
  };

  // CSV Exporter integrating diagnostic tags with semi-colon separators and UTF-8 BOM
  const handleExportCSV = () => {
    if (leads.length === 0) {
      alert('Nenhum lead disponível para exportação.');
      return;
    }

    // Define CSV Headers in Portuguese for smooth Excel usage
    const headers = [
      'Nome da Empresa',
      'Categoria',
      'Telefone',
      'WhatsApp Ativo',
      'E-mail',
      'Website',
      'Endereço Completo',
      'Latitude',
      'Longitude',
      'Nota Google Maps',
      'Número de Comentários',
      'Diagnóstico de Design',
      'Conexão Segura SSL',
      'Domínio Personalizado',
      'Cores da Marca',
      'Serviços Identificados',
      'Sinais de Oportunidades B2B',
      'Link do Google Maps',
      'Script de Vendas Roteiro'
    ];

    // Build Rows
    const rows = leads.map(lead => {
      const activeWhatsapp = lead.hasWhatsapp ? 'SIM' : 'NÃO';
      const cleanPhone = lead.phone ? lead.phone : '';
      const email = lead.email ? lead.email : '';
      const rating = lead.rating !== null ? lead.rating.toString().replace('.', ',') : 'N/A';
      const reviews = lead.reviewsCount !== null ? lead.reviewsCount : 0;
      
      const designStyle = lead.styleEsthetic || 'Sem Website';
      const secureSSL = lead.website ? (lead.hasSSL ? 'HTTPS (Seguro)' : 'HTTP (Inseguro)') : 'Sem Website';
      const customDomain = lead.website ? (lead.hasCustomDomain ? 'Sim' : 'Não') : 'Sem Website';
      
      const colors = lead.brandColors && lead.brandColors.length > 0 ? lead.brandColors.join(' | ') : '';
      const services = lead.services && lead.services.length > 0 ? lead.services.join('; ') : '';
      const b2bOpportunities = lead.opportunities && lead.opportunities.length > 0 ? lead.opportunities.join('; ') : 'NENHUM';
      
      // Escape script sales pitch content to avoid breaking CSV columns
      const escapedPitch = lead.salesPitch 
        ? `"${lead.salesPitch.replace(/"/g, '""').replace(/\n/g, ' ')}"` 
        : '""';

      return [
        `"${lead.name.replace(/"/g, '""')}"`,
        `"${(lead.category || '').replace(/"/g, '""')}"`,
        `"${cleanPhone}"`,
        `"${activeWhatsapp}"`,
        `"${email}"`,
        `"${(lead.website || '')}"`,
        `"${(lead.address || '').replace(/"/g, '""')}"`,
        lead.latitude !== null ? lead.latitude : '',
        lead.longitude !== null ? lead.longitude : '',
        rating,
        reviews,
        `"${designStyle}"`,
        `"${secureSSL}"`,
        `"${customDomain}"`,
        `"${colors}"`,
        `"${services.replace(/"/g, '""')}"`,
        `"${b2bOpportunities}"`,
        `"${lead.mapsUrl}"`,
        escapedPitch
      ];
    });

    // Compile Content
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    // Create Blob utilizing \uFEFF UTF-8 BOM to resolve Brazilian accents rendering errors in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Format download file name
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `web_leads_${niche.toLowerCase().replace(/\s+/g, '_')}_${timestamp}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- FILTERS LOGIC ---
  const filteredLeads = leads.filter(lead => {
    // 1. Text Search Bar Match (Name, Address, Niche Category)
    const matchesSearch = searchTerm.trim() === '' || 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.address && lead.address.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // 2. Email Mapped Toggle Filter
    const matchesEmail = !filterOnlyWithEmail || !!lead.email;
    
    // 3. WhatsApp Detected Toggle Filter
    const matchesWhatsapp = !filterOnlyWithWhatsapp || lead.hasWhatsapp;
    
    // 4. B2B Opportunity Badge Selector Filter
    const matchesOpportunity = selectedOpportunity === 'ALL' || 
      (lead.opportunities && lead.opportunities.includes(selectedOpportunity));
      
    return matchesSearch && matchesEmail && matchesWhatsapp && matchesOpportunity;
  });

  // --- PAGINATION LOGIC ---
  const totalItems = filteredLeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  return (
    <div className="dashboard-layout">
      {/* --- SIDEBAR --- */}
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="logo-orb"></div>
            <h2>Web Lead <span className="accent">Scraper</span></h2>
          </div>
          
          <nav className="nav-menu">
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Painel Geral
            </button>
            <button 
              className={`nav-item ${activeTab === 'instructions' ? 'active' : ''}`}
              onClick={() => setActiveTab('instructions')}
            >
              📖 Guia de Uso
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <p>Web Lead Scraper</p>
          <span>v1.2.0 • Premium Autopilot</span>
        </div>
      </aside>

      {/* --- MAIN WORKSPACE AREA --- */}
      <main className="main-content">
        
        {/* --- HEADER BLOCK --- */}
        <header className="main-header">
          <div className="header-title">
            <h1>Diagnóstico & Captação de Leads</h1>
            <p className="subtitle">
              Autopilot Inteligente de Prospecção Ativa B2B no Google Maps
            </p>
          </div>
          
          <div className="header-actions">
            {checkedLeadIds.length > 0 && (
              <button 
                className="btn btn-danger"
                onClick={handleBulkDelete}
                style={{ backgroundColor: 'var(--danger)', color: 'white', marginRight: '8px' }}
                title="Excluir todos os leads selecionados"
              >
                🗑️ Deletar Selecionados ({checkedLeadIds.length})
              </button>
            )}
            <button 
              className="btn btn-glass"
              onClick={handleExportCSV}
              disabled={leads.length === 0}
              title="Exporta a planilha estruturada de leads (Excel UTF-8)"
            >
              📥 Exportar Excel (CSV)
            </button>
            {leads.length > 0 && (
              <button 
                className="btn btn-outline-danger"
                onClick={() => {
                  if (confirm('Limpar toda a lista atual de leads?')) {
                    setLeads([]);
                    setSelectedLead(null);
                  }
                }}
              >
                🧹 Limpar Tela
              </button>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <>
            {/* --- TOP STATISTICS COUNTERS GRID --- */}
            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon purple">📊</div>
                <div className="stat-info">
                  <h3>{leads.length}</h3>
                  <p>Leads Coletados</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon green">📧</div>
                <div className="stat-info">
                  <h3>{leads.filter(l => l.email).length}</h3>
                  <p>Emails Capturados</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon blue">💬</div>
                <div className="stat-info">
                  <h3>{leads.filter(l => l.hasWhatsapp).length}</h3>
                  <p>WhatsApp Mapeado</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon orange">🎯</div>
                <div className="stat-info">
                  <h3>{leads.filter(l => l.opportunities && l.opportunities.length > 0).length}</h3>
                  <p>Oportunidades B2B</p>
                </div>
              </div>
            </section>

            {/* --- PANEL GRID (SEARCH CONFIG + HACKER MONITOR) --- */}
            <div className="panel-grid">
              
              {/* Form Config Panel */}
              <form className="search-form-panel" onSubmit={handleStartScrape}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label>Nicho / Palavra-Chave</label>
                    <input 
                      type="text" 
                      value={niche} 
                      onChange={(e) => setNiche(e.target.value)} 
                      placeholder="Ex: Clinica de Estetica, Odontologia"
                      disabled={status.state === 'running'}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Localidade (Cidade/Estado)</label>
                    <input 
                      type="text" 
                      value={location} 
                      onChange={(e) => setLocation(e.target.value)} 
                      placeholder="Ex: Belo Horizonte, SP"
                      disabled={status.state === 'running'}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Limite de Leads</label>
                      <input 
                        type="number" 
                        value={limit} 
                        onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))} 
                        min="1"
                        disabled={status.state === 'running' || isUnlimited}
                      />
                    </div>
                    
                    <label className="checkbox-container">
                      <input 
                        type="checkbox" 
                        checked={isUnlimited}
                        onChange={(e) => setIsUnlimited(e.target.checked)}
                        disabled={status.state === 'running'}
                      />
                      <span className="checkmark"></span>
                      Sem limite
                    </label>
                  </div>
                </div>

                {status.state === 'running' || status.state === 'cancelling' ? (
                  <button 
                    type="button" 
                    className="btn btn-danger"
                    style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
                    onClick={handleCancelScrape}
                    disabled={status.state === 'cancelling'}
                  >
                    {status.state === 'cancelling' ? '🛑 Cancelando...' : '🛑 Cancelar Busca'}
                  </button>
                ) : (
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
                  >
                    🚀 Iniciar Extração
                  </button>
                )}
              </form>

              {/* Monospace Hacker Live Feed Terminal */}
              <div className="terminal-log-container">
                <div className="terminal-header">
                  <span>Robô Status: <strong style={{ color: status.state === 'running' ? '#00ff66' : 'var(--text-muted)' }}>{status.message}</strong></span>
                  <div className="terminal-indicator">
                    <span className={`terminal-led ${status.state === 'running' ? 'pulse' : ''}`}></span>
                    <span>SSE Stream Feed</span>
                  </div>
                </div>

                <div className="terminal-body" ref={terminalBodyRef}>
                  {logs.map((log, idx) => (
                    <div key={idx} className={`terminal-line ${log.type}`}>
                      [{new Date(log.timestamp).toLocaleTimeString()}] {log.text}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* --- FILTERS SECTION --- */}
            <section className="filters-section">
              
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input 
                  type="text" 
                  placeholder="Pesquisar leads filtrando por nome, categoria ou endereço..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="filter-controls">
                <div className="switches-group">
                  <label className="switch-container">
                    <input 
                      type="checkbox" 
                      checked={filterOnlyWithEmail} 
                      onChange={(e) => setFilterOnlyWithEmail(e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    Apenas com E-mail
                  </label>

                  <label className="switch-container">
                    <input 
                      type="checkbox" 
                      checked={filterOnlyWithWhatsapp} 
                      onChange={(e) => setFilterOnlyWithWhatsapp(e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    Apenas com WhatsApp
                  </label>
                </div>
              </div>

              {/* B2B Opportunities Badges filters */}
              <div className="b2b-opportunity-bar">
                <div className="opportunity-title">Filtrar por Sinais B2B Diagnosticados</div>
                <div className="opportunity-filters-container">
                  <button 
                    className={`filter-badge-btn ${selectedOpportunity === 'ALL' ? 'active' : ''}`}
                    onClick={() => setSelectedOpportunity('ALL')}
                  >
                    🔍 Todos os Leads ({leads.length})
                  </button>
                  <button 
                    className={`filter-badge-btn ${selectedOpportunity === 'SEM_SITE' ? 'active' : ''}`}
                    data-opportunity="SEM_SITE"
                    onClick={() => setSelectedOpportunity('SEM_SITE')}
                  >
                    ⚠️ Sem Website ({leads.filter(l => l.opportunities && l.opportunities.includes('SEM_SITE')).length})
                  </button>
                  <button 
                    className={`filter-badge-btn ${selectedOpportunity === 'REDE_SOCIAL_COMO_SITE' ? 'active' : ''}`}
                    data-opportunity="REDE_SOCIAL_COMO_SITE"
                    onClick={() => setSelectedOpportunity('REDE_SOCIAL_COMO_SITE')}
                  >
                    📱 Apenas Rede Social ({leads.filter(l => l.opportunities && l.opportunities.includes('REDE_SOCIAL_COMO_SITE')).length})
                  </button>
                  <button 
                    className={`filter-badge-btn ${selectedOpportunity === 'WHATSAPP_LINK_COMO_SITE' ? 'active' : ''}`}
                    data-opportunity="WHATSAPP_LINK_COMO_SITE"
                    onClick={() => setSelectedOpportunity('WHATSAPP_LINK_COMO_SITE')}
                  >
                    💬 Apenas Link WhatsApp ({leads.filter(l => l.opportunities && l.opportunities.includes('WHATSAPP_LINK_COMO_SITE')).length})
                  </button>
                  <button 
                    className={`filter-badge-btn ${selectedOpportunity === 'DOMINIO_GRATUITO' ? 'active' : ''}`}
                    data-opportunity="DOMINIO_GRATUITO"
                    onClick={() => setSelectedOpportunity('DOMINIO_GRATUITO')}
                  >
                    🏷️ Domínio Gratuito ({leads.filter(l => l.opportunities && l.opportunities.includes('DOMINIO_GRATUITO')).length})
                  </button>
                  <button 
                    className={`filter-badge-btn ${selectedOpportunity === 'SEM_SSL' ? 'active' : ''}`}
                    data-opportunity="SEM_SSL"
                    onClick={() => setSelectedOpportunity('SEM_SSL')}
                  >
                    🔒 Sem SSL Seguro ({leads.filter(l => l.opportunities && l.opportunities.includes('SEM_SSL')).length})
                  </button>
                  <button 
                    className={`filter-badge-btn ${selectedOpportunity === 'FALTA_WHATSAPP' ? 'active' : ''}`}
                    data-opportunity="FALTA_WHATSAPP"
                    onClick={() => setSelectedOpportunity('FALTA_WHATSAPP')}
                  >
                    💬 Sem WhatsApp Flutuante ({leads.filter(l => l.opportunities && l.opportunities.includes('FALTA_WHATSAPP')).length})
                  </button>
                  <button 
                    className={`filter-badge-btn ${selectedOpportunity === 'REPUTACAO_BAIXA' ? 'active' : ''}`}
                    data-opportunity="REPUTACAO_BAIXA"
                    onClick={() => setSelectedOpportunity('REPUTACAO_BAIXA')}
                  >
                    ⭐ Baixa Reputação ({leads.filter(l => l.opportunities && l.opportunities.includes('REPUTACAO_BAIXA')).length})
                  </button>
                </div>
              </div>

            </section>

            {/* --- LEADS GRID TABLE SECTION --- */}
            <section className="table-section">
              <div className="table-responsive">
                <table className="leads-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={paginatedLeads.length > 0 && paginatedLeads.every(l => checkedLeadIds.includes(l.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const pageIds = paginatedLeads.map(l => l.id);
                              setCheckedLeadIds(prev => {
                                const newSelection = [...prev];
                                pageIds.forEach(id => {
                                  if (!newSelection.includes(id)) newSelection.push(id);
                                });
                                return newSelection;
                              });
                            } else {
                              const pageIds = paginatedLeads.map(l => l.id);
                              setCheckedLeadIds(prev => prev.filter(id => !pageIds.includes(id)));
                            }
                          }}
                        />
                      </th>
                      <th>Empresa / Endereço</th>
                      <th>Categoria</th>
                      <th>Contato</th>
                      <th>Avaliação</th>
                      <th>Sinais de Oportunidade B2B</th>
                      <th>Redes Sociais</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLeads.length > 0 ? (
                      paginatedLeads.map((lead) => (
                        <tr 
                          key={lead.id} 
                          onClick={(e) => {
                            if (e.target.closest('a') || e.target.closest('button') || e.target.closest('input[type="checkbox"]')) return;
                            setSelectedLead(lead);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={checkedLeadIds.includes(lead.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCheckedLeadIds(prev => [...prev, lead.id]);
                                } else {
                                  setCheckedLeadIds(prev => prev.filter(id => id !== lead.id));
                                }
                              }}
                            />
                          </td>
                          {/* Company info cell with avatar and coordinates clicker */}
                          <td>
                            <div className="company-info-cell">
                              <div className="company-avatar-container" onClick={() => setSelectedLead(lead)}>
                                <img 
                                  className="company-avatar" 
                                  src={lead.imageUrl || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%2312121c'/><circle cx='50' cy='35' r='18' fill='%236432ff'/><path d='M20,80 Q50,45 80,80' fill='none' stroke='%236432ff' stroke-width='6' stroke-linecap='round'/></svg>"} 
                                  alt={lead.name} 
                                  onError={(e) => {
                                    e.target.onerror = null; // Break potential infinite loading loops
                                    e.target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%2312121c'/><circle cx='50' cy='35' r='18' fill='%236432ff'/><path d='M20,80 Q50,45 80,80' fill='none' stroke='%236432ff' stroke-width='6' stroke-linecap='round'/></svg>";
                                  }}
                                />
                                {lead.photos && lead.photos.length > 0 && (
                                  <span className="company-photos-badge">+{lead.photos.length}</span>
                                )}
                              </div>
                              <div>
                                <a 
                                  className="company-link" 
                                  href={lead.mapsUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  title="Clique para abrir no Google Maps"
                                >
                                  📍 {lead.name}
                                </a>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  {lead.address || 'Sem endereço disponível'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td>
                            <span className="cat-badge">{lead.category || 'Negócio'}</span>
                          </td>

                          {/* Contact Methods Cell */}
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {lead.phone ? (
                                <a 
                                  className="table-link" 
                                  href={lead.hasWhatsapp ? `https://wa.me/${lead.phone.replace(/\D/g, '')}` : `tel:${lead.phone}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '0.82rem' }}
                                >
                                  📞 {lead.phone} {lead.hasWhatsapp && <span style={{ color: '#00ff66', fontWeight: 600 }}>[Whats]</span>}
                                </a>
                              ) : (
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sem Telefone</span>
                              )}
                              
                              {lead.email ? (
                                <a 
                                  className="table-link" 
                                  href={`mailto:${lead.email}`} 
                                  style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}
                                >
                                  ✉️ {lead.email}
                                </a>
                              ) : (
                                lead.website ? (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email não encontrado</span>
                                ) : null
                              )}
                            </div>
                          </td>

                          {/* Rating score matching Google Maps with Brazilian localization */}
                          <td>
                            <div className="rating-info">
                              <span className="rating-star">⭐</span>
                              <span className="rating-score">
                                {lead.rating !== null ? lead.rating.toFixed(1) : 'N/A'}
                              </span>
                              <span className="rating-count">({lead.reviewsCount || 0})</span>
                            </div>
                          </td>

                          {/* Opportunity Diagnostics Badge list */}
                          <td>
                            <div className="opportunities-list">
                              {lead.opportunities && lead.opportunities.length > 0 ? (
                                lead.opportunities.map((opp) => (
                                  <span 
                                    key={opp} 
                                    className={`badge-opportunity ${
                                      opp === 'REDE_SOCIAL_COMO_SITE' ? 'dominio_gratuito' : 
                                      opp === 'WHATSAPP_LINK_COMO_SITE' ? 'sem_site' : 
                                      opp.toLowerCase()
                                    }`}
                                  >
                                    {opp === 'SEM_SITE' && '⚠️ Sem Website'}
                                    {opp === 'REDE_SOCIAL_COMO_SITE' && '📱 Usa Apenas Rede Social'}
                                    {opp === 'WHATSAPP_LINK_COMO_SITE' && '💬 Usa Apenas WhatsApp Link'}
                                    {opp === 'DOMINIO_GRATUITO' && '🏷️ Domínio Gratuito'}
                                    {opp === 'SEM_SSL' && '🔒 Inseguro (Falta SSL)'}
                                    {opp === 'FALTA_WHATSAPP' && '💬 Sem WhatsApp flutuante'}
                                    {opp === 'REPUTACAO_BAIXA' && '⭐ Baixa Reputação (<4.2)'}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#2ecc71', fontSize: '0.78rem', fontWeight: 600 }}>🟢 Perfil Saudável</span>
                              )}
                            </div>
                          </td>

                          {/* Scraped Social Badges list */}
                          <td>
                            <div className="social-icons-container">
                              {lead.socials && Object.keys(lead.socials).some(k => lead.socials[k]) ? (
                                Object.entries(lead.socials).map(([platform, url]) => {
                                  if (!url) return null;
                                  return (
                                    <a 
                                      key={platform} 
                                      className={`social-badge ${platform}`} 
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      title={`Visitar ${platform.charAt(0).toUpperCase() + platform.slice(1)}`}
                                    >
                                      {platform.substring(0, 2).toUpperCase()}
                                    </a>
                                  );
                                })
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                              )}
                            </div>
                          </td>

                          {/* Actions Delete cell */}
                          <td>
                            <button 
                              className="btn-delete"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Deseja excluir o lead "${lead.name}" permanentemente do disco?`)) {
                                  try {
                                    const response = await fetch(`http://localhost:3000/api/leads/${encodeURIComponent(lead.id)}`, { method: 'DELETE' });
                                    if (response.ok) {
                                      setLeads(prev => prev.filter(l => l.id !== lead.id));
                                      if (selectedLead && selectedLead.id === lead.id) {
                                        setSelectedLead(null);
                                      }
                                    } else {
                                      alert('Falha ao deletar lead da persistência local.');
                                    }
                                  } catch (err) {
                                    console.error('Erro ao deletar lead:', err);
                                    alert('Erro de conexão ao remover o lead.');
                                  }
                                }
                              }}
                              title="Remover Lead"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="empty-state">
                          <div className="empty-icon">📂</div>
                          <p>Nenhum lead encontrado com os filtros atuais.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* --- PAGINATION CONTROLS BAR --- */}
              {totalPages > 1 && (
                <div className="pagination">
                  <div className="pagination-info">
                    Mostrando <span>{startIndex + 1}</span>-<span>{endIndex}</span> de <span>{totalItems}</span> leads
                  </div>
                  
                  <div className="pagination-controls">
                    <button 
                      className="btn-pag" 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={validCurrentPage === 1}
                    >
                      ◀ Anterior
                    </button>
                    
                    <span className="page-num">{validCurrentPage}</span>
                    
                    <button 
                      className="btn-pag" 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={validCurrentPage === totalPages}
                    >
                      Próxima ▶
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          /* --- INSTRUCTIONS / DOCUMENTATION TAB --- */
          <section className="filters-section" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              Guia Completo do Web Lead Scraper
            </h2>
            
            <div style={{ lineHeight: '1.6', fontSize: '0.92rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p>
                Bem-vindo ao <strong>Web Lead Scraper</strong>, uma solução robusta e independente para captação B2B inteligente e análise de design de marcas em piloto automático.
              </p>
              
              <h3 style={{ marginTop: '10px' }}>🚀 Como Funciona a Operação:</h3>
              <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>
                  <strong>Autopilot Search:</strong> O robô aciona uma instância isolada do navegador Chromium em segundo plano no servidor (usando Puppeteer). Ele faz buscas complexas de nicho e rola os resultados no Maps de forma resiliente, burlando as restrições normais de throttling de extensões de navegador convencionais.
                </li>
                <li>
                  <strong>Website Brand Crawler & Diagnostics:</strong> Sempre que um lead possui um website oficial, o robô o abre silenciosamente e realiza uma análise em tempo real do DOM e dos estilos computados via CSS para identificar a paleta de cores institucional da marca, além de avaliar a responsividade de layout.
                </li>
                <li>
                  <strong>Detecção de Falhas Comerciais (Sinais B2B):</strong> O sistema cataloga oportunidades comerciais valiosas, como ausência de site, conexões HTTP inseguras sem certificado SSL, ou ausência de link ou robô WhatsApp flutuante na página.
                </li>
                <li>
                  <strong>AI Outreach Sales Pitch:</strong> A partir de todos os pontos fracos detectados (sinais B2B) e das informações da marca coletadas (cores, serviços, categoria), a engine gera automaticamente um roteiro persuasivo pronto para WhatsApp e Cold Mail.
                </li>
                <li>
                  <strong>Gestão e Exclusão em Massa (Bulk Delete):</strong> Marque as caixas de seleção na extrema esquerda dos leads desejados ou utilize o checkbox mestre no cabeçalho da tabela para selecionar todos da página atual. Um botão dinâmico aparecerá no cabeçalho permitindo deletá-los permanentemente do banco SQLite de uma só vez.
                </li>
              </ol>

              <h3 style={{ marginTop: '10px' }}>💡 Dicas de Sucesso para Abordagem:</h3>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', listStyleType: 'square' }}>
                <li>
                  <strong>Use o filtro "Sem Website":</strong> Aborde essas empresas no WhatsApp oferecendo um protótipo com os serviços extraídos. Esse é o lead com a maior taxa de conversão direta.
                </li>
                <li>
                  <strong>Segurança SSL (HTTPS):</strong> Avise a empresa sobre a mensagem vermelha de "Site Não Seguro" no Chrome. Isso gera reciprocidade imediata porque afeta a credibilidade do cliente deles.
                </li>
                <li>
                  <strong>Paleta de Cores Swatch:</strong> No painel lateral de detalhes de qualquer lead, clique nas cores detectadas para copiar instantaneamente o código HEX para o seu Figma/Photoshop e crie mockups ultra-personalizados em minutos!
                </li>
              </ul>
            </div>
          </section>
        )}

      </main>

      {/* --- SLIDING DETAILS DRAWER OVERLAY (DRAWER) --- */}
      <div className={`details-drawer ${selectedLead ? 'open' : ''}`}>
        {selectedLead && (
          <>
            <div className="drawer-header">
              <div>
                <h2>{selectedLead.name}</h2>
                <span className="cat-badge" style={{ marginTop: '6px', fontSize: '0.72rem' }}>
                  {selectedLead.category || 'Categoria não informada'}
                </span>
              </div>
              <button 
                className="close-drawer-btn" 
                onClick={() => setSelectedLead(null)}
                title="Fechar Painel"
              >
                &times;
              </button>
            </div>

            <div className="drawer-body">
              
              {/* Maps Photos Gallery Row */}
              {selectedLead.photos && selectedLead.photos.length > 0 && (
                <div>
                  <div className="drawer-section-title">Imagens Coletadas ({selectedLead.photos.length})</div>
                  <div className="gallery-wrapper">
                    {selectedLead.photos.map((src, i) => (
                      <div key={i} className="gallery-image-card">
                        <img 
                          src={src} 
                          alt={`Lead Foto ${i}`} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand Swatch Circle Palette */}
              <div>
                <div className="drawer-section-title">Identidade Visual da Marca (Cores)</div>
                {selectedLead.brandColors && selectedLead.brandColors.length > 0 ? (
                  <div className="brand-colors-container">
                    {selectedLead.brandColors.map((color, i) => (
                      <div 
                        key={i} 
                        className="color-swatch-circle" 
                        style={{ backgroundColor: color }}
                        title={`Clique para copiar HEX: ${color}`}
                        onClick={() => {
                          navigator.clipboard.writeText(color);
                          alert(`Cor HEX ${color} copiada para a área de transferência!`);
                        }}
                      />
                    ))}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      Clique no círculo para copiar o HEX.
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Nenhuma paleta mapeada (ausência de website ou cores personalizadas).
                  </div>
                )}
              </div>

              {/* B2B Opportunity Diagnostic list */}
              <div>
                <div className="drawer-section-title">Diagnóstico de Presença & Design</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="diagnostic-card">
                    <span className="diagnostic-label">Usabilidade do Website</span>
                    <span 
                      className="diagnostic-value" 
                      style={{ color: selectedLead.styleEsthetic.includes('Moderno') ? '#00ff66' : 'var(--danger)' }}
                    >
                      {selectedLead.styleEsthetic}
                    </span>
                  </div>

                  <div className="diagnostic-card">
                    <span className="diagnostic-label">Criptografia SSL (HTTPS)</span>
                    <span 
                      className="diagnostic-value" 
                      style={{ color: selectedLead.website ? (selectedLead.hasSSL ? '#00ff66' : 'var(--danger)') : 'var(--text-muted)' }}
                    >
                      {selectedLead.website ? (selectedLead.hasSSL ? 'Segura (Ativa)' : 'Insegura (HTTP)') : 'Sem Website'}
                    </span>
                  </div>

                  <div className="diagnostic-card">
                    <span className="diagnostic-label">Domínio Próprio</span>
                    <span 
                      className="diagnostic-value" 
                      style={{ color: selectedLead.website ? (selectedLead.hasCustomDomain ? '#00ff66' : 'var(--accent)') : 'var(--text-muted)' }}
                    >
                      {selectedLead.website ? (selectedLead.hasCustomDomain ? 'Sim (Comercial)' : 'Não (Plataforma Gratuita)') : 'Sem Website'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scraped Services badging tags */}
              <div>
                <div className="drawer-section-title">Especialidades & Serviços Mapeados</div>
                {selectedLead.services && selectedLead.services.length > 0 ? (
                  <div className="services-list-tags">
                    {selectedLead.services.map((service, idx) => (
                      <span key={idx} className="service-tag">{service}</span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Nenhum serviço capturado nos cabeçalhos da página.
                  </div>
                )}
              </div>

              {/* Outreach Copywriting Sales proposal Pitch */}
              <div>
                <div className="drawer-section-title">Roteiro Persuasivo de Abordagem B2B</div>
                <div className="pitch-box-container">
                  {selectedLead.salesPitch}
                </div>
                
                <button 
                  className="btn btn-primary"
                  style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    navigator.clipboard.writeText(selectedLead.salesPitch);
                    alert('Roteiro copiado com sucesso! Já pode colar no WhatsApp do Lead.');
                  }}
                >
                  📋 Copiar Roteiro de Abordagem
                </button>
              </div>

            </div>

            {/* Bottom Swiping external links */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '15px', marginTop: '10px', display: 'flex', gap: '10px' }}>
              {selectedLead.website && (
                <a 
                  className="btn btn-glass flex-1"
                  href={selectedLead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', justifyContent: 'center' }}
                >
                  🔗 Acessar Website
                </a>
              )}
              <a 
                className="btn btn-glass flex-1"
                href={selectedLead.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', justifyContent: 'center' }}
              >
                📍 Ver no Google Maps
              </a>
            </div>
          </>
        )}
      </div>

    </div>
  );
}

export default App;
