export interface ServiceCatalogItem {
  category: string;
  serviceCode: string;
  serviceName: string;
  defaultEndpoint: string | null;
  defaultKeyName: string | null;
}

export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  // AI
  { category: 'AI', serviceCode: 'openai', serviceName: 'OpenAI', defaultEndpoint: 'https://api.openai.com/v1', defaultKeyName: 'API Key' },
  { category: 'AI', serviceCode: 'gemini', serviceName: 'Google Gemini', defaultEndpoint: 'https://generativelanguage.googleapis.com/v1', defaultKeyName: 'API Key' },
  { category: 'AI', serviceCode: 'claude', serviceName: 'Anthropic Claude', defaultEndpoint: 'https://api.anthropic.com/v1', defaultKeyName: 'API Key' },

  // EMAIL
  { category: 'EMAIL', serviceCode: 'gmail', serviceName: 'Gmail SMTP', defaultEndpoint: 'smtp.gmail.com:587', defaultKeyName: 'App Password' },

  // STORAGE
  { category: 'STORAGE', serviceCode: 'google_drive', serviceName: 'Google Drive', defaultEndpoint: 'https://www.googleapis.com/drive/v3', defaultKeyName: 'Service Account Key' },

  // MARKETPLACE
  { category: 'MARKETPLACE', serviceCode: 'shopee', serviceName: 'Shopee', defaultEndpoint: 'https://partner.shopeemobile.com', defaultKeyName: 'Partner Key' },
  { category: 'MARKETPLACE', serviceCode: 'tiktok', serviceName: 'TikTok Shop', defaultEndpoint: 'https://open-api.tiktokglobalshop.com', defaultKeyName: 'App Key' },
  { category: 'MARKETPLACE', serviceCode: 'shopify', serviceName: 'Shopify', defaultEndpoint: null, defaultKeyName: 'API Access Token' },
  { category: 'MARKETPLACE', serviceCode: 'amazon', serviceName: 'Amazon SP-API', defaultEndpoint: 'https://sellingpartnerapi.amazon.com', defaultKeyName: 'Access Key' },
  { category: 'MARKETPLACE', serviceCode: 'cafe24', serviceName: 'Cafe24', defaultEndpoint: null, defaultKeyName: 'Client ID' },

  // ERP
  { category: 'ERP', serviceCode: 'odoo', serviceName: 'Odoo', defaultEndpoint: null, defaultKeyName: 'API Key' },

  // PLATFORM
  { category: 'PLATFORM', serviceCode: 'amoeba', serviceName: 'Amoeba AMA', defaultEndpoint: 'https://ama.amoeba.site/api/v1', defaultKeyName: 'JWT Token' },
];
