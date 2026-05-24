// AI-Powered B2B Copywriting Sales Pitch Generator - G-Maps Scraper Web App

export const generateSalesPitch = (lead) => {
  const name = lead.name || 'Empresa';
  const category = lead.category || 'Negócio';
  const location = lead.address ? lead.address.split(',')[1]?.trim() || 'sua região' : 'sua região';
  
  // Format services
  const servicesList = lead.services && lead.services.length > 0
    ? lead.services.slice(0, 3).join(', ')
    : '';

  // Format brand colors
  const colorsList = lead.brandColors && lead.brandColors.length > 0
    ? lead.brandColors.slice(0, 3).join(' e ')
    : '';

  const opps = lead.opportunities || [];

  // 1. OPORTUNIDADE MÁXIMA: SEM WEBSITE
  if (opps.includes('SEM_SITE')) {
    let pitch = `Olá, equipe da *${name}*! 👋\n\n`;
    pitch += `Estava mapeando empresas de destaque no setor de *${category}* em *${location}* e notei que vocês são super bem avaliados, mas **ainda não possuem um website próprio estruturado no Google**.\n\n`;
    
    if (servicesList) {
      pitch += `Criei um modelo exclusivo de página profissional com foco direto nas especialidades de vocês, destacando serviços como *${servicesList}*.\n\n`;
    } else {
      pitch += `Criei um modelo de página profissional totalmente focado no nicho de ${category}, projetado para capturar novos clientes no piloto automático.\n\n`;
    }

    pitch += `Além de um design moderno, integrei um **Robô de Atendimento via WhatsApp** que agenda horários e tira dúvidas dos clientes 24 horas por dia, enviando tudo direto para o seu celular.\n\n`;
    pitch += `O protótipo ficou excelente. Podemos agendar uma breve conversa de 10 minutos esta semana para eu te apresentar este modelo sem compromisso?`;
    return pitch;
  }

  // 2. OPORTUNIDADE: LINK DE WHATSAPP COMO SITE
  if (opps.includes('WHATSAPP_LINK_COMO_SITE')) {
    let pitch = `Olá, tudo bem? 👋\n\n`;
    pitch += `Estava avaliando empresas de destaque em *${category}* e visitei o perfil da *${name}* no Google Maps. Notei que vocês **cadastraram um link direto de WhatsApp no lugar do site oficial**.\n\n`;
    pitch += `O WhatsApp é fantástico para fechamento, mas a ausência de uma página própria reduz drasticamente as buscas orgânicas de vocês no Google e impede que clientes fora do horário comercial conheçam as especialidades de vocês.\n\n`;
    pitch += `Desenvolvi um layout exclusivo de **Landing Page de Alta Conversão** específico para *${category}* em *${location}*, otimizada para capturar dados de clientes 24 horas por dia e integrá-los diretamente com o seu WhatsApp.\n\n`;
    pitch += `Gostaria de ver o modelo interativo que preparei para a sua empresa?`;
    return pitch;
  }

  // 2.2 OPORTUNIDADE: APENAS REDE SOCIAL COMO SITE
  if (opps.includes('REDE_SOCIAL_COMO_SITE')) {
    let pitch = `Olá! Tudo bem? 👋\n\n`;
    pitch += `Estive no perfil da *${name}* no Google Maps e notei que vocês utilizam um link de rede social (como Facebook ou Instagram) como site principal no Google.\n\n`;
    pitch += `Ter redes ativas é incrível, mas usá-las no lugar do site oficial custa caro: concorrentes com domínio próprio aparecem posicionados acima no Google e 65% dos usuários se dispersam com notificações de redes antes de entrarem em contato.\n\n`;
    pitch += `Criei uma **Apresentação Profissional própria** para a *${name}*, focada em carregar em menos de 1 segundo nos celulares e reter a atenção do visitante no seu serviço de forma exclusiva.\n\n`;
    pitch += `Posso te enviar o link interativo de demonstração para você me dar o seu feedback?`;
    return pitch;
  }

  // 2.3 OPORTUNIDADE: DOMÍNIO GRATUITO OU PLATAFORMA GENÉRICA
  if (opps.includes('DOMINIO_GRATUITO')) {
    let pitch = `Olá, tudo bem? 👋\n\n`;
    pitch += `Visitei o perfil da *${name}* no Google Maps e notei que vocês usam um subdomínio de plataforma gratuita (como Wix/WordPress) como site oficial.\n\n`;
    pitch += `Como vocês são referência em *${category}*, o uso de um link compartilhado gratuito pode passar a impressão de um negócio informal e reduz em até 40% a conversão de novos clientes que buscam no Google.\n\n`;
    
    if (colorsList) {
      pitch += `Desenvolvi um layout modernizado com a identidade visual de vocês (utilizando tons sofisticados como *${colorsList}*) e com domínio próprio comercial (ex: www.${name.toLowerCase().replace(/\s/g, '')}.com.br).\n\n`;
    } else {
      pitch += `Desenvolvi um layout modernizado de alta velocidade, totalmente personalizado com a marca de vocês e em domínio comercial próprio.\n\n`;
    }

    pitch += `O site conta com carregamento ultrarrápido em celulares e um sistema de **Captação Automática de Leads** integrado para maximizar suas consultas.\n\n`;
    pitch += `Gostaria de dar uma olhada na demonstração interativa que montei?`;
    return pitch;
  }

  // 3. OPORTUNIDADE: SEM SSL (CONEXÃO INSEGURA)
  if (opps.includes('SEM_SSL')) {
    let pitch = `Olá, equipe da *${name}*! 👋\n\n`;
    pitch += `Gostaria de alertar sobre um detalhe crítico de segurança: ao acessar o site oficial de vocês, o Google Chrome exibe o aviso vermelho de **"Site Não Seguro" (Falta de SSL)**.\n\n`;
    pitch += `Isso acontece porque a conexão opera em HTTP. Além de afastar potenciais clientes por medo de vírus ou roubo de dados, o Google penaliza severamente o posicionamento do seu site nas buscas por causa disso.\n\n`;
    
    if (colorsList) {
      pitch += `Aproveitei para fazer uma auditoria e criei uma versão atualizada da página de vocês, mantendo a bela paleta em *${colorsList}*, mas com criptografia SSL ativa, carregamento 3x mais rápido e otimizada para SEO.\n\n`;
    } else {
      pitch += `Aproveitei para fazer uma auditoria e criei uma versão atualizada e segura da página de vocês, com criptografia SSL ativa, carregamento 3x mais rápido e otimizada para SEO.\n\n`;
    }

    pitch += `Podemos falar rapidamente para eu te mostrar como regularizar a segurança do seu site hoje mesmo e ativar um canal direto de WhatsApp para o seu time de vendas?`;
    return pitch;
  }

  // 4. OPORTUNIDADE: SITE BOM MAS FALTA WHATSAPP
  if (opps.includes('FALTA_WHATSAPP')) {
    let pitch = `Olá! Tudo bem? 👋\n\n`;
    pitch += `Parabéns pelo belo trabalho e posicionamento da *${name}* no Google! Visitei o site de vocês e achei o design muito elegante`;
    if (colorsList) pitch += ` (os tons de *${colorsList}* transmitem muita autoridade)`;
    pitch += `.\n\n`;
    
    pitch += `No entanto, notei um ponto crítico: **não encontrei um botão direto ou sistema de agendamento automático via WhatsApp** flutuando na página.\n\n`;
    pitch += `Hoje, mais de 78% dos clientes que acessam um site pelo celular preferem iniciar um chat rápido pelo WhatsApp em vez de preencher formulários ou ligar. Você pode estar perdendo até metade das suas conversões.\n\n`;
    
    if (servicesList) {
      pitch += `Desenvolvi um **Assistente Virtual Inteligente (Chatbot)** focado em vender seus serviços de *${servicesList}* diretamente pelo WhatsApp. Ele faz a triagem do cliente, agenda o atendimento e envia tudo pronto para a sua equipe.\n\n`;
    } else {
      pitch += `Desenvolvi um **Assistente Virtual Inteligente (Chatbot)** de agendamento que atende e filtra clientes diretamente pelo WhatsApp 24 horas por dia.\n\n`;
    }

    pitch += `Gostaria de fazer um teste prático de 1 minuto no robô de WhatsApp que simulei para a sua empresa?`;
    return pitch;
  }

  // 5. OPORTUNIDADE: REPUTAÇÃO BAIXA OU POUCOS COMENTÁRIOS
  if (opps.includes('REPUTACAO_BAIXA')) {
    let pitch = `Olá, equipe da *${name}*! 👋\n\n`;
    pitch += `Parabéns pelo trabalho na área de *${category}*! Notei que vocês prestam excelentes serviços de prospecção, mas **o perfil do Google Maps de vocês está com poucas avaliações ou nota abaixo do potencial real**.\n\n`;
    pitch += `Na internet, 92% dos consumidores escolhem a empresa com maior volume de avaliações 5 estrelas. Ter pouca pontuação faz com que concorrentes com menos tempo de mercado fiquem posicionados acima de vocês.\n\n`;
    pitch += `Desenvolvi um **Robô Gerador de Prova Social** integrado com WhatsApp. Sempre que vocês concluírem um serviço, o robô envia uma mensagem amigável solicitando uma avaliação positiva, enviando os clientes satisfeitos diretamente para o Google e filtrando insatisfações internamente.\n\n`;
    pitch += `Posso te mostrar como funciona na prática em uma demonstração rápida de 5 minutos?`;
    return pitch;
  }

  // 6. DEFAULT PITCH (SITE BOM E COMPLETO)
  let pitch = `Olá! Tudo bem? 👋\n\n`;
  pitch += `Gostaria de parabenizar a equipe da *${name}* pelo excelente posicionamento digital! O site de vocês é muito completo, opera em HTTPS e conta com ótimas avaliações no Google Maps.\n\n`;
  if (servicesList) {
    pitch += `Identificamos que vocês prestam ótimos serviços em *${servicesList}*.\n\n`;
  }
  pitch += `Nós atuamos com **integração de CRM avançado e Automações de Tráfego Pago** específicas para o nicho de *${category}*, com o objetivo de dobrar o volume de consultas qualificadas mensais que vocês já recebem.\n\n`;
  pitch += `Podemos agendar uma demonstração rápida de 10 minutos para eu te apresentar nosso portfólio de resultados com empresas similares?`;
  return pitch;
};
