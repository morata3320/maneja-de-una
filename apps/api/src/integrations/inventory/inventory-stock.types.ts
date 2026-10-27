export interface StockUpdateMessage {
  service_id: string;
  item_id: string;
  date: string;
  time_slot: string;
  available_units: number;
  timestamp: number;
  slot_id: string;
}

export interface StockUpdateAck {
  success: boolean;
  message: string;
  processed_at: number;
  error_code: string;
  current_available: number;
}

export interface PendingStockUpdate extends StockUpdateMessage {
  id: string;
  attempts: number;
}
