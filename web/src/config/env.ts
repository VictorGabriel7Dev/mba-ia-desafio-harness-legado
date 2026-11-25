// Configuração de ambiente do web. Único lugar que lê import.meta.env (invariante G5).
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
