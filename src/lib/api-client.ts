const ENGINE_API_URL = process.env.NEXT_PUBLIC_ENGINE_API_URL || 'http://localhost:7044';
const DAEMON_API_URL = process.env.NEXT_PUBLIC_DAEMON_API_URL || 'http://localhost:8081';

export interface SmartAskResponse {
  answer: string;
  logs: any[];
  receipt?: any;
}

export const apiClient = {
  // Engine API
  async smartAsk(query: string): Promise<SmartAskResponse> {
    const response = await fetch(`${ENGINE_API_URL}/v1/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error('Engine API error');
    return response.json();
  },

  async directAsk(subnetId: string, endpoint: string, payload: any) {
    const response = await fetch(`${ENGINE_API_URL}/v1/ask/${subnetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, payload }),
    });
    if (!response.ok) throw new Error('Engine API error');
    return response.json();
  },

  async listSubnets() {
    const response = await fetch(`${ENGINE_API_URL}/v1/subnets`);
    if (!response.ok) throw new Error('Engine API error');
    return response.json();
  },

  // Daemon API
  async fetchSignals(category?: string, sinceHours: number = 24) {
    const url = new URL(`${DAEMON_API_URL}/api/questions`);
    if (category) url.searchParams.append('category', category);
    url.searchParams.append('since_hours', sinceHours.toString());
    
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Daemon API error');
    return response.json();
  },

  async getTopSignals(sinceHours: number = 1, limit: number = 10) {
    const response = await fetch(`${DAEMON_API_URL}/api/questions/top?since_hours=${sinceHours}&limit=${limit}`);
    if (!response.ok) throw new Error('Daemon API error');
    return response.json();
  },

  async getCategories() {
    const response = await fetch(`${DAEMON_API_URL}/api/categories`);
    if (!response.ok) throw new Error('Daemon API error');
    return response.json();
  }
};
