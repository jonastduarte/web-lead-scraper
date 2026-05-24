// Puppeteer B2B Scraper & Brand Diagnostic Engine - G-Maps Scraper Web App
import puppeteer from 'puppeteer';
import fs from 'fs';


// Helper function to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Extract coordinates from Google Maps URLs
const getCoordinatesFromUrl = (url) => {
  if (!url) return { lat: null, lng: null };
  const urlMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (urlMatch) {
    return { lat: parseFloat(urlMatch[1]), lng: parseFloat(urlMatch[2]) };
  }
  const detailMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (detailMatch) {
    return { lat: parseFloat(detailMatch[1]), lng: parseFloat(detailMatch[2]) };
  }
  return { lat: null, lng: null };
};

// Website crawl analyzer (runs inside Puppeteer on a separate tab for maximum brand details!)
const analyzeCompanyWebsite = async (browser, url, logProgress) => {
  const result = {
    email: '',
    hasWhatsapp: false,
    socials: { facebook: '', instagram: '', linkedin: '', youtube: '', twitter: '', tiktok: '' },
    brandColors: [],
    styleEsthetic: 'Sem Website',
    services: [],
    hasSSL: false,
    hasCustomDomain: false
  };

  if (!url || url.trim() === '') return result;

  let page = null;
  try {
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'http://' + targetUrl;
    }

    result.hasSSL = targetUrl.toLowerCase().startsWith('https://');
    
    // Check Custom Domain
    const webLower = targetUrl.toLowerCase();
    const freePlatforms = [
      'facebook.com', 'instagram.com', 'wixsite.com', 'wordpress.com', 
      'blogspot.com', 'github.io', 'pages.dev', 'linkedin.com', 'youtube.com'
    ];
    result.hasCustomDomain = !freePlatforms.some(platform => webLower.includes(platform));

    logProgress(`[Website Analisador] Acessando website para diagnóstico estético: ${targetUrl}`);

    page = await browser.newPage();
    // Block images and stylesheets that are not needed to speed up load, but we DO need styles for colors!
    // So we just block heavy media loads
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 1. Email extraction from DOM text
    logProgress(`[Website Analisador] Buscando emails e redes sociais...`);
    const htmlText = await page.content();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/gi;
    const matches = htmlText.match(emailRegex) || [];
    const uniqueEmails = Array.from(new Set(matches.map(e => e.toLowerCase())))
      .filter(email => {
        const badDomains = ['w3.org', 'example.com', 'sentry.io', 'domain.com', 'yourdomain.com', 'google.com', 'core.js', 'jquery.com'];
        const badExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
        return !badDomains.some(d => email.includes(d)) && !badExtensions.some(ext => email.endsWith(ext));
      });
    if (uniqueEmails.length > 0) {
      result.email = uniqueEmails[0];
    }

    // 2. Scan links for socials & WhatsApp
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(href => href && href.startsWith('http'));
    });

    links.forEach(href => {
      const hrefLower = href.toLowerCase();
      if (hrefLower.includes('wa.me') || 
          hrefLower.includes('api.whatsapp.com') || 
          hrefLower.includes('web.whatsapp.com') ||
          hrefLower.includes('whatsapp.com/send')) {
        result.hasWhatsapp = true;
      }

      if (hrefLower.includes('facebook.com') && !result.socials.facebook) result.socials.facebook = href;
      else if (hrefLower.includes('instagram.com') && !result.socials.instagram) result.socials.instagram = href;
      else if (hrefLower.includes('linkedin.com') && !result.socials.linkedin) result.socials.linkedin = href;
      else if (hrefLower.includes('youtube.com') && !result.socials.youtube) result.socials.youtube = href;
      else if ((hrefLower.includes('twitter.com') || hrefLower.includes('x.com')) && !result.socials.twitter) result.socials.twitter = href;
      else if (hrefLower.includes('tiktok.com') && !result.socials.tiktok) result.socials.tiktok = href;
    });

    // 3. Brand Colors Extraction (Hex CSS Analyzer!)
    logProgress(`[Website Analisador] Analisando paleta de cores da marca...`);
    result.brandColors = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('h1, h2, h3, button, a, header, nav, [class*="btn"], [class*="button"]'));
      const hexColors = new Set();
      
      const rgbToHex = (rgb) => {
        const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!match) return null;
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      };

      elements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const bg = styles.backgroundColor;
        const fg = styles.color;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          const hex = rgbToHex(bg);
          // Filter out black, white, and greys
          if (hex && hex !== '#ffffff' && hex !== '#000000' && !hex.match(/#([a-f0-9])\1\1\1\1\1/i)) {
            hexColors.add(hex);
          }
        }
        if (fg && fg !== 'rgba(0, 0, 0, 0)' && fg !== 'transparent') {
          const hex = rgbToHex(fg);
          if (hex && hex !== '#ffffff' && hex !== '#000000' && !hex.match(/#([a-f0-9])\1\1\1\1\1/i)) {
            hexColors.add(hex);
          }
        }
      });
      
      return Array.from(hexColors).slice(0, 4); // Top 4 HEX colors
    });

    // 4. Page Esthetic and Layout Diagnostic
    logProgress(`[Website Analisador] Avaliando usabilidade e estilo de layout...`);
    const estheticData = await page.evaluate(() => {
      const hasViewport = !!document.querySelector('meta[name="viewport"]');
      const usesTableLayout = document.querySelectorAll('table[width], table[align], table td[width]').length > 1;
      
      // Check if modern CSS flex/grid is computably active
      const hasFlexOrGrid = Array.from(document.querySelectorAll('*')).slice(0, 50).some(el => {
        const display = window.getComputedStyle(el).display;
        return display === 'flex' || display === 'grid';
      });

      const bodyFont = window.getComputedStyle(document.body).fontFamily.toLowerCase();
      const hasOldFonts = bodyFont.includes('times') || bodyFont.includes('georgia') || bodyFont.includes('serif');

      let style = 'Moderno';
      if (!hasViewport) {
        style = 'Não Responsivo (Mobile Incompatível!)';
      } else if (usesTableLayout || (hasOldFonts && !hasFlexOrGrid)) {
        style = 'Desatualizado (Necessita de Redesenho!)';
      } else {
        style = 'Moderno & Responsivo';
      }

      return style;
    });
    result.styleEsthetic = estheticData;

    // 5. Parse services offered (identifying services subpages if available for maximum coverage!)
    logProgress(`[Website Analisador] Identificando links para subpáginas de serviços...`);
    const servicesSubpageUrl = await page.evaluate((baseUrl) => {
      const links = Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(href => href && href.startsWith('http'));
      
      const keywords = ['servico', 'servico', 'treatment', 'tratamento', 'especialid', 'specialt', 'o-que-fazemos', 'nossos', 'procediment', 'service'];
      
      const cleanBase = baseUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      const sameDomainLinks = links.filter(href => {
        const cleanHref = href.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        return cleanHref === cleanBase;
      });
      
      return sameDomainLinks.find(href => {
        const hrefLower = href.toLowerCase();
        return keywords.some(kw => hrefLower.includes(kw));
      });
    }, targetUrl);

    let servicesPage = null;

    if (servicesSubpageUrl && servicesSubpageUrl !== targetUrl) {
      logProgress(`[Website Analisador] Encontrada subpágina de serviços: ${servicesSubpageUrl}. Acessando...`);
      try {
        servicesPage = await browser.newPage();
        await servicesPage.setRequestInterception(true);
        servicesPage.on('request', (req) => {
          const type = req.resourceType();
          if (type === 'image' || type === 'media' || type === 'font') {
            req.abort();
          } else {
            req.continue();
          }
        });
        await servicesPage.goto(servicesSubpageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      } catch (err) {
        console.error(`[B2B Crawler] Falha ao acessar subpágina de serviços ${servicesSubpageUrl}:`, err.message);
      }
    }

    logProgress(`[Website Analisador] Mapeando serviços prestados no site...`);
    const activePageForServices = servicesPage || page;
    result.services = await activePageForServices.evaluate(() => {
      const foundServices = [];
      const serviceKeywords = [
        'serviço', 'servicos', 'tratamento', 'nossos', 'fazemos', 'especialidade', 
        'produtos', 'atuação', 'areas', 'procedimento', 'especialidades', 'tratamentos', 'services'
      ];
      
      const popularNicheTerms = [
        'botox', 'preenchimento', 'peeling', 'limpeza de pele', 'depilação', 'drenagem', 
        'criolipólise', 'harmonização', 'microagulhamento', 'massagem', 'lipocavitação', 'estética',
        'implante', 'clareamento', 'ortodontia', 'aparelho', 'canal', 'prótese', 'restauração',
        'trabalhista', 'previdenciário', 'família', 'tributário', 'civil', 'penal', 'inventário',
        'corte', 'escova', 'manicure', 'pedicure', 'sobrancelha', 'coloração',
        'banho', 'tosa', 'veterinário', 'vacina',
        'alinhamento', 'balanceamento', 'mecânica', 'lanternagem', 'pintura', 'conserto'
      ];

      const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, li, a, span, p'));
      elements.forEach(el => {
        const text = el.textContent.trim().replace(/\s+/g, ' ');
        if (text.length > 3 && text.length < 40) {
          const textLower = text.toLowerCase();
          const parentText = (el.parentElement?.textContent || '').toLowerCase();
          const matchesSectionKeyword = serviceKeywords.some(kw => parentText.includes(kw));
          const matchesPopularTerm = popularNicheTerms.some(term => textLower.includes(term));
          
          const isBadWord = textLower.includes('menu') || 
                            textLower.includes('contato') || 
                            textLower.includes('home') ||
                            textLower.includes('sobre') ||
                            textLower.includes('politica') ||
                            textLower.includes('privacidade') ||
                            textLower.includes('direito') ||
                            textLower.includes('termos') ||
                            textLower.includes('todos os');
          
          if ((matchesSectionKeyword || matchesPopularTerm) && !isBadWord) {
            foundServices.push(text);
          }
        }
      });

      if (foundServices.length < 3) {
        const listItems = Array.from(document.querySelectorAll('li, h3, h4'));
        listItems.forEach(item => {
          const text = item.textContent.trim().replace(/\s+/g, ' ');
          if (text.length > 3 && text.length < 30) {
            const textLower = text.toLowerCase();
            const isServiceLike = textLower.includes('·') || 
                                  textLower.includes('- ') || 
                                  popularNicheTerms.some(term => textLower.includes(term));
            
            const isBadWord = textLower.includes('menu') || 
                              textLower.includes('contato') || 
                              textLower.includes('home') ||
                              textLower.includes('blog') ||
                              textLower.includes('sobre');
                              
            if (isServiceLike && !isBadWord) {
              foundServices.push(text);
            }
          }
        });
      }

      const cleanList = foundServices
        .map(s => s.replace(/^[•\-\*·\s]+/, '').trim())
        .filter(s => s.length > 3 && s.length < 35);
        
      return Array.from(new Set(cleanList)).slice(0, 10);
    });

    if (servicesPage) {
      await servicesPage.close();
    }

  } catch (err) {
    console.error(`[B2B Crawler] Falha ao crawling do site ${url}:`, err.message);
  } finally {
    if (page) await page.close();
  }

  return result;
};

// Intelligent Website Classifier Helper
const classifyWebsiteType = (websiteUrl) => {
  if (!websiteUrl || websiteUrl.trim() === '') {
    return 'SEM_SITE';
  }
  
  const urlLower = websiteUrl.toLowerCase();
  
  // 1. WhatsApp Link
  if (urlLower.includes('wa.me') || 
      urlLower.includes('api.whatsapp.com') || 
      urlLower.includes('whatsapp.com/send')) {
    return 'WHATSAPP_LINK';
  }
  
  // 2. Social Media Links
  const socialDomains = [
    'facebook.com', 'fb.com', 'instagram.com', 'instagr.am', 
    'linkedin.com', 'youtube.com', 'youtu.be', 'twitter.com', 
    'x.com', 'tiktok.com', 'linktr.ee', 'linktree'
  ];
  if (socialDomains.some(domain => urlLower.includes(domain))) {
    return 'REDE_SOCIAL_APENAS';
  }
  
  // 3. Free platforms / Third-party subdomains
  const freeSubdomains = [
    'wixsite.com', 'wordpress.com', 'blogspot.com', 'github.io', 
    'pages.dev', 'webflow.io', 'carrd.co', 'canva.site', 'site123.me',
    'jimdofree.com', 'weebly.com'
  ];
  if (freeSubdomains.some(domain => urlLower.includes(domain))) {
    return 'DOMINIO_TERCEIROS';
  }
  
  return 'DOMINIO_PROPRIO';
};

// Main Scraper Function
export const runScrape = async (niche, location, limit = 50, onProgress, onLead, existingIds, isCancelled) => {
  let browser = null;
  let activeTab = null;

  const log = (msg) => {
    console.log(msg);
    if (onProgress) onProgress(msg);
  };

  try {
    log(`[Robô] Inicializando Puppeteer Chromium...`);
    
    let launchOptions = {
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // lower memory usage
        '--disable-gpu'
      ]
    };

    // System-wide paths for Chromium/Chrome on Linux/Unix
    const possibleSystemPaths = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome-unstable'
    ];

    let foundSystemPath = null;
    for (const sysPath of possibleSystemPaths) {
      try {
        if (fs.existsSync(sysPath)) {
          foundSystemPath = sysPath;
          break;
        }
      } catch (e) {
        // Ignore errors checking paths
      }
    }

    if (process.arch === 'arm64' || process.arch === 'arm') {
      log(`[Robô] Detectada arquitetura ARM/ARM64 (${process.arch}).`);
      if (foundSystemPath) {
        log(`[Robô] Redirecionando Puppeteer para usar o Chromium nativo do sistema: ${foundSystemPath}`);
        launchOptions.executablePath = foundSystemPath;
      } else {
        log(`[Robô] AVISO: Executando em ARM, mas nenhuma instalação nativa do Chromium foi encontrada nos caminhos padrão.`);
      }
    }

    try {
      browser = await puppeteer.launch(launchOptions);
    } catch (launchErr) {
      log(`[Robô] Falha crítica ao iniciar com o Chromium padrão do Puppeteer: ${launchErr.message}`);
      if (foundSystemPath && launchOptions.executablePath !== foundSystemPath) {
        log(`[Robô] [Auto-Heal] Tentando recuperar usando o Chromium nativo detectado em: ${foundSystemPath}...`);
        try {
          launchOptions.executablePath = foundSystemPath;
          browser = await puppeteer.launch(launchOptions);
          log(`[Robô] [Auto-Heal] Recuperado com sucesso! Puppeteer rodando via Chromium do sistema.`);
        } catch (retryErr) {
          log(`[Robô] [Auto-Heal] Falha ao iniciar também com Chromium do sistema: ${retryErr.message}`);
          throw launchErr;
        }
      } else {
        throw launchErr;
      }
    }


    activeTab = await browser.newPage();
    await activeTab.setViewport({ width: 1200, height: 900 });
    
    // Set modern desktop User Agent to prevent Google Maps from forcing Limited View / Lite Mode without reviews
    await activeTab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const query = encodeURIComponent(`${niche}${location ? " " + location : ""}`);
    const mapsUrl = `https://www.google.com/maps/search/${query}`;

    log(`[Robô] Acessando Google Maps: ${mapsUrl}`);
    await activeTab.goto(mapsUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    let leadsCount = 0;
    let consecutiveEmptyScrolls = 0;
    const maxEmptyScrolls = 15;
    const processedUrls = new Set();

    while (leadsCount < limit || limit === 0) {
      if (isCancelled && isCancelled()) {
        log(`[Robô] Busca cancelada pelo usuário. Encerrando raspagem.`);
        break;
      }
      log(`[Robô] Verificando feed de resultados... leads coletados: ${leadsCount}/${limit}`);

      // Evaluate visible results list cards and pre-parse rating/reviews in real-time
      const listCardsData = await activeTab.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('div[role="article"], div[class*="m6C1Sd"]'));
        return cards.map(card => {
          const link = card.querySelector('a[href*="/maps/place/"]');
          if (!link) return null;
          
          const text = card.textContent || '';
          let rating = null;
          let reviewsCount = 0;
          
          // Regex matching rating and reviews (e.g. "4,9(105)" or "5,0(10)" or "4.9(1,2 mil)")
          const match = text.match(/([1-5][.,]\d)\s*\(([\d.,\s\w]+)\)/);
          if (match) {
            rating = parseFloat(match[1].replace(',', '.'));
            const raw = match[2].toLowerCase();
            if (raw.includes('mil') || raw.includes('k')) {
              const floatMatch = raw.match(/(\d+([.,]\d+)?)/);
              if (floatMatch) {
                reviewsCount = Math.round(parseFloat(floatMatch[1].replace(',', '.')) * 1000);
              }
            } else {
              reviewsCount = parseInt(raw.replace(/\./g, '').replace(/,/g, '').trim()) || 0;
            }
          }
          
          return {
            url: link.href,
            rating,
            reviewsCount
          };
        }).filter(item => item !== null);
      });

      const cardUrls = listCardsData.map(item => item.url);

      const unvisitedUrls = cardUrls.filter(url => {
        const cleanUrl = url.split('/@')[0];
        return !processedUrls.has(cleanUrl);
      });

      log(`[Robô] Encontrados no feed: ${cardUrls.length} | Pendentes de processar: ${unvisitedUrls.length}`);

      if (unvisitedUrls.length === 0) {
        // Scroll the feed to trigger lazy load
        log(`[Robô] Rolando barra lateral para carregar mais leads...`);
        const scrollStatus = await activeTab.evaluate(() => {
          let feed = document.querySelector('div[role="feed"]');
          if (!feed) {
            const card = document.querySelector('a[href*="/maps/place/"]');
            if (card) feed = card.closest('div[class*="m6C1Sd"]') || card.parentElement;
          }
          if (feed) {
            feed.scrollBy(0, 1000);
            
            // Check end of list text banner
            const pageEnd = Array.from(document.querySelectorAll('span')).find(el => 
              el.textContent.includes('Você chegou ao fim da lista') || 
              el.textContent.includes('End of list')
            );
            const isAtBottom = Math.abs(feed.scrollHeight - feed.scrollTop - feed.clientHeight) < 25;
            
            return { scrolled: true, endReached: !!pageEnd, isAtBottom: isAtBottom };
          }
          return { scrolled: false, endReached: false, isAtBottom: false };
        });

        consecutiveEmptyScrolls++;

        if (scrollStatus.endReached || (consecutiveEmptyScrolls >= maxEmptyScrolls && scrollStatus.isAtBottom)) {
          log(`[Robô] Fim dos resultados alcançado!`);
          break;
        }

        await sleep(3000);
        continue;
      }

      consecutiveEmptyScrolls = 0;

      // Extract next lead details
      const nextUrl = unvisitedUrls[0];
      const cleanUrl = nextUrl.split('/@')[0];
      processedUrls.add(cleanUrl);

      log(`[Robô] Clicando no lead: ${nextUrl}`);
      
      // Click the listing card inside activeTab
      await activeTab.evaluate((targetUrl) => {
        const card = document.querySelector(`a[href^="${targetUrl}"]`) || 
                     Array.from(document.querySelectorAll('a[href*="/maps/place/"]')).find(a => a.href.includes(targetUrl));
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.click();
          return true;
        }
        return false;
      }, cleanUrl);

      // Wait for details panel header title
      let detailsLoaded = false;
      for (let attempt = 0; attempt < 12; attempt++) {
        detailsLoaded = await activeTab.evaluate(() => {
          const title = document.querySelector('h1.DUwDvf');
          return title && title.textContent.trim() !== '';
        });
        if (detailsLoaded) break;
        await sleep(500);
      }

      if (!detailsLoaded) {
        log(`[Robô] Painel de detalhes demorou muito para carregar. Pulando lead.`);
        continue;
      }

      // Extra wait to allow rating/reviews counter to fully render in the details panel
      await sleep(2500);

      // Extract raw details from panel DOM
      log(`[Robô] Extraindo informações textuais do Maps...`);
      const mapsData = await activeTab.evaluate(() => {
        const name = document.querySelector('h1.DUwDvf')?.textContent.trim() || '';
        
        let category = '';
        const categoryBtn = document.querySelector('button[class*="DkE7sg"], button[jsaction*="category"]');
        if (categoryBtn) {
          category = categoryBtn.textContent.trim();
        } else {
          // Search for buttons inside the header container that do not contain numbers/ratings
          const headerButtons = Array.from(document.querySelectorAll('div[class*="LBgpqf"] button'));
          const catBtn = headerButtons.find(btn => {
            const txt = btn.textContent.trim();
            return txt && !txt.includes('(') && !txt.includes(')') && !txt.match(/^\d/);
          });
          if (catBtn) {
            category = catBtn.textContent.trim();
          } else {
            // Alternative fallback
            const spanEls = Array.from(document.querySelectorAll('span'));
            const catSpan = spanEls.find(span => span.className.includes('DkE7sg'));
            if (catSpan) category = catSpan.textContent.trim();
          }
        }

        // Clean category to prevent leaked scores
        if (category) {
          category = category.replace(/^[0-9.,()\s·]+/, '').trim();
        }

        // Phone
        const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"], a[href^="tel:"]');
        let phone = '';
        if (phoneBtn) {
          const href = phoneBtn.getAttribute('href');
          if (href && href.startsWith('tel:')) {
            phone = decodeURIComponent(href.replace('tel:', '')).trim();
          } else {
            phone = phoneBtn.textContent.trim();
          }
        }

        // Website
        const websiteBtn = document.querySelector('a[data-item-id="authority"], button[data-item-id="authority"]');
        let website = '';
        if (websiteBtn) {
          const href = websiteBtn.getAttribute('href');
          if (href && !href.includes('google.com')) {
            website = href;
          }
        }

        // Address
        const addressBtn = document.querySelector('button[data-item-id="address"]');
        const address = addressBtn ? addressBtn.textContent.trim() : '';

        // Rating / Reviews - Multi-strategy extraction
        let rating = null;
        let reviewsCount = 0;

        // Helper to parse a raw reviews string
        const parseReviewsRaw = (raw) => {
          const r = raw.toLowerCase().trim();
          if (r.includes('mil') || r.includes('k')) {
            const floatMatch = r.match(/(\d+([.,]\d+)?)/);
            if (floatMatch) return Math.round(parseFloat(floatMatch[1].replace(',', '.')) * 1000);
          }
          return parseInt(r.replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '')) || 0;
        };

        // Strategy 1: Primary container div.F7nice
        const ratingContainer = document.querySelector('div.F7nice');
        if (ratingContainer) {
          const text = ratingContainer.textContent.trim();
          const ratingMatch = text.match(/^([0-9.,]+)/);
          if (ratingMatch) {
            rating = parseFloat(ratingMatch[1].replace(',', '.'));
          }
          const reviewsMatch = text.match(/\(([^)]+)\)/);
          if (reviewsMatch) {
            reviewsCount = parseReviewsRaw(reviewsMatch[1]);
          }

          // Fallback via aria-label on inner element (avoids rating * 10 bug by requiring 2+ numbers)
          if (reviewsCount === 0 && rating > 0) {
            const ariaEl = ratingContainer.querySelector('[aria-label]') || ratingContainer;
            const ariaText = ariaEl.getAttribute('aria-label') || '';
            if (ariaText) {
              const numbers = ariaText.match(/(\d+[\d.,]*)/g);
              if (numbers && numbers.length > 1) {
                reviewsCount = parseReviewsRaw(numbers[numbers.length - 1]);
              }
            }
          }
        }

        // Strategy 2: Look for aria-label on any element containing star rating text
        if (reviewsCount === 0) {
          const starEls = Array.from(document.querySelectorAll('[aria-label*="estrela"], [aria-label*="star"], [aria-label*="avalia"]'));
          for (const el of starEls) {
            const aria = el.getAttribute('aria-label') || '';
            const numbers = aria.match(/(\d[\d.,]*)/g);
            if (numbers && numbers.length >= 2) {
              // First number is rating, last is reviews count
              if (!rating) rating = parseFloat(numbers[0].replace(',', '.'));
              const candidate = parseReviewsRaw(numbers[numbers.length - 1]);
              if (candidate > 0 && candidate !== Math.round(parseFloat(numbers[0].replace(',', '.')) * 10)) {
                reviewsCount = candidate;
                break;
              }
            }
          }
        }

        // Strategy 3: Look for review button/span with digit - searches broader DOM
        if (reviewsCount === 0) {
          const candidates = Array.from(document.querySelectorAll('button[aria-label], span[aria-label]'));
          const reviewBtn = candidates.find(el => {
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            return (aria.includes('avalia') || aria.includes('review') || aria.includes('coment')) && /\d/.test(aria);
          });
          if (reviewBtn) {
            const aria = reviewBtn.getAttribute('aria-label') || '';
            const numbers = aria.match(/(\d[\d.,]*)/g);
            if (numbers && numbers.length > 0) {
              reviewsCount = parseReviewsRaw(numbers[numbers.length - 1]);
            }
          }
        }

        // Strategy 4: Broad text scan for "N avaliações" or "(N)" near rating score
        if (reviewsCount === 0) {
          const allSpans = Array.from(document.querySelectorAll('span'));
          const reviewSpan = allSpans.find(el => {
            const txt = el.textContent.trim();
            return /^\([\d.,\s]+(?:mil)?\)$/.test(txt) || /^[\d.,\s]+(?:mil)?\s*(avaliações|reviews?)$/i.test(txt);
          });
          if (reviewSpan) {
            const txt = reviewSpan.textContent.replace(/[()]/g, '').trim();
            reviewsCount = parseReviewsRaw(txt);
          }
        }

        // Images list
        const mainImg = document.querySelector('img[src^="https://lh5.googleusercontent.com/p/"]');
        const imageUrl = mainImg ? mainImg.getAttribute('src') : '';

        const photoElements = Array.from(document.querySelectorAll('img[src^="https://lh5.googleusercontent.com/p/"]'));
        const photos = Array.from(new Set(photoElements.map(img => img.src)))
          .filter(src => src && src.trim() !== '')
          .slice(0, 5);

        // Extract amenities and services listed in Google Maps details panel directly
        const mapsServices = [];
        const serviceElements = Array.from(document.querySelectorAll('div[class*="WgFkfe"], div[class*="DRu3ce"], div[class*="E025ub"], span[class*="fontBodyMedium"]'));
        serviceElements.forEach(el => {
          const text = el.textContent.trim().replace(/\s+/g, ' ');
          if (text && (
            text.includes('Serviços') || 
            text.includes('serviço') || 
            text.includes('Oferece') || 
            text.includes('Tratamento') ||
            text.includes('Acessibilidade') ||
            text.includes('Atendimento')
          )) {
            if (text.length > 3 && text.length < 80) {
              mapsServices.push(text);
            }
          }
        });

        // Also check if there is an explicit catalog/services menu URL
        let servicesUrl = '';
        const servicesBtn = document.querySelector('a[data-item-id="menu"], button[data-item-id="menu"]');
        if (servicesBtn) {
          const href = servicesBtn.getAttribute('href');
          if (href) servicesUrl = href;
        }

        return { name, category, phone, website, address, rating, reviewsCount, imageUrl, photos, mapsServices, servicesUrl };
      });

      // Resiliently check category to ensure no dot rating leaked
      if (mapsData.category) {
        mapsData.category = mapsData.category.replace(/^[0-9.,()\s·]+/, '').trim();
      }

      // Check duplicates persistently before expensive crawl actions
      const placeId = Buffer.from(`${mapsData.name}${mapsData.address}`.replace(/\s/g, '').toLowerCase()).toString('base64');
      if (existingIds && existingIds.has(placeId)) {
        log(`[Robô] Lead "${mapsData.name}" já consta no banco de dados local. Ignorando coleta para buscar novos.`);
        processedUrls.add(cleanUrl);
        continue; // Skip without counting, allowing new prospects to be captured
      }

      // Parse coordinates from browser URL
      const currentTabUrl = await activeTab.url();
      const coords = getCoordinatesFromUrl(currentTabUrl);

      // Find pre-parsed list card data as fallback for rating/reviews
      // Try exact match first, then partial match (handles @coords suffix variants)
      const matchedCard = listCardsData ? (
        listCardsData.find(item => item.url.split('/@')[0] === cleanUrl) ||
        listCardsData.find(item => item.url.includes(cleanUrl) || cleanUrl.includes(item.url.split('/@')[0]))
      ) : null;
      const finalRating = mapsData.rating !== null ? mapsData.rating : (matchedCard ? matchedCard.rating : null);
      // Use card reviewsCount as fallback when panel extraction returns 0 but card has data
      const finalReviewsCount = mapsData.reviewsCount > 0 
        ? mapsData.reviewsCount 
        : (matchedCard && matchedCard.reviewsCount > 0 ? matchedCard.reviewsCount : 0);
      
      if (mapsData.reviewsCount === 0 && matchedCard && matchedCard.reviewsCount > 0) {
        log(`[Robô] Reviews extraídas do card da lista como fallback: ${matchedCard.reviewsCount} para "${mapsData.name}"`);
      }

      // Setup lead skeleton
      const lead = {
        id: placeId,
        name: mapsData.name,
        category: mapsData.category,
        phone: mapsData.phone,
        email: '',
        socials: null,
        address: mapsData.address,
        website: mapsData.website,
        servicesUrl: mapsData.servicesUrl || '',
        rating: finalRating,
        reviewsCount: finalReviewsCount,
        latitude: coords.lat,
        longitude: coords.lng,
        mapsUrl: currentTabUrl,
        imageUrl: mapsData.imageUrl,
        photos: mapsData.photos,
        brandColors: [],
        styleEsthetic: 'Sem Website',
        services: mapsData.mapsServices || [],
        hasSSL: false,
        hasCustomDomain: false,
        hasWhatsapp: false,
        opportunities: [],
        websiteType: 'SEM_SITE',
        timestamp: Date.now()
      };

      // Escanear WhatsApp se for telefone celular BR
      if (lead.phone) {
        const clean = lead.phone.replace(/\D/g, '');
        if (clean.length === 11 && clean.charAt(2) === '9') {
          lead.hasWhatsapp = true;
        }
      }

      // Website classification
      lead.websiteType = classifyWebsiteType(lead.website);

      // 5. Active brand crawler & website diagnostic analysis
      if (lead.website && lead.websiteType !== 'WHATSAPP_LINK' && lead.websiteType !== 'REDE_SOCIAL_APENAS') {
        const webDiagnostic = await analyzeCompanyWebsite(browser, lead.website, log);
        lead.email = webDiagnostic.email;
        lead.socials = webDiagnostic.socials;
        lead.brandColors = webDiagnostic.brandColors;
        lead.styleEsthetic = webDiagnostic.styleEsthetic;
        
        // Merge website scraped services with Google Maps pre-scraped services
        const mergedServices = Array.from(new Set([
          ...(lead.services || []),
          ...(webDiagnostic.services || [])
        ])).slice(0, 12);
        lead.services = mergedServices;
        
        lead.hasSSL = webDiagnostic.hasSSL;
        lead.hasCustomDomain = webDiagnostic.hasCustomDomain;
        if (webDiagnostic.hasWhatsapp) {
          lead.hasWhatsapp = true;
        }
      }

      // 6. Compile B2B Opportunities
      const opportunities = [];
      if (lead.websiteType === 'SEM_SITE') {
        opportunities.push('SEM_SITE');
      } else if (lead.websiteType === 'WHATSAPP_LINK') {
        opportunities.push('WHATSAPP_LINK_COMO_SITE');
      } else if (lead.websiteType === 'REDE_SOCIAL_APENAS') {
        opportunities.push('REDE_SOCIAL_COMO_SITE');
      } else if (lead.websiteType === 'DOMINIO_TERCEIROS') {
        opportunities.push('DOMINIO_GRATUITO');
        if (!lead.hasSSL) opportunities.push('SEM_SSL');
      } else {
        if (!lead.hasSSL) opportunities.push('SEM_SSL');
      }

      // CRM Opportunities - strictly low rating (rating < 4.2) OR zero reviews (no social proof)
      const ratingVal = lead.rating !== null ? parseFloat(lead.rating) : null;
      const reviewsVal = lead.reviewsCount !== null ? parseInt(lead.reviewsCount) : 0;
      
      if (ratingVal !== null) {
        if (ratingVal < 4.2 || (ratingVal === 0 && reviewsVal === 0)) {
          opportunities.push('REPUTACAO_BAIXA');
        }
      }

      // WhatsApp Opportunities
      if (!lead.hasWhatsapp) {
        opportunities.push('FALTA_WHATSAPP');
      }
      lead.opportunities = opportunities;

      log(`[Robô] Lead processado com sucesso: ${lead.name}`);

      // 7. Dispatch lead callback to stream results back to React in real time!
      if (onLead) {
        onLead(lead);
      }

      leadsCount++;
      await sleep(1000 + Math.random() * 500);
    }

    log(`[Robô] Coleta de leads concluída! Total extraído: ${leadsCount}`);

  } catch (err) {
    log(`[Erro no Robô] Ocorreu uma falha crítica na automação: ${err.message}`);
    throw err;
  } finally {
    if (browser) {
      log(`[Robô] Fechando navegador Chromium do Puppeteer...`);
      await browser.close();
    }
  }
};
